import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { MuralPoster } from './MuralPoster';
import { MuralMinimap } from './MuralMinimap';
import type { MuralLayout, PosterRect } from '@/hooks/useMuralLayout';
import { colors } from '@/constants/theme';

interface MuralCanvasProps {
  layout: MuralLayout;
  viewportWidth: number;
  viewportHeight: number;
  onPosterTap: (eventId: string) => void;
}

// The wall renders at a FIXED zoom — posters at their natural (Figma-scale)
// size — so the canvas is larger than the viewport on both axes and the only
// interaction is free 2D panning. Pinch-zoom is intentionally absent: the
// brief is a "fixed-zoom wall plane that can be freely panned," and the
// minimap covers the "see the whole wall at once" need.
const FIXED_SCALE = 1;
const RUBBER_BAND_RESISTANCE = 0.4;
const TAP_MAX_DISTANCE = 10;

// On web we intentionally skip the Reanimated Babel plugin (see
// babel.config.js — v4 worklets need a native runtime). That means gesture
// callbacks can't be UI-thread worklets there; .runOnJS(true) is the
// explicit acknowledgement gesture-handler wants. On native, we keep the
// default (UI-thread worklets) so jitter-free panning keeps working.
const RUN_GESTURE_ON_JS = Platform.OS === 'web';
const SPRING_CONFIG = {
  damping: 18,
  stiffness: 140,
  mass: 0.9,
};

/**
 * Free-pan canvas for the mural — a large fixed-zoom poster wall.
 *
 * Interaction: pan (drag) in any direction + tap. A flick keeps gliding
 * (momentum) and rubber-stops at the wall edges, so the plane reads as a
 * space you roam rather than a carousel you swipe. There is no zoom: the
 * wall sits at a fixed scale where posters are Figma-sized, and the canvas
 * (from useMuralLayout) is naturally bigger than the viewport in BOTH axes —
 * that's what makes the 2D exploration work.
 *
 * Bounds: the canvas is canvasW × canvasH at the fixed scale. When it exceeds
 * the viewport, translate is clamped so the canvas edges align with the
 * viewport edges (max = 0, min = viewport − canvas). When it fits inside the
 * viewport (a tiny filtered set), translate locks to centre. During an active
 * drag, exceeding bounds applies rubber-band resistance (native); on release,
 * withDecay carries momentum and clamps back into bounds.
 *
 * Tap hit-testing happens on the JS thread (runOnJS): read the current
 * translate, project the screen tap into canvas coords, walk posters to find
 * the hit. Cheap for ≤200 posters; no spatial index needed.
 *
 * Left-edge back-swipe is handled at the navigation layer via
 * gestureResponseDistance — see app/(tabs)/feed/_layout.tsx.
 */
