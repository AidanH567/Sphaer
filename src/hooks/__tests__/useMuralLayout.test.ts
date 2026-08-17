import { computeMuralLayout } from '@/hooks/useMuralLayout';
import type { PosterSize } from '@/context/AppContext';
import type { EventWithRelations } from '@/types/event.types';

/**
 * Geometry contract for the Mural wall.
 *
 * These are the properties that make the wall feel like a wall rather than a
 * ragged pile — the regressions that produced "lots of blank white screen"
 * and "the edges don't seem very defined" were all violations of one of them:
 *
 *   1. Every row ends flush at the same right edge (no ragged staircase).
 *   2. Gutters are one consistent value everywhere.
 *   3. The canvas rectangle is (almost) entirely posters — the only non-poster
 *      pixels are gutters and the frame margin.
 *   4. The canvas is bigger than the viewport on BOTH axes, so the wall always
 *      covers the screen and there is never empty space to pan into.
 *   5. Every event appears at least once.
 */

const VIEWPORT = { width: 390, height: 611 }; // iPhone 13/14 mural slot

function makeEvent(id: string): EventWithRelations {
  return {
    id,
    creator_id: `creator-${id}`,
    circle_id: null,
    title: id,
    description: null,
    location_name: null,
    address: null,
    lat: null,
    lng: null,
    starts_at: '2026-05-01T18:00:00',
    ends_at: null,
    categories: [],
    poster_url: `https://example.test/posters/${id}.webp`,
    ticket_url: null,
    is_free: true,
    price: null,
    created_at: '2026-04-01T00:00:00',
  } as unknown as EventWithRelations;
}

/** Portrait-ish poster sizes with some landscape mixed in, like the seed set. */
function makeSet(n: number) {
  const shapes: [number, number][] = [
    [800, 1133],
    [1024, 749],
    [896, 1152],
    [572, 1024],
    [2528, 1686],
    [1024, 1024],
  ];
  const events: EventWithRelations[] = [];
  const dimensions = new Map<string, PosterSize>();
  for (let i = 0; i < n; i++) {
    const e = makeEvent(`evt-${i}`);
    events.push(e);
    const [w, h] = shapes[i % shapes.length];
    dimensions.set(e.poster_url as string, { width: w, height: h });
  }
  return { events, dimensions };
}

function layoutFor(n: number) {
  const { events, dimensions } = makeSet(n);
  return {
    events,
    layout: computeMuralLayout({
      events,
      dimensions,
      screenWidth: VIEWPORT.width,
      screenHeight: VIEWPORT.height,
    }),
  };
}

/** Group posters into rows by their y coordinate. */
function rowsOf(posters: { x: number; y: number; width: number; height: number }[]) {
  const byY = new Map<number, typeof posters>();
  for (const p of posters) {
    const key = Math.round(p.y * 100) / 100;
    const bucket = byY.get(key);
    if (bucket) bucket.push(p);
    else byY.set(key, [p]);
  }
  return [...byY.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => [...row].sort((a, b) => a.x - b.x));
}

