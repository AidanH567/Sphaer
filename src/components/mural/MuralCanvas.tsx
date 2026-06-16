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
import type { MuralLayout, PosterRect } from '@/hooks/useMuralLayout';
import { colors } from '@/constants/theme';

interface MuralCanvasProps {
  layout: MuralLayout;
  viewportWidth: number;
  viewportHeight: number;
  onPosterTap: (eventId: string) => void;
  // Increment to glide the wall to a fresh random in-bounds position (the
  // refresh "shuffle"). Unchanged value across renders = no shuffle.
  shuffleToken?: number;
}

// The wall renders at a FIXED zoom — posters at their natural (Figma-scale)
// size — so the canvas is larger than the viewport on both axes and the only
// interaction is free 2D panning. Pinch-zoom is intentionally absent: the
// brief is a "fixed-zoom wall plane that can be freely panned."
const FIXED_SCALE = 1;
// Progressive (iOS-style) overscroll. Near the edge the rubber band gives at
// slope RUBBER_BAND_COEFF (0.35 — firmer than the old linear 0.4), then
// stiffens the further you pull, asymptotically capping the pull at
// RUBBER_BAND_MAX_FRACTION of the viewport. So however hard or fast the drag,
// the wall can never be dragged more than ~8% of the screen past its edge —
// tuned deliberately firm so a normal pull visibly resists. See progressiveGive().
const RUBBER_BAND_COEFF = 0.35;
const RUBBER_BAND_MAX_FRACTION = 0.08;
const TAP_MAX_DISTANCE = 10;

// On web we intentionally skip the Reanimated Babel plugin (see
// babel.config.js — v4 worklets need a native runtime). That means gesture
// callbacks can't be UI-thread worklets there; .runOnJS(true) is the
// explicit acknowledgement gesture-handler wants. On native, we keep the
// default (UI-thread worklets) so jitter-free panning keeps working.
const RUN_GESTURE_ON_JS = Platform.OS === 'web';

// Edge snap-back tuning. SNAP_SPRING is a firm, quick spring used when the wall
// is released while overscrolled — a decisive "lock back into place". Its
// overshoot resolves the OVERSCROLLED axis back toward the clamped edge, i.e.
// into the wall, never out into empty space. SNAP_RUBBER_FACTOR is the firmer
// overshoot return for a momentum flick that carries past an edge.
const SNAP_SPRING = {
  damping: 24,
  stiffness: 280,
  mass: 0.6,
};
const SNAP_RUBBER_FACTOR = 0.1;

// Repositioning animations use withTiming (monotonic — never overshoots its
// target), so a relayout clamp or a refresh shuffle can NEVER momentarily
// expose empty space the way an underdamped spring could.
const REPOSITION_DURATION = 280; // ms — relayout clamp back into new bounds
const SHUFFLE_DURATION = 480; // ms — glide to a random spot on refresh

