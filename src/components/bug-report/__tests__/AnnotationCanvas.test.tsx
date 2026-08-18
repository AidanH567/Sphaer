/**
 * The annotation renderer.
 *
 * One component draws both the preview and the full-resolution canvas that
 * gets flattened, so the property that matters is that it renders the SAME
 * drawing at both sizes — and that it never renders strokes without the
 * screenshot under them. A canvas that emitted the marks and dropped the
 * image would produce a valid PNG of a circle round nothing, which is exactly
 * the "valid file, wrong content" failure the poster generator was burned by.
 *
 * Reads react-native-svg's NATIVE props, which are not the ones passed in:
 * colours arrive as `{ type, payload }` ARGB integers. `hexOf` undoes that.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import {
  AnnotationCanvas,
  annotationCanvasHostStyle,
  type AnnotationCanvasHandle,
} from '@/components/bug-report/AnnotationCanvas';
import {
  AnnotationError,
  strokeToPathData,
  strokeWidthFor,
  type AnnotationStroke,
} from '@/utils/annotation';
import { colors } from '@/constants/theme';

type Props = Record<string, unknown>;

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

/** `{ type: 0, payload: 0xAARRGGBB }` back to `#RRGGBB`. */
function hexOf(value: unknown): string {
  const payload = (value as { payload: number }).payload;
  return `#${(payload & 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`;
}

const CIRCLE: AnnotationStroke = {
  color: colors.annotation.red,
  points: [
    { x: 0.3, y: 0.3 },
    { x: 0.7, y: 0.35 },
    { x: 0.72, y: 0.7 },
    { x: 0.3, y: 0.68 },
    { x: 0.3, y: 0.3 },
  ],
};

const TAP: AnnotationStroke = {
  color: colors.annotation.cyan,
  points: [{ x: 0.5, y: 0.5 }],
};

const URI = 'file:///tmp/shot.png';

function tree(props: Partial<React.ComponentProps<typeof AnnotationCanvas>> = {}) {
  return render(
    <AnnotationCanvas uri={URI} width={340} height={736} strokes={[]} {...props} />
  ).toJSON();
}

