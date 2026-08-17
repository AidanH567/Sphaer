import { useMemo } from 'react';
import type { PosterSize } from '@/context/AppContext';
import type { EventWithRelations } from '@/types/event.types';
import { spacing } from '@/constants/theme';

export interface PosterRect {
  /**
   * Stable React key. NOT the event id — the wall may show the same event in
   * more than one slot when the filtered set is too small to fill the canvas
   * (see "Recycling" below), and duplicate keys would make React drop siblings.
   */
  key: string;
  event: EventWithRelations;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MuralLayout {
  posters: PosterRect[];
  /** Target row height before per-row justification scaling. */
  bandHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  /** Number of justified rows on the wall. */
  bandCount: number;
  /** How many slots are repeats of an earlier slot (0 when the set fills the wall). */
  recycledCount: number;
}

interface UseMuralLayoutArgs {
  events: EventWithRelations[];
  dimensions: Map<string, PosterSize>;
  screenWidth: number;
  screenHeight: number;
}

// Aspect-ratio clamps keep extreme uploads from breaking the row rhythm.
// 0.5 → 1.9 spans "tall club flyer" to "wide banner" without letting one
// panoramic image swallow a whole row.
const MIN_ASPECT = 0.5;
const MAX_ASPECT = 1.9;
/** ISO/A-series poster ratio — what an unmeasured poster is assumed to be. */
const FALLBACK_ASPECT = 0.707;

/**
 * Target row height in viewport px at the wall's fixed zoom. The Figma Mural
 * frames show bold, near-magazine-sized posters — ~2–3 across on a 390pt
 * phone — not thumbnails. Per-row justification scales this by roughly
 * ±20% so every row ends flush with the wall edge.
 */
const TARGET_ROW_HEIGHT = 200;

/** Gap between posters and between rows. One token, used on both axes. */
const GUTTER = spacing.sm;
/** Margin of wall surface around the whole poster block — the wall's frame. */
const FRAME = spacing.sm;

/**
 * The wall must be bigger than the viewport on BOTH axes or there is nothing
 * to roam. 1.6 viewports is enough travel to feel like a wall while keeping
 * the poster count (and so the number of mounted images) low.
 */
const MIN_ROAM = 1.6;
/** Hard ceiling on mounted posters. Bounds worst-case memory / composite cost. */
const MAX_SLOTS = 160;

/**
 * Compute the 2D layout for the Mural canvas — a justified poster wall.
 *
 * ## Justified rows (why there are no blank patches)
 *
 * Posters are packed left→right into rows at TARGET_ROW_HEIGHT, then each row
 * is scaled so its posters + gutters add up to EXACTLY the wall width. Every
 * row therefore ends flush at the same x, and the canvas is a true filled
 * rectangle: `canvasWidth × canvasHeight` contains no region that isn't either
 * a poster or one GUTTER of wall surface.
 *
 * The previous algorithm packed rows greedily to a *target* width and then set
 * `canvasWidth = widest row`, so every other row trailed off with up to a full
 * poster-width of empty canvas — the ragged white staircase down the right
 * edge. Justification removes that class of hole entirely.
 *
 * The break point for each row is chosen to keep the justification scale as
 * close to 1 as possible (compare the row with and without the next poster,
 * keep whichever needs less stretching), so posters stay near their intended
 * size instead of being rubber-stretched to fit.
 *
 * ## Recycling (why the wall is full even with few posters)
 *
 * A wall must be at least MIN_ROAM viewports on both axes or panning is
 * pointless and the canvas would have to be letterboxed in white. When the
 * event set is too small for that, slots beyond the set repeat it. The rule:
 *
 *   - The first `n` slots are the events in caller order (newest first), so a
 *     full set reads chronologically left→right, top→bottom and repeats nothing.
 *   - Past that, a rotating cursor takes the next event **that is not already
 *     in the row being built**, so a repeat never lands beside itself. Each new
 *     row additionally advances the cursor by `floor(n/3) + 1`, so the second
 *     pass over the set is offset rather than a copy of the first stacked
 *     underneath.
 *   - Only a wall whose rows are longer than the whole set (1–3 events) can
 *     show the same poster twice in one row; there is nothing else to show.
 *
 * The last row is always packed full, so even a complete set usually recycles a
 * few slots to finish the bottom row rather than leaving it ragged.
 * `recycledCount` reports how many slots are repeats.
 *
 * ## Canvas proportions
 *
 * The wall width is picked so the canvas roughly matches the viewport's aspect
 * ratio (`sqrt(area × vpW / vpH)`), clamped to at least MIN_ROAM viewports and
 * at least one poster wide. That keeps travel comparable on both axes instead
 * of the old "very wide, barely tall" (or vice versa) wall.
 *
 * Pure function — memoised on input identity.
 */
export function useMuralLayout({
  events,
  dimensions,
  screenWidth,
  screenHeight,
}: UseMuralLayoutArgs): MuralLayout {
  return useMemo(
    () => computeMuralLayout({ events, dimensions, screenWidth, screenHeight }),
    [events, dimensions, screenWidth, screenHeight]
  );
}

/** Exported for tests — the hook is a thin memo around this. */
export function computeMuralLayout({
  events,
  dimensions,
  screenWidth,
  screenHeight,
}: UseMuralLayoutArgs): MuralLayout {
  const vpW = Math.max(1, screenWidth);
  const vpH = Math.max(1, screenHeight);

  if (events.length === 0) {
    return {
      posters: [],
      bandHeight: TARGET_ROW_HEIGHT,
      canvasWidth: vpW,
      canvasHeight: vpH,
      bandCount: 0,
      recycledCount: 0,
    };
  }

  const n = events.length;

  // Natural (unjustified) width of each event's poster at TARGET_ROW_HEIGHT.
  const naturalWidths = events.map((e) => {
    const dim = e.poster_url ? dimensions.get(e.poster_url) : undefined;
    const rawAspect =
      dim && dim.height > 0 ? dim.width / dim.height : FALLBACK_ASPECT;
    return TARGET_ROW_HEIGHT * clamp(rawAspect, MIN_ASPECT, MAX_ASPECT);
  });
  const widestPoster = Math.max(...naturalWidths);
  const naturalTotalWidth = naturalWidths.reduce((sum, w) => sum + w, 0);

  // ─── Wall width ─────────────────────────────────────────────────────────
  // Area the real set occupies, then the width that makes the wall's aspect
  // ratio match the viewport's. Clamped so the wall is always at least
  // MIN_ROAM viewports wide and always wide enough for its widest poster.
  const naturalArea = naturalTotalWidth * TARGET_ROW_HEIGHT;
  const aspectMatchedWidth = Math.sqrt((naturalArea * vpW) / vpH);
  const contentWidth = Math.max(
    aspectMatchedWidth,
    MIN_ROAM * vpW - 2 * FRAME,
    widestPoster
  );

  // Never drop an event; only recycling is capped.
  const slotCeiling = Math.max(n, MAX_SLOTS);
  // The wall must reach this height for MIN_ROAM vertical travel.
  const requiredContentHeight = MIN_ROAM * vpH - 2 * FRAME;

  // ─── Slot → event, with recycling ───────────────────────────────────────
  // The first n slots are the events in caller order, so the wall still reads
  // newest-first left to right. Beyond that, a rotating cursor picks the next
  // event that is NOT already in the row being built — so a repeat never
  // lands beside itself. `rowRotation` shifts where each recycled row starts
  // so the second pass isn't a carbon copy of the first stacked underneath.
  let placed = 0;
  let cursor = 0;
  let rowRotation = 0;
  const nextEventIndex = (rowSoFar: Set<number>): number => {
    if (placed < n) return placed;
    for (let k = 0; k < n; k++) {
      const candidate = (cursor + k) % n;
      if (!rowSoFar.has(candidate)) {
        cursor = (candidate + 1) % n;
        return candidate;
      }
    }
    // Row is longer than the whole set (a 1–3 event wall) — unavoidable repeat.
    const fallback = cursor % n;
    cursor = (cursor + 1) % n;
    return fallback;
  };

  // ─── Pack + justify, row by row, until the wall is full ─────────────────
  // Rows are emitted one at a time: fill greedily to contentWidth, choose the
  // break that needs the least stretching, then scale the row so it ends
  // EXACTLY at the wall edge. Keep emitting rows until every event has been
  // placed at least once AND the wall is tall enough to roam.
  const posters: PosterRect[] = [];
  let y = FRAME;
  let rowCount = 0;

  for (;;) {
    // -- choose this row's posters --
    // No slot ceiling inside a row: the ceiling is enforced at row boundaries
    // only, so the final row is always packed full rather than left with one
    // poster stretched across the whole wall.
    const row: { eventIndex: number; slot: number }[] = [];
    const rowSoFar = new Set<number>();
    let posterWidthSum = 0;
    for (;;) {
      const eventIndex = nextEventIndex(rowSoFar);
      const w = naturalWidths[eventIndex];
      const widthWith = posterWidthSum + w + row.length * GUTTER;
      const accept = () => {
        row.push({ eventIndex, slot: placed });
        rowSoFar.add(eventIndex);
        posterWidthSum += w;
        placed += 1;
      };
      if (row.length > 0 && widthWith > contentWidth) {
        const widthWithout = posterWidthSum + (row.length - 1) * GUTTER;
        // Distance from a perfect fit either way; lower stretch wins.
        const errWithout = Math.abs(contentWidth / widthWithout - 1);
        const errWith = Math.abs(contentWidth / widthWith - 1);
        if (errWithout > errWith) accept();
        break;
      }
      accept();
    }
    if (row.length === 0) break;

    // -- justify --
    const gutterSum = (row.length - 1) * GUTTER;
    const available = contentWidth - gutterSum;
    const scale =
      available > 0 && posterWidthSum > 0 ? available / posterWidthSum : 1;
    const rowHeight = TARGET_ROW_HEIGHT * scale;

    let x = FRAME;
    for (let i = 0; i < row.length; i++) {
      const { eventIndex, slot } = row[i];
      // The last poster absorbs floating-point residue so the row ends
      // EXACTLY at the wall edge — the guarantee the tests assert on.
      const isLast = i === row.length - 1;
      const width = isLast
        ? FRAME + contentWidth - x
        : naturalWidths[eventIndex] * scale;
      posters.push({
        key: `${events[eventIndex].id}#${slot}`,
        event: events[eventIndex],
        x,
        y,
        width,
        height: rowHeight,
      });
      x += width + GUTTER;
    }

    y += rowHeight + GUTTER;
    rowCount += 1;
    // Shift where the next recycled row starts, so pass 2 of the set doesn't
    // stack up as a visible copy of pass 1.
    rowRotation += Math.floor(n / 3) + 1;
    cursor = (cursor + rowRotation) % n;

    const placedEveryEvent = placed >= n;
    const tallEnough = y - GUTTER - FRAME >= requiredContentHeight;
    if (placedEveryEvent && tallEnough) break;
    if (placed >= slotCeiling) break;
  }

  const recycledCount = Math.max(0, placed - n);
  // Last row contributes no trailing gutter.
  const contentHeight = rowCount > 0 ? y - GUTTER - FRAME : 0;

  return {
    posters,
    bandHeight: TARGET_ROW_HEIGHT,
    canvasWidth: contentWidth + 2 * FRAME,
    canvasHeight: contentHeight + 2 * FRAME,
    bandCount: rowCount,
    recycledCount,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
