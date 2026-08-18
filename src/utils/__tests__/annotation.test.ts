/**
 * The annotation geometry.
 *
 * The risk this file exists to cover is the two renderers DRIFTING — the
 * preview the reporter draws on and the full-resolution canvas that gets
 * flattened and sent. If those disagree, the feature fails in the worst
 * possible way: the reporter circles the broken padding, sees a correct
 * preview, and the designer receives a circle round something else. Nothing
 * about that failure is visible from the file (right size, right format, real
 * strokes) — it is "valid file, wrong content" again.
 *
 * The defence is that neither renderer computes a coordinate: both call
 * `strokeToPathData` with their own dimensions. So the property asserted here,
 * repeatedly and from several angles, is SCALE INVARIANCE — the same stroke
 * describes the same relative shape at 340px and at 1170px.
 */

import {
  ANNOTATION_STROKE_RATIO,
  AnnotationError,
  CAPTURE_FIDELITY_MIN,
  FIDELITY_TRANSPARENT_ALPHA,
  assertCaptureFidelity,
  compareAlphaGrids,
  appendPoint,
  assertAnnotationBoxIsUntransformed,
  dropLastStroke,
  fitContain,
  hasInk,
  MIN_POINT_DISTANCE,
  MIN_STROKE_WIDTH_PX,
  strokeToPathData,
  strokeWidthFor,
  toNormalizedPoint,
  type AnnotationStroke,
} from '@/utils/annotation';

const strokeOf = (points: [number, number][], color = '#FF1E1E'): AnnotationStroke => ({
  color,
  points: points.map(([x, y]) => ({ x, y })),
});