describe('AnnotationCanvas', () => {
  it('renders without crashing with no strokes', () => {
    expect(tree()).toBeTruthy();
  });

  it('always draws the screenshot, filling the canvas exactly', () => {
    // The strokes are worthless without the thing they point at. An image that
    // is missing, offset, or cropped is the whole failure mode.
    const images = collect(tree({ strokes: [CIRCLE] }), 'RNSVGImage');
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ x: 0, y: 0, width: 340, height: 736 });
    expect(images[0].src).toMatchObject({ uri: URI });
  });

  it('draws the image FIRST, so marks land on top of it', () => {
    // Paint order. Strokes under the screenshot would be invisible while every
    // other assertion in this file still passed.
    const json = tree({ strokes: [CIRCLE] });
    const order: string[] = [];
    const visit = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const n = node as { type?: string; children?: unknown[] };
      if (n.type === 'RNSVGImage' || n.type === 'RNSVGPath') order.push(n.type);
      for (const child of n.children ?? []) visit(child);
    };
    visit(json);
    expect(order[0]).toBe('RNSVGImage');
    expect(order).toContain('RNSVGPath');
  });

  it('emits one path per stroke, with the path data the geometry solved', () => {
    // The component must not compute a coordinate of its own — that is the
    // only reason the preview and the capture canvas cannot drift apart.
    const strokes = [CIRCLE, TAP];
    const paths = collect(tree({ strokes }), 'RNSVGPath');
    expect(paths).toHaveLength(2);
    strokes.forEach((stroke, i) => {
      expect(paths[i].d).toBe(strokeToPathData(stroke, 340, 736));
    });
  });

  it('paints each stroke in the colour it was drawn with', () => {
    // A responder that captured a stale colour would draw everything red. This
    // is the render-side half of that check.
    const paths = collect(tree({ strokes: [CIRCLE, TAP] }), 'RNSVGPath');
    expect(hexOf(paths[0].stroke)).toBe(colors.annotation.red.toUpperCase());
    expect(hexOf(paths[1].stroke)).toBe(colors.annotation.cyan.toUpperCase());
  });

  it('scales stroke width with the canvas, not a fixed pixel count', () => {
    // The reported failure this prevents: a width that reads correctly on the
    // preview is a hairline once flattened into a 3x screenshot.
    const preview = collect(tree({ strokes: [CIRCLE] }), 'RNSVGPath')[0];
    const full = collect(
      tree({ strokes: [CIRCLE], width: 1170, height: 2532 }),
      'RNSVGPath'
    )[0];
    expect(preview.strokeWidth).toBe(strokeWidthFor(340, 736));
    expect(full.strokeWidth).toBe(strokeWidthFor(1170, 2532));
    expect(full.strokeWidth as number).toBeGreaterThan(preview.strokeWidth as number);
  });

  it('renders the same drawing at preview and capture size', () => {
    // Scale invariance, asserted through the component rather than the pure
    // function — this is the property the user actually relies on.
    const previewD = collect(tree({ strokes: [CIRCLE] }), 'RNSVGPath')[0].d as string;
    const fullD = collect(
      tree({ strokes: [CIRCLE], width: 1020, height: 2208 }), // exactly 3x
      'RNSVGPath'
    )[0].d as string;
    const nums = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const small = nums(previewD);
    const large = nums(fullD);
    expect(small).toHaveLength(large.length);
    small.forEach((value, i) => expect(large[i]).toBeCloseTo(value * 3, 1));
  });

  it('rounds the ends and joins, so a tap paints a visible dot', () => {
    // A zero-length path renders nothing under a butt linecap. Users tap to
    // point at things, and a tap that drew nothing reads as broken.
    const path = collect(tree({ strokes: [TAP] }), 'RNSVGPath')[0];
    expect(path.strokeLinecap).toBe(1); // round
    expect(path.strokeLinejoin).toBe(1); // round
    expect(path.d).toBe(strokeToPathData(TAP, 340, 736));
  });

  it('never fills a stroke — a circle must stay a ring', () => {
    // `fill` defaults to black in SVG. A filled freehand loop would black out
    // exactly the thing being reported.
    // react-native-svg maps `fill="none"` to a native `null`. An OMITTED fill
    // arrives as `{ payload: 0xFF000000 }` — opaque black — so null here is
    // precisely the difference between a ring and a filled blob.
    const path = collect(tree({ strokes: [CIRCLE] }), 'RNSVGPath')[0];
    expect(path.fill).toBeNull();
  });

  it('draws the in-progress stroke on top of the committed ones', () => {
    // The line has to follow the finger, and it must not jump when released —
    // same renderer, so it cannot.
    const paths = collect(tree({ strokes: [CIRCLE], activeStroke: TAP }), 'RNSVGPath');
    expect(paths).toHaveLength(2);
    expect(paths[1].d).toBe(strokeToPathData(TAP, 340, 736));
  });

  it('skips an empty active stroke rather than emitting a blank path', () => {
    const empty: AnnotationStroke = { color: colors.annotation.red, points: [] };
    expect(collect(tree({ activeStroke: empty }), 'RNSVGPath')).toHaveLength(0);
  });

  it('rejects rather than hangs when the native snapshot never calls back', async () => {
    // `toDataURL` is a callback API with no error channel: on failure the
    // native side simply never calls back. Under the test renderer there is no
    // native view at all, which reproduces that exactly — without the timeout
    // the Save button would spin forever.
    jest.useFakeTimers();
    try {
      const ref = React.createRef<AnnotationCanvasHandle>();
      render(
        <AnnotationCanvas ref={ref} uri={URI} width={340} height={736} strokes={[CIRCLE]} />
      );
      const pending = ref.current?.capture();
      const assertion = expect(pending).rejects.toBeInstanceOf(AnnotationError);
      // Past the image-ready grace period AND the capture timeout.
      await jest.advanceTimersByTimeAsync(20000);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('annotationCanvasHostStyle', () => {
  it('parks the capture canvas offscreen while keeping it laid out', () => {
    // NOT display:none and NOT zero-size: an un-laid-out RNSVGSvgView
    // snapshots to nothing, which is a blank annotation by another route.
    expect(annotationCanvasHostStyle.position).toBe('absolute');
    expect(annotationCanvasHostStyle.left as number).toBeLessThan(-2000);
    expect(annotationCanvasHostStyle.display).toBeUndefined();
    expect(annotationCanvasHostStyle.width).toBeUndefined();
    expect(annotationCanvasHostStyle.height).toBeUndefined();
  });
});
