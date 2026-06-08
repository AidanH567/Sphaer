import { useMemo } from 'react';
import type { PosterSize } from '@/context/AppContext';
import type { EventWithRelations } from '@/types/event.types';

export interface PosterRect {
  event: EventWithRelations;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MuralLayout {
  posters: PosterRect[];
  bandHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  bandCount: number;
}

interface UseMuralLayoutArgs {
  events: EventWithRelations[];
  dimensions: Map<string, PosterSize>;
  screenWidth: number;
  screenHeight: number;
}

// Aspect-ratio clamps keep extreme uploads from breaking the band rhythm:
// 0.4×bandH → 2.0×bandH is wide enough for varied portrait↔landscape feel
// without letting one panoramic banner dominate a row. Mirrors the Figma
// where every poster is recognizably "thumbnail-sized" relative to its band.
const MIN_ASPECT = 0.4;
const MAX_ASPECT = 2.0;
const FALLBACK_ASPECT = 2 / 3; // 2:3 portrait — matches dimensions fallback

/**
 * Compute the 2D brick layout for the Mural canvas.
 *
 * Algorithm:
 * 1. Decide a band count N ≈ ceil(sqrt(events / 2)) — keeps canvas roughly
 *    square as the event count grows (50 events → 5 bands; 200 → 10).
 * 2. Each poster's width = bandHeight × clampedAspectRatio.
 * 3. Greedily pack posters left→right into the current band until the band
 *    reaches the target width (totalContentWidth / N), then start the next
 *    band. Gives roughly equal-width bands without a real bin-packer.
 * 4. Canvas width = widest band's total width (other bands may end short —
 *    the visible empty space at the band ends is acceptable wall texture).
 * 5. Canvas height = N × bandHeight.
 *
 * Pure function — no side effects, memoised on input identity. Re-runs when
 * the filtered event set changes or when the dimensions map gains entries.
 */
export function useMuralLayout({
  events,
  dimensions,
  screenWidth,
  screenHeight,
}: UseMuralLayoutArgs): MuralLayout {
  // Dimensions map identity is the cheap-to-compare signal; the layout
  // itself reads it inside the memo. Size + events identity covers the
  // "new poster resolved" and "filter changed" cases.
  return useMemo(
    () => computeLayout({ events, dimensions, screenWidth, screenHeight }),
    [events, dimensions, screenWidth, screenHeight]
  );
}

function computeLayout({
  events,
  dimensions,
  screenWidth,
  screenHeight,
}: UseMuralLayoutArgs): MuralLayout {
  const bandHeight = screenHeight / 2;

  if (events.length === 0) {
    return {
      posters: [],
      bandHeight,
      canvasWidth: screenWidth,
      canvasHeight: screenHeight,
      bandCount: 0,
    };
  }

  // Pass 1: measure each poster's width using its clamped aspect ratio.
  const widths = events.map((e) => {
    const dim = e.poster_url ? dimensions.get(e.poster_url) : undefined;
    const rawAspect = dim ? dim.width / dim.height : FALLBACK_ASPECT;
    const aspect = clamp(rawAspect, MIN_ASPECT, MAX_ASPECT);
    return bandHeight * aspect;
  });

  const totalWidth = widths.reduce((sum, w) => sum + w, 0);
  const bandCount = Math.max(1, Math.ceil(Math.sqrt(events.length / 2)));
  const targetBandWidth = totalWidth / bandCount;

  // Pass 2: greedy band-packing. Events are already in caller-supplied order
  // (newest first from the screen) so the wall reads chronologically along
  // each band from left to right.
  const posters: PosterRect[] = [];
  let bandIndex = 0;
  let bandCursorX = 0;
  let maxBandWidth = 0;

  for (let i = 0; i < events.length; i++) {
    const w = widths[i];

    // Move to next band when adding this poster would noticeably exceed
    // the target. The "noticeably" tolerance lets the last poster in a
    // band overshoot a bit rather than starting an almost-empty new band.
    const overshoot = bandCursorX + w - targetBandWidth;
    if (
      bandCursorX > 0 &&
      bandIndex < bandCount - 1 &&
      overshoot > w * 0.5
    ) {
      maxBandWidth = Math.max(maxBandWidth, bandCursorX);
      bandIndex += 1;
      bandCursorX = 0;
    }

    posters.push({
      event: events[i],
      x: bandCursorX,
      y: bandIndex * bandHeight,
      width: w,
      height: bandHeight,
    });
    bandCursorX += w;
  }
  maxBandWidth = Math.max(maxBandWidth, bandCursorX);

  // Canvas is at least screen-sized so single-event filters still pan.
  const canvasWidth = Math.max(maxBandWidth, screenWidth);
  const canvasHeight = Math.max(
    (bandIndex + 1) * bandHeight,
    screenHeight
  );

  return {
    posters,
    bandHeight,
    canvasWidth,
    canvasHeight,
    bandCount: bandIndex + 1,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