export function MuralCanvas({
  layout,
  viewportWidth,
  viewportHeight,
  onPosterTap,
}: MuralCanvasProps) {
  const { posters, canvasWidth, canvasHeight } = layout;

  // Fixed zoom: the wall never scales. Centre it in the viewport at mount so
  // it extends in all four directions, inviting exploration. With the canvas
  // larger than the viewport (the common case) centerOf returns a negative
  // offset that frames the middle of the wall; for a tiny filtered set that
  // fits the viewport it locks to centre (no pan into empty space).
  const initialTX = centerOf(viewportWidth, canvasWidth, FIXED_SCALE);
  const initialTY = centerOf(viewportHeight, canvasHeight, FIXED_SCALE);

  const translateX = useSharedValue(initialTX);
  const translateY = useSharedValue(initialTY);
  // `scale` is held at FIXED_SCALE for the canvas's life — it never mutates,
  // but stays a shared value so the minimap + tap math read it uniformly.
  const scale = useSharedValue(FIXED_SCALE);
  const savedTranslateX = useSharedValue(initialTX);
  const savedTranslateY = useSharedValue(initialTY);
  // Flips true on pan begin, false on end. The minimap reads this to bump its
  // opacity 0.7 → 1.0 during active interaction, mirroring the iOS scrollbar.
  const isInteracting = useSharedValue(false);

  // postersRef stays in sync with whatever the layout produced so the JS tap
  // handler always hit-tests against the current set without re-creating the
  // gesture (which would invalidate handlers mid-touch).
  const postersRef = useRef<PosterRect[]>(posters);
  const onPosterTapRef = useRef(onPosterTap);
  useEffect(() => {
    postersRef.current = posters;
  }, [posters]);
  useEffect(() => {
    onPosterTapRef.current = onPosterTap;
  }, [onPosterTap]);

  // Canvas opacity, used to fade-dip during filter-driven layout changes.
  // Stays at 1.0 outside of those moments — no first-mount flash.
  const canvasOpacity = useSharedValue(1);

  // When the canvas shape changes (filter rebuilt the wall), gently spring the
  // viewport back into the new bounds rather than jump-cutting, and dip opacity
  // so the relayout reads as a deliberate transition. Skip the dip on first
  // mount (prev ref unset) so landing on the screen isn't a flash.
  const prevCanvasRef = useRef<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const x = boundsFor(viewportWidth, canvasWidth, scale.value);
    const y = boundsFor(viewportHeight, canvasHeight, scale.value);
    translateX.value = withSpring(
      clampJS(translateX.value, x.min, x.max),
      SPRING_CONFIG
    );
    translateY.value = withSpring(
      clampJS(translateY.value, y.min, y.max),
      SPRING_CONFIG
    );

    const prev = prevCanvasRef.current;
    const sameShape =
      prev && prev.w === canvasWidth && prev.h === canvasHeight;
    if (prev && !sameShape) {
      canvasOpacity.value = withTiming(0.25, { duration: 140 }, () => {
        canvasOpacity.value = withTiming(1, { duration: 220 });
      });
    }
    prevCanvasRef.current = { w: canvasWidth, h: canvasHeight };
    // Reanimated shared values are intentionally NOT in the dep list — they
    // don't trigger React renders and including them would force-recreate the
    // effect on every gesture tick, breaking the smooth relayout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasWidth, canvasHeight, viewportWidth, viewportHeight]);

  // Web-only wheel handler.
  //
  // On macOS / Chromium, two-finger trackpad pan arrives as `wheel` events —
  // NOT the pointer/touch events react-native-gesture-handler listens for.
  // Without this bridge the canvas feels frozen on desktop. Native is
  // unaffected (the early Platform.OS check short-circuits the effect).
  //
  // Fixed zoom → every wheel gesture is a pan; we ignore ctrlKey (trackpad
  // pinch) so the wall never zooms. We attach a native listener with
  // `passive: false` so we can preventDefault and stop the browser fighting us.
  const viewportRef = useRef<View | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = viewportRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const onWheel = (e: WheelEvent) => {
      // Pan only. Hard-clamp to bounds: wheel events are discrete with no
      // "release" to spring back from, so a clamp matches Maps / Figma.
      e.preventDefault();
      const xB = boundsFor(viewportWidth, canvasWidth, scale.value);
      const yB = boundsFor(viewportHeight, canvasHeight, scale.value);
      translateX.value = clampJS(translateX.value - e.deltaX, xB.min, xB.max);
      translateY.value = clampJS(translateY.value - e.deltaY, yB.min, yB.max);
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
    // translateX/Y and scale are Reanimated shared values — excluded
    // deliberately. The handler reads .value at fire time, so it always sees
    // the latest gesture state without re-subscribing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportWidth, viewportHeight, canvasWidth, canvasHeight]);

  const handleTap = (screenX: number, screenY: number) => {
    const tx = translateX.value;
    const ty = translateY.value;
    const s = scale.value;
    const canvasX = (screenX - tx) / s;
    const canvasY = (screenY - ty) / s;

    const list = postersRef.current;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (
        canvasX >= p.x &&
        canvasX < p.x + p.width &&
        canvasY >= p.y &&
        canvasY < p.y + p.height
      ) {
        onPosterTapRef.current(p.event.id);
        return;
      }
    }
  };

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
          isInteracting.value = true;
        })
        .onUpdate((e) => {
          const newX = savedTranslateX.value + e.translationX;
          const newY = savedTranslateY.value + e.translationY;
          const xBounds = boundsForWorklet(viewportWidth, canvasWidth, scale.value);
          const yBounds = boundsForWorklet(
            viewportHeight,
            canvasHeight,
            scale.value
          );
          // On web, hard-clamp (no rubber-band) so a mouse drag never
          // over-shoots past the wall edges into the black background.
          // Rubber-band on native still feels iOS-correct under touch.
          if (RUN_GESTURE_ON_JS) {
            translateX.value = clampWorklet(newX, xBounds.min, xBounds.max);
            translateY.value = clampWorklet(newY, yBounds.min, yBounds.max);
          } else {
            translateX.value = rubberBand(newX, xBounds.min, xBounds.max);
            translateY.value = rubberBand(newY, yBounds.min, yBounds.max);
          }
        })
        .onEnd((e) => {
          const xBounds = boundsForWorklet(viewportWidth, canvasWidth, scale.value);
          const yBounds = boundsForWorklet(
            viewportHeight,
            canvasHeight,
            scale.value
          );
          // Momentum: a flick keeps gliding across the wall and rubber-stops
          // at the edges (native) / hard-stops (web). Makes a big plane feel
          // explorable instead of "drag, lift, drag, lift."
          translateX.value = withDecay({
            velocity: e.velocityX,
            clamp: [xBounds.min, xBounds.max],
            rubberBandEffect: !RUN_GESTURE_ON_JS,
            rubberBandFactor: 0.6,
          });
          translateY.value = withDecay({
            velocity: e.velocityY,
            clamp: [yBounds.min, yBounds.max],
            rubberBandEffect: !RUN_GESTURE_ON_JS,
            rubberBandFactor: 0.6,
          });
          isInteracting.value = false;
        })
        .runOnJS(RUN_GESTURE_ON_JS),
    // Re-create when canvas geometry changes so onUpdate closes over fresh
    // bounds. Shared values are excluded — worklets read .value at event time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvasWidth, canvasHeight, viewportWidth, viewportHeight]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(TAP_MAX_DISTANCE)
        .onEnd((e) => {
          // On web .runOnJS(true) means this callback is JS-thread; runOnJS
          // wrap is a no-op there. On native it bridges the worklet → JS.
          runOnJS(handleTap)(e.x, e.y);
        })
        .runOnJS(RUN_GESTURE_ON_JS),
    // handleTap reads refs kept current in effects, so the closure identity
    // doesn't need to update with each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const composed = useMemo(
    () => Gesture.Race(tapGesture, panGesture),
    [panGesture, tapGesture]
  );

  // Pass the shared values as deps so useAnimatedStyle subscribes to them.
  // Without the Reanimated Babel plugin (web) the worklet's automatic
  // dependency tracking is unavailable, so explicit deps are required. With
  // the plugin (native) deps are harmless.
  const animatedStyle = useAnimatedStyle(
    () => ({
      opacity: canvasOpacity.value,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    }),
    [translateX, translateY, scale, canvasOpacity]
  );

  // Teleport: animate translate so a chosen canvas point lands at viewport
  // centre. Called from the minimap's tap handler.
  const teleportTo = (canvasX: number, canvasY: number) => {
    const s = scale.value;
    const targetTX = viewportWidth / 2 - canvasX * s;
    const targetTY = viewportHeight / 2 - canvasY * s;
    const x = boundsFor(viewportWidth, canvasWidth, s);
    const y = boundsFor(viewportHeight, canvasHeight, s);
    translateX.value = withSpring(
      clampJS(targetTX, x.min, x.max),
      SPRING_CONFIG
    );
    translateY.value = withSpring(
      clampJS(targetTY, y.min, y.max),
      SPRING_CONFIG
    );
  };

  return (
    <View style={styles.viewport}>
      <GestureDetector gesture={composed}>
        <View ref={viewportRef} style={styles.gestureLayer}>
          <Animated.View
            style={[
              styles.canvas,
              {
                width: canvasWidth,
                height: canvasHeight,
              },
              animatedStyle,
            ]}
          >
            {posters.map((rect) => (
              <MuralPoster key={rect.event.id} rect={rect} />
            ))}
          </Animated.View>
        </View>
      </GestureDetector>
      <MuralMinimap
        posters={posters}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        viewportWidth={viewportWidth}
        viewportHeight={viewportHeight}
        translateX={translateX}
        translateY={translateY}
        scale={scale}
        isInteracting={isInteracting}
        onTeleport={teleportTo}
      />
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function centerOf(viewport: number, canvas: number, s: number) {
  const scaled = canvas * s;
  // Centre the canvas in the viewport whether it's larger (negative offset,
  // frames the middle of the wall) or smaller (positive offset, padded).
  return (viewport - scaled) / 2;
}

function boundsFor(viewport: number, canvas: number, s: number) {
  const scaled = canvas * s;
  if (scaled <= viewport) {
    const c = (viewport - scaled) / 2;
    return { min: c, max: c };
  }
  return { min: viewport - scaled, max: 0 };
}

function clampJS(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// Worklet-prefixed variants — Reanimated requires the directive on every
// function called from a worklet body.
function boundsForWorklet(viewport: number, canvas: number, s: number) {
  'worklet';
  const scaled = canvas * s;
  if (scaled <= viewport) {
    const c = (viewport - scaled) / 2;
    return { min: c, max: c };
  }
  return { min: viewport - scaled, max: 0 };
}

function clampWorklet(v: number, lo: number, hi: number) {
  'worklet';
  return Math.max(lo, Math.min(hi, v));
}

function rubberBand(v: number, lo: number, hi: number) {
  'worklet';
  if (v < lo) return lo - (lo - v) * RUBBER_BAND_RESISTANCE;
  if (v > hi) return hi + (v - hi) * RUBBER_BAND_RESISTANCE;
  return v;
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: colors.black,
    overflow: 'hidden',
  },
  gestureLayer: {
    flex: 1,
  },
  canvas: {
    position: 'absolute',
    left: 0,
    top: 0,
    // Transform origin pinned to the canvas's top-left corner. CSS defaults to
    // `50% 50%` (centre), which the centerOf() / boundsFor() math (top-left
    // origin) doesn't assume — without this pin the rendered position is
    // offset. RN's `transformOrigin` maps to the CSS property on web and is a
    // no-op on native (Animated.View already transforms around top-left).
    transformOrigin: '0 0',
    // NO backgroundColor here — the canvas is position:absolute + transform,
    // which creates a stacking context; painting it would cover poster
    // children. The viewport keeps the black backdrop while panning.
  },
});
