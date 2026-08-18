/**
 * The on-device poster renderer.
 *
 * There are two renderers over one solved layout: this react-native-svg
 * component (what users actually generate) and `posterLayoutToSvgString`
 * (what `scripts/qa-generate-poster.ts` rasterises with sharp so a human can
 * look at real pixels). Only the second one can be measured off-device — so
 * the risk this file exists to cover is the two DRIFTING: the QA render being
 * well composed while the phone paints something else.
 *
 * The defence is that neither renderer may compute a coordinate of its own.
 * These tests assert exactly that — every rect and every text the component
 * emits must be present in the layout, at the same numbers, in the same order.
 *
 * They read react-native-svg's own native props, which are not the props we
 * pass: colours arrive as `{ type, payload }` ARGB integers, `x`/`y` on a text
 * node arrive as arrays (one entry per glyph run), and font settings are
 * folded into a single `font` object. The `unwrap`/`hexOf` helpers below undo
 * that so the assertions can be written against the layout's plain numbers.
 */

import React from 'react';
import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import {
  assertCanvasBoxIsUntransformed,
  GeneratedPosterCanvas,
  posterCanvasHostStyle,
  type PosterCanvasHandle,
} from '@/components/events/GeneratedPosterCanvas';
import {
  buildPosterLayout,
  POSTER_FAMILIES,
  POSTER_HEIGHT,
  POSTER_WIDTH,
} from '@/utils/poster-template';
import { PosterGenerationError } from '@/utils/poster-guard';
import type { PosterInput, PosterLayout } from '@/utils/poster-template';

const layoutOf = (overrides: Partial<PosterInput> = {}) =>
  buildPosterLayout({
    title: 'Nachtstrom',
    startsAt: new Date(2026, 8, 12, 22, 0).toISOString(),
    locationName: 'Sameheads',
    ...overrides,
  });

/**
 * A layout that is definitely the named family.
 *
 * Family choice is a pure function of the event, so the way to reach a specific
 * one is to walk `variant` — the same counter Shuffle increments — until it
 * lands. Asserting the renderer against only whichever family the default seed
 * happens to hash to would leave three of the four untested.
 */
function layoutForFamily(id: string, overrides: Partial<PosterInput> = {}): PosterLayout {
  for (let variant = 0; variant < 64; variant++) {
    const layout = layoutOf({ ...overrides, variant });
    if (layout.family === id) return layout;
  }
  throw new Error(`no variant produced the '${id}' family`);
}

type Props = Record<string, unknown>;

/** Walk the rendered tree and collect the props of every node of a given type. */
function collect(json: unknown, type: string): Props[] {
  const out: Props[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: string; props?: Props; children?: unknown[] };
    if (n.type === type && n.props) out.push(n.props);
    for (const child of n.children ?? []) visit(child);
  };
  visit(json);
  return out;
}

function tree(layout = layoutOf()) {
  return render(<GeneratedPosterCanvas layout={layout} />).toJSON();
}

/** react-native-svg wraps a text node's x/y in an array. */
function unwrap(value: unknown): number {
  return Array.isArray(value) ? (value[0] as number) : (value as number);
}

/** `{ type: 0, payload: 0xAARRGGBB }` back to the `#RRGGBB` the layout gave. */
function hexOf(fill: unknown): string {
  const payload = (fill as { payload: number }).payload;
  return `#${(payload & 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`;
}

/** The rendered string of a text node lives on its TSpan child. */
function contentOf(node: unknown): string {
  return collect(node, 'RNSVGTSpan')
    .map((p) => String(p.content ?? ''))
    .join('');
}