/**
 * Free-pan canvas for the mural — a large fixed-zoom poster wall.
 *
 * Interaction: pan (drag) in any direction + tap. A flick keeps gliding
 * (momentum) and rubber-stops at the wall edges, so the plane reads as a
 * space you roam rather than a carousel you swipe. There is no zoom: the wall
 * sits at a fixed scale where posters are Figma-sized, and the canvas (from
 * useMuralLayout) is naturally bigger than the viewport in BOTH axes — that's
 * what makes the 2D exploration work.
 *
 * Bounds are a SINGLE SOURCE OF TRUTH held in shared values (canvasW/H, vpW/H)
 * that the pan gesture reads LIVE at event time. The gesture is built ONCE with
 * a stable identity and never recaptures dimensions, so it can never run
 * against stale bounds — that race (the wall going live a frame before its
 * bounds settled) was the "first drag drifts, second drag locks in" bug. When
 * the canvas exceeds the viewport, translate is clamped so the canvas edges
 * align with the viewport edges (max = 0, min = viewport − canvas). When it
 * fits inside the viewport (a tiny filtered set), translate locks to centre.
 * During an active drag, exceeding bounds applies progressive rubber-band
 * resistance; on release the wall springs/decays back into bounds.
 *
 * Initial framing: the wall is centred the instant real bounds exist (the
 * bounds-sync effect), not via useSharedValue's one-shot initialiser — that
 * initialiser captured first-render dims and never re-synced.
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
  shuffleToken = 0,
}: MuralCanvasProps) {
  const { posters, canvasWidth, canvasHeight } = layout;

  // Pan position. Seeded to the mount-time centre (mount only happens once
  // bounds are ready, so this is correct and avoids a top-left flash) and then
  // owned by the bounds-sync effect below, which re-centres on first valid
  // bounds and clamps on every later relayout.
  const translateX = useSharedValue(centerOf(viewportWidth, canvasWidth, FIXED_SCALE));
  const translateY = useSharedValue(
    centerOf(viewportHeight, canvasHeight, FIXED_SCALE)
  );
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  // `scale` is held at FIXED_SCALE for the canvas's life — it never mutates,
  // but stays a shared value so the tap math reads it uniformly.
  const scale = useSharedValue(FIXED_SCALE);

  // Bounds inputs as shared values = the single source of truth the gesture
  // reads LIVE. Seeded from the current props and kept in sync by the effect.
  const canvasW = useSharedValue(canvasWidth);
  const canvasH = useSharedValue(canvasHeight);
  const vpW = useSharedValue(viewportWidth);
  const vpH = useSharedValue(viewportHeight);

  // Canvas opacity, used to fade-dip during filter-driven layout changes.
  const canvasOpacity = useSharedValue(1);

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

  // ─── Bounds sync + initial centre + relayout clamp ───────────────────────
  // Runs whenever the wall or viewport is (re)measured. This is the ONLY place
  // the pan position is corrected for geometry; the gesture reads the same
  // shared values live, so the two can never disagree.
  const hasCenteredRef = useRef(false);
  const prevCanvasRef = useRef<{ w: number; h: number } | null>(null);
  useEffect(() => {
    // Push the latest dims into the shared values the gesture reads live.
    canvasW.value = canvasWidth;
    canvasH.value = canvasHeight;
    vpW.value = viewportWidth;
    vpH.value = viewportHeight;

    const ready =
      canvasWidth > 0 &&
      canvasHeight > 0 &&
      viewportWidth > 0 &&
      viewportHeight > 0;
    if (!ready) return;

    const x = boundsFor(viewportWidth, canvasWidth, FIXED_SCALE);
    const y = boundsFor(viewportHeight, canvasHeight, FIXED_SCALE);

    if (!hasCenteredRef.current) {
      // First valid bounds → frame the centre of the wall immediately, no
      // animation (and so no overshoot), so the wall is correctly positioned
      // and fully clamped before the first possible touch.
      translateX.value = centerOf(viewportWidth, canvasWidth, FIXED_SCALE);
      translateY.value = centerOf(viewportHeight, canvasHeight, FIXED_SCALE);
      hasCenteredRef.current = true;
      prevCanvasRef.current = { w: canvasWidth, h: canvasHeight };
      return;
    }

    // Later relayout (filter / refetch reshaped the wall): clamp the current
    // position into the new bounds with a MONOTONIC glide — withTiming never
    // overshoots, so this can't briefly expose empty space.
    translateX.value = withTiming(clampJS(translateX.value, x.min, x.max), {
      duration: REPOSITION_DURATION,
    });
    translateY.value = withTiming(clampJS(translateY.value, y.min, y.max), {
      duration: REPOSITION_DURATION,
    });

    const prev = prevCanvasRef.current;
    const sameShape = prev && prev.w === canvasWidth && prev.h === canvasHeight;
    if (prev && !sameShape) {
      canvasOpacity.value = withTiming(0.25, { duration: 140 }, () => {
        canvasOpacity.value = withTiming(1, { duration: 220 });
      });
    }
    prevCanvasRef.current = { w: canvasWidth, h: canvasHeight };
    // Reanimated shared values are intentionally NOT in the dep list — they
    // don't trigger React renders and including them would force-recreate the
    // effect on every gesture tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasWidth, canvasHeight, viewportWidth, viewportHeight]);

  // ─── Refresh "shuffle" ───────────────────────────────────────────────────
  // Glide to a random position GUARANTEED inside the current bounds. Skips the
  // initial mount (token unchanged) and waits until the wall has been centred.
  const prevShuffleRef = useRef(shuffleToken);
  useEffect(() => {
    if (shuffleToken === prevShuffleRef.current) return;
    prevShuffleRef.current = shuffleToken;
    if (!hasCenteredRef.current) return;
    const x = boundsFor(viewportWidth, canvasWidth, FIXED_SCALE);
    const y = boundsFor(viewportHeight, canvasHeight, FIXED_SCALE);
    // min + rand·(max − min) is always within [min, max]; when an axis is
    // locked (canvas ≤ viewport) min === max so that axis simply stays put.
    const tx = x.min + Math.random() * (x.max - x.min);
    const ty = y.min + Math.random() * (y.max - y.min);
    translateX.value = withTiming(tx, { duration: SHUFFLE_DURATION });
    translateY.value = withTiming(ty, { duration: SHUFFLE_DURATION });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffleToken]);

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
  // Bounds are read live from the shared values, same as the pan gesture.
  const viewportRef = useRef<View | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = viewportRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const onWheel = (e: WheelEvent) => {
      // Pan only. Hard-clamp to bounds: wheel events are discrete with no
      // "release" to spring back from, so a clamp matches Maps / Figma.
      e.preventDefault();
      if (vpW.value <= 0 || canvasW.value <= 0) return;
      const xB = boundsFor(vpW.value, canvasW.value, scale.value);
      const yB = boundsFor(vpH.value, canvasH.value, scale.value);
      translateX.value = clampJS(translateX.value - e.deltaX, xB.min, xB.max);
      translateY.value = clampJS(translateY.value - e.deltaY, yB.min, yB.max);
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
    // Shared values are read at fire time, so this listener never needs
    // re-subscribing — attach once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Built ONCE — reads canvas/viewport bounds live from shared values, so it
  // never needs rebuilding when the wall is (re)measured. Stable identity means
  // GestureDetector never re-binds mid-touch, so the very first drag is always
  // clamped against the correct, current bounds.
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
        })
        .onUpdate((e) => {
          // Gate: never act on uninitialised bounds.
          if (vpW.value <= 0 || canvasW.value <= 0) return;
          const newX = savedTranslateX.value + e.translationX;
          const newY = savedTranslateY.value + e.translationY;
          const xBounds = boundsForWorklet(vpW.value, canvasW.value, scale.value);
          const yBounds = boundsForWorklet(vpH.value, canvasH.value, scale.value);
          // Pull past the wall edges with progressive rubber-band resistance —
          // the further you drag the stiffer it gets, hard-capped at ~8% of the
          // viewport so you can't wander far out. A brief peek of the white
          // backdrop at the edge is the intended "you've hit a limit" cue.
          translateX.value = rubberBand(newX, xBounds.min, xBounds.max, vpW.value);
          translateY.value = rubberBand(newY, yBounds.min, yBounds.max, vpH.value);
        })
        .onEnd((e) => {
          if (vpW.value <= 0 || canvasW.value <= 0) return;
          const xBounds = boundsForWorklet(vpW.value, canvasW.value, scale.value);
          const yBounds = boundsForWorklet(vpH.value, canvasH.value, scale.value);
          const xClamped = Math.max(
            xBounds.min,
            Math.min(xBounds.max, translateX.value)
          );
          const yClamped = Math.max(
            yBounds.min,
            Math.min(yBounds.max, translateY.value)
          );
          // Snap-back has two regimes, chosen per axis:
          //  • Released while overscrolled past an edge → spring straight home
          //    with a firm, quick spring (SNAP_SPRING). Its overshoot resolves
          //    back toward the edge, i.e. into the wall — never out to white.
          //  • Released in-bounds → withDecay glides with momentum and clamps;
          //    a flick reaching an edge overshoots a touch then springs back,
          //    firm (rubberBandFactor SNAP_RUBBER_FACTOR).
          if (translateX.value !== xClamped) {
            translateX.value = withSpring(xClamped, SNAP_SPRING);
          } else {
            translateX.value = withDecay({
              velocity: e.velocityX,
              clamp: [xBounds.min, xBounds.max],
              rubberBandEffect: true,
              rubberBandFactor: SNAP_RUBBER_FACTOR,
            });
          }
          if (translateY.value !== yClamped) {
            translateY.value = withSpring(yClamped, SNAP_SPRING);
          } else {
            translateY.value = withDecay({
              velocity: e.velocityY,
              clamp: [yBounds.min, yBounds.max],
              rubberBandEffect: true,
              rubberBandFactor: SNAP_RUBBER_FACTOR,
            });
          }
        })
        .runOnJS(RUN_GESTURE_ON_JS),
    // Stable identity: bounds come from shared values read live, so no geometry
    // deps. Shared values / refs are excluded — read at event time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
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

// Worklet-prefixed variant — Reanimated requires the directive on every
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

// iOS-style progressive overscroll. `offset` is the distance dragged past an
// edge; the returned give starts at slope RUBBER_BAND_COEFF and asymptotes to
// `limit` (= RUBBER_BAND_MAX_FRACTION × viewport) as offset → ∞, so the wall can
// never be pulled more than `limit` past its edge however hard you drag.
function progressiveGive(offset: number, limit: number) {
  'worklet';
  return (1 - 1 / ((offset * RUBBER_BAND_COEFF) / limit + 1)) * limit;
}

function rubberBand(v: number, lo: number, hi: number, dim: number) {
  'worklet';
  const limit = dim * RUBBER_BAND_MAX_FRACTION;
  if (v < lo) return lo - progressiveGive(lo - v, limit);
  if (v > hi) return hi + progressiveGive(v - hi, limit);
  return v;
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: colors.white,
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
    // children. The viewport keeps the white backdrop while panning.
  },
});