/** Every number in a path string, in order. */
function numbersIn(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

// ─── strokeWidthFor ──────────────────────────────────────────────────────────

describe('strokeWidthFor', () => {
  it('scales with the image rather than being a fixed pixel count', () => {
    // THE bug this constant exists to prevent: a width tuned on the preview is
    // a hairline once flattened into a 3x-density screenshot. The two must
    // differ by the same factor their canvases do.
    const preview = strokeWidthFor(340, 736);
    const full = strokeWidthFor(1170, 2532);
    expect(full / preview).toBeCloseTo(1170 / 340, 5);
  });

  it('gives a genuinely visible stroke on a real phone screenshot', () => {
    // ~7px on an iPhone screenshot. A 2px line there is what "invisible"
    // looks like, and is the reported failure mode this replaces.
    expect(strokeWidthFor(1170, 2532)).toBeCloseTo(1170 * ANNOTATION_STROKE_RATIO, 5);
    expect(strokeWidthFor(1170, 2532)).toBeGreaterThan(5);
  });

  it('measures the SHORTER side, so landscape is not over-inked', () => {
    // Scaling off width alone would make a landscape screenshot's marks about
    // twice as heavy as a portrait one's.
    expect(strokeWidthFor(2532, 1170)).toBe(strokeWidthFor(1170, 2532));
  });

  it('never goes below the floor, however small the source', () => {
    expect(strokeWidthFor(10, 10)).toBe(MIN_STROKE_WIDTH_PX);
    expect(strokeWidthFor(0, 0)).toBe(MIN_STROKE_WIDTH_PX);
    expect(strokeWidthFor(NaN, NaN)).toBe(MIN_STROKE_WIDTH_PX);
  });
});

// ─── toNormalizedPoint ───────────────────────────────────────────────────────

describe('toNormalizedPoint', () => {
  it('maps a touch to its fraction of the view', () => {
    expect(toNormalizedPoint(170, 368, 340, 736)).toEqual({ x: 0.5, y: 0.5 });
    expect(toNormalizedPoint(0, 0, 340, 736)).toEqual({ x: 0, y: 0 });
    expect(toNormalizedPoint(340, 736, 340, 736)).toEqual({ x: 1, y: 1 });
  });

  it('clamps a drag that leaves the image', () => {
    // PanResponder keeps reporting once the finger slides off the edge. Those
    // coordinates must not become marks painted outside the canvas.
    expect(toNormalizedPoint(-50, -50, 340, 736)).toEqual({ x: 0, y: 0 });
    expect(toNormalizedPoint(9999, 9999, 340, 736)).toEqual({ x: 1, y: 1 });
  });

  it('refuses to divide by a zero-sized view', () => {
    expect(toNormalizedPoint(10, 10, 0, 0)).toEqual({ x: 0, y: 0 });
  });
});

// ─── appendPoint ─────────────────────────────────────────────────────────────

describe('appendPoint', () => {
  it('keeps a point that moved far enough to matter', () => {
    const points = [{ x: 0.1, y: 0.1 }];
    const next = appendPoint(points, { x: 0.5, y: 0.5 });
    expect(next).toHaveLength(2);
    expect(next).not.toBe(points);
  });

  it('drops a point too close to the last, returning the SAME array', () => {
    // Identity is the contract, not an implementation detail: the responder
    // skips its setState on reference equality, which is what stops a slow
    // circle re-rendering the canvas hundreds of times.
    const points = [{ x: 0.5, y: 0.5 }];
    const next = appendPoint(points, { x: 0.5 + MIN_POINT_DISTANCE / 4, y: 0.5 });
    expect(next).toBe(points);
  });

  it('always keeps the first point of a stroke', () => {
    expect(appendPoint([], { x: 0.5, y: 0.5 })).toHaveLength(1);
  });

  it('decimates a dense drag hard without losing the shape', () => {
    // 400 move events along a line — what a real slow drag produces.
    let points: { x: number; y: number }[] = [];
    for (let i = 0; i < 400; i++) {
      points = appendPoint(points, { x: i / 400, y: 0.5 });
    }
    expect(points.length).toBeLessThan(400);
    // The endpoints survive, so the line still spans what was drawn.
    expect(points[0].x).toBe(0);
    expect(points[points.length - 1].x).toBeGreaterThan(0.99 - MIN_POINT_DISTANCE);
  });
});

// ─── strokeToPathData ────────────────────────────────────────────────────────

describe('strokeToPathData', () => {
  it('draws a single tap as a dot, not as nothing', () => {
    // `M x y` alone paints no pixels. A tap that drew nothing reads as broken,
    // and users tap to point at things.
    const d = strokeToPathData(strokeOf([[0.5, 0.5]]), 100, 200);
    expect(d).toBe('M 50 100 L 50 100');
  });

  it('draws two points as a straight line', () => {
    expect(strokeToPathData(strokeOf([[0, 0], [1, 1]]), 100, 200)).toBe('M 0 0 L 100 200');
  });

  it('smooths three or more points into curves', () => {
    // A decimated freehand circle rendered as a polyline reads as a clumsy
    // polygon rather than a deliberate mark.
    const d = strokeToPathData(strokeOf([[0, 0], [0.5, 0.5], [1, 1]]), 100, 100);
    expect(d).toContain('Q');
    expect(d.startsWith('M 0 0')).toBe(true);
  });

  it('ends on the point where the finger lifted, not on a midpoint', () => {
    const d = strokeToPathData(
      strokeOf([[0, 0], [0.25, 0.25], [0.5, 0.5], [1, 1]]),
      100,
      100
    );
    expect(d.endsWith('L 100 100')).toBe(true);
  });

  it('returns nothing for an empty stroke', () => {
    expect(strokeToPathData(strokeOf([]), 100, 100)).toBe('');
  });

  // ── The scale-invariance property, from three angles ──────────────────────

  it('scales every coordinate linearly with the canvas', () => {
    // THE core property. The preview and the capture canvas differ ONLY by
    // this factor; if that stops holding, marks land in the wrong place in the
    // flattened image while the preview still looks right.
    const stroke = strokeOf([
      [0.1, 0.2],
      [0.4, 0.35],
      [0.6, 0.8],
      [0.9, 0.55],
    ]);
    const small = numbersIn(strokeToPathData(stroke, 340, 736));
    const large = numbersIn(strokeToPathData(stroke, 1020, 2208)); // exactly 3x

    expect(small).toHaveLength(large.length);
    small.forEach((value, i) => {
      expect(large[i]).toBeCloseTo(value * 3, 1);
    });
  });

  it('puts a mark at the same fraction of the image at any size', () => {
    const stroke = strokeOf([[0.25, 0.75]]);
    for (const [w, h] of [
      [340, 736],
      [1170, 2532],
      [1284, 2778],
    ]) {
      const [x, y] = numbersIn(strokeToPathData(stroke, w, h));
      expect(x / w).toBeCloseTo(0.25, 5);
      expect(y / h).toBeCloseTo(0.75, 5);
    }
  });

  it('emits the same command sequence regardless of size', () => {
    // Shape identity, independent of the numbers: the flattened image must be
    // the same drawing, not merely a drawing.
    const stroke = strokeOf([[0.1, 0.1], [0.3, 0.4], [0.7, 0.2], [0.9, 0.9]]);
    const commands = (d: string) => (d.match(/[MLQ]/g) ?? []).join('');
    expect(commands(strokeToPathData(stroke, 340, 736))).toBe(
      commands(strokeToPathData(stroke, 1170, 2532))
    );
  });
});

// ─── undo / clear / hasInk ───────────────────────────────────────────────────

describe('dropLastStroke', () => {
  it('removes only the most recent mark', () => {
    // Undo, and the reason the feature is usable on a phone at all: a bad
    // stroke is guaranteed, and Clear-as-the-only-recovery means people give
    // up and send nothing.
    const strokes = [strokeOf([[0, 0]]), strokeOf([[0.5, 0.5]]), strokeOf([[1, 1]])];
    const next = dropLastStroke(strokes);
    expect(next).toHaveLength(2);
    expect(next[0]).toBe(strokes[0]);
    expect(next[1]).toBe(strokes[1]);
  });

  it('is a no-op on an empty list rather than an error', () => {
    expect(dropLastStroke([])).toEqual([]);
  });

  it('walks all the way back to empty when pressed repeatedly', () => {
    let strokes = [strokeOf([[0, 0]]), strokeOf([[1, 1]])];
    strokes = dropLastStroke(strokes);
    strokes = dropLastStroke(strokes);
    strokes = dropLastStroke(strokes);
    expect(strokes).toEqual([]);
  });
});

describe('hasInk', () => {
  it('is false with no strokes, or only empty ones', () => {
    expect(hasInk([])).toBe(false);
    expect(hasInk([strokeOf([])])).toBe(false);
  });

  it('is true as soon as one mark has a point', () => {
    expect(hasInk([strokeOf([[0.5, 0.5]])])).toBe(true);
  });
});

// ─── fitContain ──────────────────────────────────────────────────────────────

describe('fitContain', () => {
  it('preserves the aspect ratio', () => {
    const fit = fitContain(1170, 2532, 340, 700);
    expect(fit.width / fit.height).toBeCloseTo(1170 / 2532, 5);
  });

  it('fits inside the box on the constraining axis', () => {
    // Portrait screenshot in a shorter box — height is the limit.
    const tall = fitContain(1170, 2532, 340, 700);
    expect(tall.height).toBeCloseTo(700, 5);
    expect(tall.width).toBeLessThanOrEqual(340);

    // Landscape screenshot — width is the limit.
    const wide = fitContain(2532, 1170, 340, 700);
    expect(wide.width).toBeCloseTo(340, 5);
    expect(wide.height).toBeLessThanOrEqual(700);
  });

  it('returns an empty rect for unusable input rather than NaN', () => {
    // The screen gates the pen on this: dimensions the picker didn't report
    // must disable drawing, not place marks against invented numbers.
    expect(fitContain(0, 0, 340, 700)).toEqual({ width: 0, height: 0 });
    expect(fitContain(1170, 2532, 0, 0)).toEqual({ width: 0, height: 0 });
    expect(fitContain(NaN, 2532, 340, 700)).toEqual({ width: 0, height: 0 });
  });
});

// ─── assertAnnotationBoxIsUntransformed ──────────────────────────────────────

describe('assertAnnotationBoxIsUntransformed', () => {
  // Inherited from the poster generator, which found this in a real browser: a
  // scale transform above the canvas makes web `toDataURL` capture a magnified
  // corner, in a file that passes every byte-level check.
  const boxOf = (width: number, height: number) => ({
    getBoundingClientRect: () => ({ width, height }),
  });

  it('accepts a host at exactly the canvas size', () => {
    expect(() => assertAnnotationBoxIsUntransformed(boxOf(1170, 2532), 1170, 2532, true)).not.toThrow();
  });

  it('tolerates subpixel layout drift', () => {
    expect(() =>
      assertAnnotationBoxIsUntransformed(boxOf(1170.4, 2531.6), 1170, 2532, true)
    ).not.toThrow();
  });

  it('rejects a scaled host, naming the size it found', () => {
    expect(() =>
      assertAnnotationBoxIsUntransformed(boxOf(292, 633), 1170, 2532, true)
    ).toThrow(/292×633/);
  });

  it('rejects a host that is not laid out at all', () => {
    expect(() => assertAnnotationBoxIsUntransformed(boxOf(0, 0), 1170, 2532, true)).toThrow(
      AnnotationError
    );
  });

  it('says annotation, not poster, when it complains', () => {
    // The check is a copy of the poster one precisely so its messages talk
    // about the thing the user is actually doing.
    expect(() => assertAnnotationBoxIsUntransformed(boxOf(292, 633), 1170, 2532, true)).toThrow(
      /annotation canvas/
    );
  });

  it('does nothing off web, where the on-screen box is irrelevant', () => {
    // Native `toDataURL(w, h)` allocates its own bitmap and fits the viewBox
    // to it.
    expect(() =>
      assertAnnotationBoxIsUntransformed(boxOf(292, 633), 1170, 2532, false)
    ).not.toThrow();
  });

  it('does nothing when the ref carries no measurable box', () => {
    expect(() => assertAnnotationBoxIsUntransformed(null, 1170, 2532, true)).not.toThrow();
    expect(() => assertAnnotationBoxIsUntransformed({}, 1170, 2532, true)).not.toThrow();
  });
});

/**
 * The capture-fidelity guard.
 *
 * This is the check that exists because "the file is valid" kept being
 * mistaken for "the file is right". Report 97398534 shipped a PNG of the
 * correct dimensions containing a circle round nothing, and every structural
 * assertion in this codebase passed it. The property asserted below is that a
 * capture which LOST its background is refused, and a capture that kept it is
 * not — measured on sampled pixels, not inferred from bytes.
 */
describe('compareAlphaGrids', () => {
  /** RGBA buffer of `n` cells with the given alphas. */
  function grid(alphas: number[]): Uint8ClampedArray {
    const out = new Uint8ClampedArray(alphas.length * 4);
    alphas.forEach((a, i) => {
      out[i * 4 + 3] = a;
    });
    return out;
  }

  it('counts a cell only where the SOURCE has something to lose', () => {
    // Cells the source left empty cannot be "kept" or "lost" — counting them
    // would let a mostly-transparent screenshot inflate its own score.
    const source = grid([255, 0, 255, 0]);
    const capture = grid([255, 255, 255, 255]);
    expect(compareAlphaGrids(source, capture)).toEqual({
      sourceOpaqueCells: 2,
      matchedCells: 2,
    });
  });

  it('scores a capture that kept everything at 1', () => {
    const g = grid([255, 255, 255, 255]);
    const { sourceOpaqueCells, matchedCells } = compareAlphaGrids(g, g);
    expect(matchedCells / sourceOpaqueCells).toBe(1);
  });

  it('scores the blank-background failure near 0', () => {
    // What shipped: the strokes made it, the screenshot did not.
    const source = grid([255, 255, 255, 255, 255, 255, 255, 255]);
    const strokesOnly = grid([0, 255, 0, 0, 0, 0, 0, 0]);
    const { sourceOpaqueCells, matchedCells } = compareAlphaGrids(source, strokesOnly);
    expect(matchedCells / sourceOpaqueCells).toBeLessThan(0.2);
  });

  it('treats barely-there alpha as absent', () => {
    // Anti-aliasing leaves a whisper of alpha behind. Counting it as content
    // would score a blank capture as a full one.
    const source = grid([255, 255]);
    const ghost = grid([FIDELITY_TRANSPARENT_ALPHA, FIDELITY_TRANSPARENT_ALPHA]);
    expect(compareAlphaGrids(source, ghost).matchedCells).toBe(0);
  });
});

describe('assertCaptureFidelity', () => {
  it('refuses a capture that lost its screenshot', () => {
    expect(() =>
      assertCaptureFidelity({ sourceOpaqueCells: 1000, matchedCells: 60 })
    ).toThrow(AnnotationError);
  });

  it('explains the refusal in the reporter’s terms, not the renderer’s', () => {
    // The person reading this drew a circle on a screenshot. "Fidelity ratio
    // below threshold" tells them nothing they can act on.
    expect(() =>
      assertCaptureFidelity({ sourceOpaqueCells: 1000, matchedCells: 0 })
    ).toThrow(/screenshot/i);
    expect(() =>
      assertCaptureFidelity({ sourceOpaqueCells: 1000, matchedCells: 0 })
    ).toThrow(/nothing was sent/i);
  });

  it('accepts a capture that kept the screenshot under its marks', () => {
    // A marker circle covers a percent or two — well inside the allowance.
    expect(() =>
      assertCaptureFidelity({ sourceOpaqueCells: 1000, matchedCells: 985 })
    ).not.toThrow();
  });

  it('holds the line exactly at CAPTURE_FIDELITY_MIN', () => {
    const cells = 1000;
    expect(() =>
      assertCaptureFidelity({
        sourceOpaqueCells: cells,
        matchedCells: Math.ceil(cells * CAPTURE_FIDELITY_MIN),
      })
    ).not.toThrow();
    expect(() =>
      assertCaptureFidelity({
        sourceOpaqueCells: cells,
        matchedCells: Math.floor(cells * CAPTURE_FIDELITY_MIN) - 1,
      })
    ).toThrow(AnnotationError);
  });

  it('passes when the platform could not sample pixels', () => {
    // Native returns null. The readiness invariant covers that path; failing
    // closed here would refuse every annotation made on a phone.
    expect(() => assertCaptureFidelity(null)).not.toThrow();
  });

  it('passes vacuously on a fully transparent source', () => {
    // Nothing to lose, so nothing to prove. The user picked that image.
    expect(() =>
      assertCaptureFidelity({ sourceOpaqueCells: 0, matchedCells: 0 })
    ).not.toThrow();
  });
});