describe('GeneratedPosterCanvas', () => {
  it('renders without crashing on a real layout', () => {
    expect(tree()).toBeTruthy();
  });

  it('draws the opaque full-bleed background first', () => {
    // Paint order is the entire reason a generated poster cannot come out
    // transparent. If this rect ever stops being first, the guard's structural
    // check is guaranteeing something the renderer no longer honours.
    const layout = layoutOf();
    const rects = collect(tree(layout), 'RNSVGRect');
    expect(rects.length).toBeGreaterThan(0);
    expect(rects[0]).toMatchObject({ x: 0, y: 0, width: POSTER_WIDTH, height: POSTER_HEIGHT });
    expect(hexOf(rects[0].fill)).toBe(layout.background.fill.toUpperCase());
  });

  it('emits exactly the shapes the layout solved, in the layout order', () => {
    const layout = layoutOf();
    const rects = collect(tree(layout), 'RNSVGRect');
    const expected = [layout.background, layout.band, ...layout.accents];
    expect(rects).toHaveLength(expected.length);
    expected.forEach((shape, i) => {
      expect(rects[i]).toMatchObject({
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
      });
      expect(hexOf(rects[i].fill)).toBe(shape.fill.toUpperCase());
    });
  });

  it('emits exactly the text runs the layout solved, at the layout coordinates', () => {
    const layout = layoutOf();
    const json = tree(layout);
    const texts = collect(json, 'RNSVGText');
    expect(texts).toHaveLength(layout.texts.length);
    layout.texts.forEach((run, i) => {
      expect(unwrap(texts[i].x)).toBe(run.x);
      expect(unwrap(texts[i].y)).toBe(run.y);
      expect(texts[i].opacity).toBe(run.opacity);
      expect(hexOf(texts[i].fill)).toBe(run.fill.toUpperCase());
      expect(texts[i].font).toMatchObject({
        fontSize: run.fontSize,
        letterSpacing: run.letterSpacing,
      });
    });
  });

  it('renders the same strings the layout solved, not re-derived ones', () => {
    // The component must not reformat a date or re-truncate a title: the
    // wrapping and ellipsising are the layout's job, and doing either twice is
    // how the two renderers would start disagreeing.
    const layout = layoutOf({
      title: 'Donaudampfschifffahrtsgesellschaftskapitänsabend',
      address: 'Sonnenallee 123, 12059 Berlin, Neukölln, Germany, Planet Earth',
      locationName: null,
    });
    const json = tree(layout);
    // The whole poster's text, concatenated, must still contain the wordmark
    // and the venue fallback — nothing silently dropped on the way through.
    expect(contentOf(json)).toContain('SPHAER');
    const spans = collect(json, 'RNSVGTSpan').map((p) => String(p.content ?? ''));
    expect(spans).toEqual(layout.texts.map((t) => t.text));
  });

  it('sets each run in the face its layout role asks for', () => {
    // This used to assert that the FIRST run was the 400-weight serif, which
    // was true only while there was one composition. Families choose their own
    // face — `block` and `spine` set their titles in the grotesque, which is a
    // large part of why they do not read as the same poster recoloured — so the
    // check is now that the component honours whatever role the layout picked,
    // which is the property that actually matters.
    const weightForRole = { display: '400', uiBold: '700', ui: '400' } as const;
    for (const family of POSTER_FAMILIES) {
      const layout = layoutForFamily(family.id);
      const fonts = collect(tree(layout), 'RNSVGText').map(
        (p) => p.font as Record<string, unknown>
      );
      expect(fonts).toHaveLength(layout.texts.length);
      layout.texts.forEach((run, i) => {
        expect(fonts[i].fontWeight).toBe(weightForRole[run.role]);
      });
      // The wordmark is the last run and is always bold, in every family.
      expect(layout.texts[layout.texts.length - 1].text).toBe('SPHAER');
      expect(fonts[fonts.length - 1].fontWeight).toBe('700');
    }
  });

  it('rotates a run about its own anchor point, as the SVG renderer does', () => {
    // Rotation is the one primitive that cannot be checked by reading back a
    // coordinate: react-native-svg folds `rotation` + `origin` into an affine
    // `matrix`, so a component that dropped the props entirely would still emit
    // every run at exactly the layout's x and y and still pass every other test
    // in this file — while painting the spine's title flat across the poster
    // and straight off the edge.
    //
    // Two things are asserted, because only the pair pins it down:
    //   1. the matrix's rotation angle is the one the layout asked for, and
    //   2. the run's own (x, y) is a FIXED POINT of that matrix.
    // (2) is what makes this equivalent to the `rotate(deg x y)` the Node
    // renderer emits. Rotating by the right angle about the wrong origin is the
    // realistic way for the two renderers to drift.
    const spine = layoutForFamily('spine');
    expect(spine.texts.some((t) => t.rotate)).toBe(true);

    const nodes = collect(tree(spine), 'RNSVGText');
    spine.texts.forEach((run, i) => {
      const m = nodes[i].matrix as number[];
      const [a, b, c, d, e, f] = m;
      const degrees = (Math.atan2(b, a) * 180) / Math.PI;
      expect(degrees).toBeCloseTo(run.rotate ?? 0, 6);
      // The anchor maps to itself.
      expect(a * run.x + c * run.y + e).toBeCloseTo(run.x, 6);
      expect(b * run.x + d * run.y + f).toBeCloseTo(run.y, 6);
    });
  });

  it('sets the text anchor each family asked for', () => {
    // `textAnchor` is folded into the `font` object rather than kept as a prop.
    // `panel` is the only family that centres its type, and centring is most of
    // what stops it reading as `classic` with the band moved up.
    const panel = layoutForFamily('panel');
    expect(panel.texts.some((t) => t.anchor === 'middle')).toBe(true);

    for (const family of POSTER_FAMILIES) {
      const layout = layoutForFamily(family.id);
      const fonts = collect(tree(layout), 'RNSVGText').map(
        (p) => p.font as Record<string, unknown>
      );
      layout.texts.forEach((run, i) => {
        expect(fonts[i].textAnchor).toBe(run.anchor ?? 'start');
      });
    }
  });

  it('renders the photo only when the layout carries one', () => {
    expect(
      collect(tree(layoutOf({ photoDataUri: 'data:image/png;base64,AAAA' })), 'RNSVGImage')
    ).toHaveLength(1);
    expect(collect(tree(), 'RNSVGImage')).toHaveLength(0);
  });

  it('survives the degenerate layout without losing its background or type', () => {
    const json = tree(buildPosterLayout({ title: '   ', startsAt: 'not-a-date' }));
    expect(collect(json, 'RNSVGRect')[0]).toMatchObject({ width: POSTER_WIDTH });
    expect(collect(json, 'RNSVGText').length).toBeGreaterThanOrEqual(2);
  });

  it('rejects rather than hangs when the native snapshot never calls back', async () => {
    // `toDataURL` is a callback API with no error channel: on a failed capture
    // the native side simply never calls back (iOS retries once, then invokes
    // with no arguments). Under the test renderer there is no native view at
    // all, which reproduces that exactly — and without the timeout the promise
    // would never settle and the Generate button would spin forever.
    jest.useFakeTimers();
    try {
      const ref = React.createRef<PosterCanvasHandle>();
      render(<GeneratedPosterCanvas ref={ref} layout={layoutOf()} />);
      const pending = ref.current?.capture();
      const assertion = expect(pending).rejects.toBeInstanceOf(PosterGenerationError);
      jest.advanceTimersByTime(20000);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('assertCanvasBoxIsUntransformed', () => {
  // Found by driving the real exported web build in Chromium, not by reasoning:
  // a `transform: scale(0.25)` on the host produced a 1080×1528, 38 KB, 100%
  // opaque PNG containing the top-left quarter of the poster and no text at
  // all — and every byte-level check in poster-guard.ts passed it. These tests
  // pin the fix. `Platform.OS` is 'ios' under jest-expo, so each case sets it
  // explicitly rather than assuming.
  const setPlatform = (os: string) => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  };
  const originalOS = Platform.OS;
  const boxOf = (width: number, height: number) => ({
    getBoundingClientRect: () => ({ width, height }),
  });

  afterEach(() => setPlatform(originalOS));

  it('accepts a host displayed at exactly the layout size', () => {
    setPlatform('web');
    expect(() =>
      assertCanvasBoxIsUntransformed(boxOf(POSTER_WIDTH, POSTER_HEIGHT), POSTER_WIDTH, POSTER_HEIGHT)
    ).not.toThrow();
  });

  it('tolerates subpixel layout drift', () => {
    setPlatform('web');
    expect(() =>
      assertCanvasBoxIsUntransformed(
        boxOf(POSTER_WIDTH + 0.4, POSTER_HEIGHT - 0.6),
        POSTER_WIDTH,
        POSTER_HEIGHT
      )
    ).not.toThrow();
  });

  it('rejects a scaled host, naming the size it actually found', () => {
    setPlatform('web');
    expect(() =>
      assertCanvasBoxIsUntransformed(boxOf(270, 382), POSTER_WIDTH, POSTER_HEIGHT)
    ).toThrow(/270×382/);
  });

  it('rejects a host that is not laid out at all', () => {
    setPlatform('web');
    expect(() => assertCanvasBoxIsUntransformed(boxOf(0, 0), POSTER_WIDTH, POSTER_HEIGHT)).toThrow(
      PosterGenerationError
    );
  });

  it('does nothing on native, where the on-screen box is irrelevant', () => {
    // `toDataURL(w, h)` allocates its own bitmap and fits the viewBox to it,
    // so a scaled native view still captures the whole poster.
    for (const os of ['ios', 'android']) {
      setPlatform(os);
      expect(() =>
        assertCanvasBoxIsUntransformed(boxOf(270, 382), POSTER_WIDTH, POSTER_HEIGHT)
      ).not.toThrow();
    }
  });

  it('does nothing when the ref carries no measurable box', () => {
    setPlatform('web');
    expect(() => assertCanvasBoxIsUntransformed(null, POSTER_WIDTH, POSTER_HEIGHT)).not.toThrow();
    expect(() => assertCanvasBoxIsUntransformed({}, POSTER_WIDTH, POSTER_HEIGHT)).not.toThrow();
  });
});

describe('posterCanvasHostStyle', () => {
  it('parks the canvas offscreen while keeping it laid out', () => {
    // NOT display:none and NOT zero-size: an un-laid-out RNSVGSvgView
    // snapshots to nothing, which is the blank poster by another route.
    expect(posterCanvasHostStyle.position).toBe('absolute');
    expect(posterCanvasHostStyle.left as number).toBeLessThan(-POSTER_WIDTH);
    expect(posterCanvasHostStyle.display).toBeUndefined();
    expect(posterCanvasHostStyle.width).toBeUndefined();
    expect(posterCanvasHostStyle.height).toBeUndefined();
  });

  it('leaves room for the full poster height offscreen', () => {
    expect(posterCanvasHostStyle.top).toBe(0);
    expect(POSTER_HEIGHT).toBeGreaterThan(0);
  });
});
