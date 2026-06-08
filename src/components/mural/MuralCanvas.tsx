import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { MuralPoster } from './MuralPoster';
import type { MuralLayout, PosterRect } from '@/hooks/useMuralLayout';
import { colors } from '@/constants/theme';

interface MuralCanvasProps {
  layout: MuralLayout;
  viewportWidth: number;
  viewportHeight: number;
  onPosterTap: (eventId: string) => void;
}

const MAX_SCALE = 2;
const MIN_SCALE_FLOOR = 0.1; // safety floor so degenerate canvases don't divide by zero
const RUBBER_BAND_RESISTANCE = 0.4;
const TAP_MAX_DISTANCE = 10;

// On web we intentionally skip the Reanimated Babel plugin (see
// babel.config.js — v4 worklets need a native runtime). That means gesture
// callbacks can't be UI-thread worklets there; .runOnJS(true) is the
// explicit acknowledgement gesture-handler wants. On native, we keep the
// default (UI-thread worklets) so jitter-free pan/pinch keeps working.
const RUN_GESTURE_ON_JS = Platform.OS === 'web';
const SPRING_CONFIG = {
  damping: 18,
  stiffness: 140,
  mass: 0.9,
};

/**
 * Pan + pinch + tap canvas for the mural.
 *
 * Gesture composition: Race(tap, Simultaneous(pan, pinch)). A quick touch
 * wins as a tap; once movement exceeds the tap tolerance pan/pinch take
 * over and run concurrently (you can pan while pinching).
 *
 * Bounds: at any given scale the canvas is canvasW*scale × canvasH*scale.
 * When that exceeds the viewport, translate is clamped so the canvas edges
 * align with the viewport edges (max = 0, min = viewport - scaled canvas).
 * When the scaled canvas fits inside the viewport (zoomed out past 1.0),
 * translate is locked to the center value. During an active pan, exceeding
 * bounds applies rubber-band resistance; on release, withSpring animates
 * back into bounds.
 *
 * Pinch focal-point: the canvas point under the fingers at gesture start
 * stays under the fingers as scale changes. Standard focal-point math —
 * see onUpdate of pinchGesture.
 *
 * Tap hit-testing happens on JS thread (runOnJS): we read the current
 * translate/scale shared values, project the screen tap into canvas coords,
 * and walk posters to find the hit. Cheap for ≤200 posters; no need for a
 * spatial index.
 *
 * Left-edge back-swipe is handled at the navigation layer via
 * gestureResponseDistance — see app/(tabs)/feed/_layout.tsx. This canvas
 * does NOT gate the leftmost 20px itself; React Navigation steals those
 * touches before they reach the GestureDetector.
 */