describe('computeMuralLayout', () => {
  describe.each([1, 3, 11, 50, 120])('with %i events', (n) => {
    const { events, layout } = layoutFor(n);
    const rows = rowsOf(layout.posters);

    it('renders every event at least once', () => {
      const shown = new Set(layout.posters.map((p) => p.event.id));
      for (const e of events) expect(shown.has(e.id)).toBe(true);
    });

    it('gives every poster a unique key', () => {
      const keys = layout.posters.map((p) => p.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('ends every row flush at the same right edge', () => {
      const rightEdges = rows.map((row) => {
        const last = row[row.length - 1];
        return last.x + last.width;
      });
      const spread = Math.max(...rightEdges) - Math.min(...rightEdges);
      // Sub-pixel only — the old greedy packer left a 138px ragged staircase.
      expect(spread).toBeLessThan(0.5);
    });

    it('starts every row at the same left edge', () => {
      const lefts = rows.map((row) => row[0].x);
      expect(Math.max(...lefts) - Math.min(...lefts)).toBeLessThan(0.5);
    });

    it('uses one consistent gutter between posters', () => {
      const gaps: number[] = [];
      for (const row of rows) {
        for (let i = 1; i < row.length; i++) {
          gaps.push(row[i].x - (row[i - 1].x + row[i - 1].width));
        }
      }
      for (const g of gaps) expect(g).toBeCloseTo(8, 5);
    });

    it('uses the same gutter between rows', () => {
      const gaps: number[] = [];
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1][0];
        gaps.push(rows[i][0].y - (prev.y + prev.height));
      }
      for (const g of gaps) expect(g).toBeCloseTo(8, 5);
    });

    it('is bigger than the viewport on both axes', () => {
      expect(layout.canvasWidth).toBeGreaterThan(VIEWPORT.width);
      expect(layout.canvasHeight).toBeGreaterThan(VIEWPORT.height);
    });

    it('fills the canvas — poster area is ~all of it', () => {
      const posterArea = layout.posters.reduce(
        (sum, p) => sum + p.width * p.height,
        0
      );
      const canvasArea = layout.canvasWidth * layout.canvasHeight;
      // The remainder is gutters + the frame margin, nothing else. The old
      // packer bottomed out around 0.82 with a full empty row at the end.
      // (A one-event wall is the floor: its posters are small, so gutters
      // are a bigger share of the canvas.)
      expect(posterArea / canvasArea).toBeGreaterThan(n === 1 ? 0.88 : 0.9);
    });

    it('keeps every poster inside the canvas', () => {
      for (const p of layout.posters) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.width).toBeLessThanOrEqual(layout.canvasWidth + 0.01);
        expect(p.y + p.height).toBeLessThanOrEqual(layout.canvasHeight + 0.01);
      }
    });

    it('never overlaps two posters in the same row', () => {
      for (const row of rows) {
        for (let i = 1; i < row.length; i++) {
          expect(row[i].x).toBeGreaterThanOrEqual(
            row[i - 1].x + row[i - 1].width - 0.01
          );
        }
      }
    });
  });

  it('recycles heavily for a sparse set and barely at all for a full one', () => {
    const small = layoutFor(3).layout;
    const large = layoutFor(120).layout;
    // A 3-event wall is almost entirely repeats.
    expect(small.recycledCount).toBeGreaterThan(small.posters.length / 2);
    // A full set only recycles enough to finish the bottom row — under one
    // row's worth, not a second pass over the set.
    const perRow = large.posters.length / large.bandCount;
    expect(large.recycledCount).toBeLessThan(perRow);
  });

  it.each([6, 7, 11, 20])(
    'never repeats an event within a row (%i events)',
    (n) => {
      const { layout } = layoutFor(n);
      for (const row of rowsOf(layout.posters)) {
        const ids = row.map(
          (p) => (p as unknown as { event: { id: string } }).event.id
        );
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  );

  it('shows a single event on the whole wall without crashing', () => {
    const { layout } = layoutFor(1);
    expect(layout.posters.length).toBeGreaterThan(10);
    expect(new Set(layout.posters.map((p) => p.event.id)).size).toBe(1);
  });

  it('falls back to a poster-shaped slot when dimensions are unknown', () => {
    const { events } = makeSet(20);
    const layout = computeMuralLayout({
      events,
      dimensions: new Map(),
      screenWidth: VIEWPORT.width,
      screenHeight: VIEWPORT.height,
    });
    expect(layout.posters.length).toBeGreaterThan(0);
    for (const p of layout.posters) {
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
    }
  });

  it('returns a viewport-sized empty canvas for no events', () => {
    const layout = computeMuralLayout({
      events: [],
      dimensions: new Map(),
      screenWidth: VIEWPORT.width,
      screenHeight: VIEWPORT.height,
    });
    expect(layout.posters).toHaveLength(0);
    expect(layout.canvasWidth).toBe(VIEWPORT.width);
    expect(layout.canvasHeight).toBe(VIEWPORT.height);
  });

  it('clamps a panoramic poster so it cannot swallow a row', () => {
    const events = [makeEvent('evt-pano')];
    const dimensions = new Map<string, PosterSize>([
      [events[0].poster_url as string, { width: 8000, height: 500 }],
    ]);
    const layout = computeMuralLayout({
      events,
      dimensions,
      screenWidth: VIEWPORT.width,
      screenHeight: VIEWPORT.height,
    });
    for (const p of layout.posters) {
      // MAX_ASPECT 1.9 × the row height, plus the justification stretch.
      expect(p.width / p.height).toBeLessThan(2.6);
    }
  });
});