export function MuralCanvas({
  layout,
  viewportWidth,
  viewportHeight,
  onPosterTap,
}: MuralCanvasProps) {
  const { posters, canvasWidth, canvasHeight } = layout;

  // Minimum scale that still fits the whole canvas in the viewport. The
  // smaller axis dominates: we want the canvas to fit entirely in both
  // dimensions when fully zoomed out.
  const minScale = useMemo(
    () =>
      Math.max(
        Math.min(viewportWidth / canvasWidth, viewportHeight / canvasHeight),
        MIN_SCALE_FLOOR
      ),
    [canvasWidth, canvasHeight, viewportWidth, viewportHeight]
  );

  // Initial mount: shared values seed to the centered position so the very
  // first paint already shows the middle of the canvas — no top-left flash
  // before the effect runs. MuralCanvas only mounts once viewport size is
  // known (parent gates on viewportReady), so this calc is safe.
  const initialTX = centerOf(viewportWidth, canvasWidth, 1);
  const initialTY = centerOf(viewportHeight, canvasHeight, 1);

  const translateX = useSharedValue(initialTX);
  const translateY = useSharedValue(initialTY);
  const scale = useSharedValue(1);
  const savedTranslateX = useSharedValue(initialTX);
  const savedTranslateY = useSharedValue(initialTY);
  const savedScale = useSharedValue(1);

  // postersRef stays in sync with whatever the layout produced so the JS
  // tap handler always hit-tests against the current set without needing
  // to re-create the gesture (which would invalidate handlers mid-touch).
  const postersRef = useRef<PosterRect[]>(posters);
  const onPosterTapRef = useRef(onPosterTap);
  useEffect(() => {
    postersRef.current = posters;
  }, [posters]);
  useEffect(() => {
    onPosterTapRef.current = onPosterTap;
  }, [onPosterTap]);

  // When the canvas shape changes (filter rebuilt the wall), gently spring
  // the viewport back into the new bounds rather than jump-cutting. Initial
  // mount is already centered via useSharedValue seeds, so this effect is
  // purely the "filters shrank the wall, your view is now out of bounds"
  // recovery path.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasWidth, canvasHeight, viewportWidth, viewportHeight]);

  // Web-only wheel handler.
  //
  // On macOS / Chromium, two-finger trackpad pan and trackpad pinch arrive
  // as `wheel` events — NOT as the pointer/touch events that
  // react-native-gesture-handler's Gesture.Pan / Gesture.Pinch listen for.
  // Without this bridge, the canvas feels frozen on desktop. Native is
  // unaffected: the early Platform.OS check short-circuits the effect on
  // iOS/Android.
  //
  // Conventions:
  //  - Two-finger pan: `wheel` with no ctrlKey. Subtract delta from
  //    translate (standard drag-pan direction — matches Maps / Figma).
  //  - Trackpad pinch + ctrl+wheel: ctrlKey set. deltaY controls scale;
  //    cursor position is the focal point so the wall zooms around your
  //    fingers, matching the native pinch behaviour.
  //
  // We bypass React's synthetic onWheel by attaching a native listener so
  // we can pass `passive: false` and call preventDefault — without it the
  // browser fights us with its own scroll/zoom.
  const viewportRef = useRef<View | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = viewportRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey) {
        // Pinch path: cursor is the focal point. Same focal-point math as
        // pinchGesture.onUpdate above — keep the canvas point under the
        // cursor under the cursor as scale changes.
        const rect = node.getBoundingClientRect();
        const focalX = e.clientX - rect.left;
        const focalY = e.clientY - rect.top;
        const oldScale = scale.value;
        // 1% per wheel unit; deltaY is positive for pinch-in (zoom out),
        // negative for pinch-out (zoom in).
        const factor = 1 - e.deltaY * 0.01;
        const newScale = clampJS(oldScale * factor, minScale, MAX_SCALE);
        const scaleRatio = newScale / oldScale;
        let nextTX = focalX - (focalX - translateX.value) * scaleRatio;
        let nextTY = focalY - (focalY - translateY.value) * scaleRatio;
        const xB = boundsFor(viewportWidth, canvasWidth, newScale);
        const yB = boundsFor(viewportHeight, canvasHeight, newScale);
        translateX.value = clampJS(nextTX, xB.min, xB.max);
        translateY.value = clampJS(nextTY, yB.min, yB.max);
        scale.value = newScale;
      } else {
        // Pan path: clamp to bounds — no rubber-band here. Wheel events
        // are discrete and have no clean "release" moment to spring back
        // from, so a hard clamp feels right and matches Maps/Figma.
        const xB = boundsFor(viewportWidth, canvasWidth, scale.value);
        const yB = boundsFor(viewportHeight, canvasHeight, scale.value);
        translateX.value = clampJS(
          translateX.value - e.deltaX,
          xB.min,
          xB.max
        );
        translateY.value = clampJS(
          translateY.value - e.deltaY,
          yB.min,
          yB.max
        );
      }
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportWidth, viewportHeight, canvasWidth, canvasHeight, minScale]);

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
          translateX.value = rubberBand(newX, xBounds.min, xBounds.max);
          translateY.value = rubberBand(newY, yBounds.min, yBounds.max);
        })
        .onEnd(() => {
          const xBounds = boundsForWorklet(viewportWidth, canvasWidth, scale.value);
          const yBounds = boundsForWorklet(
            viewportHeight,
            canvasHeight,
            scale.value
          );
          translateX.value = withSpring(
            clampWorklet(translateX.value, xBounds.min, xBounds.max),
            SPRING_CONFIG
          );
          translateY.value = withSpring(
            clampWorklet(translateY.value, yBounds.min, yBounds.max),
            SPRING_CONFIG
          );
        })
        .runOnJS(RUN_GESTURE_ON_JS),
    // Re-create when canvas geometry changes so onUpdate closes over fresh
    // bounds. minScale changes only when canvas/viewport change, so the
    // dependency list is exhaustive.
    [canvasWidth, canvasHeight, viewportWidth, viewportHeight]
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          savedScale.value = scale.value;
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
        })
        .onUpdate((e) => {
          const newScale = clampWorklet(
            savedScale.value * e.scale,
            minScale,
            MAX_SCALE
          );
          // Keep the point that was under the finger pair at start under
          // the finger pair now. Solve: focalX = newTX + canvasFocalX * newScale
          // where canvasFocalX = (focalX - oldTX) / oldScale.
          const scaleRatio = newScale / savedScale.value;
          translateX.value =
            e.focalX - (e.focalX - savedTranslateX.value) * scaleRatio;
          translateY.value =
            e.focalY - (e.focalY - savedTranslateY.value) * scaleRatio;
          scale.value = newScale;
        })
        .onEnd(() => {
          const xBounds = boundsForWorklet(viewportWidth, canvasWidth, scale.value);
          const yBounds = boundsForWorklet(
            viewportHeight,
            canvasHeight,
            scale.value
          );
          translateX.value = withSpring(
            clampWorklet(translateX.value, xBounds.min, xBounds.max),
            SPRING_CONFIG
          );
          translateY.value = withSpring(
            clampWorklet(translateY.value, yBounds.min, yBounds.max),
            SPRING_CONFIG
          );
        })
        .runOnJS(RUN_GESTURE_ON_JS),
    [canvasWidth, canvasHeight, viewportWidth, viewportHeight, minScale]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(TAP_MAX_DISTANCE)
        .onEnd((e) => {
          // On web .runOnJS(true) means this callback is JS-thread; runOnJS
          // wrap is a no-op there. On native it bridges the worklet → JS.
          // Same call either way — cheap unified code path.
          runOnJS(handleTap)(e.x, e.y);
        })
        .runOnJS(RUN_GESTURE_ON_JS),
    // handleTap reads refs that are kept current in effects, so the closure
    // identity doesn't need to update with each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const composed = useMemo(
    () =>
      Gesture.Race(tapGesture, Gesture.Simultaneous(panGesture, pinchGesture)),
    [panGesture, pinchGesture, tapGesture]
  );

  // Pass the shared values as deps so useAnimatedStyle subscribes to them.
  // Without the Reanimated Babel plugin (see babel.config.js — disabled on
  // web), the worklet's automatic dependency tracking is unavailable, so
  // explicit deps are required. With the plugin (native) deps are harmless.
  const animatedStyle = useAnimatedStyle(
    () => ({
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    }),
    [translateX, translateY, scale]
  );

  return (
    <GestureDetector gesture={composed}>
      <View ref={viewportRef} style={styles.viewport}>
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
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function centerOf(viewport: number, canvas: number, s: number) {
  const scaled = canvas * s;
  if (scaled <= viewport) return (viewport - scaled) / 2;
  // Center the canvas in the viewport: translate so canvas center lands at
  // viewport center.
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
  canvas: {
    position: 'absolute',
    left: 0,
    top: 0,
    // NO backgroundColor here. The canvas is `position: absolute` +
    // `transform: ...`, which creates a stacking context — and inside that
    // context the poster cells render their picture as a `background-image`
    // on a child div at z-index: -1. Painting the canvas with any colour
    // covers those negative-z children. The viewport (parent) keeps its
    // black background so the wall has a dark backdrop while panning.
  },
});
