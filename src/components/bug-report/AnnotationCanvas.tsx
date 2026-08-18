/**
 * The annotation renderer: a screenshot with strokes on top, as one SVG.
 *
 * Used TWICE by the annotator, with the same props and different sizes — once
 * visibly, as the thing the user draws on, and once parked offscreen at the
 * screenshot's real pixel size, as the thing that gets snapshotted. One
 * component for both is the point: the preview cannot promise something the
 * capture does not deliver, because they are the same code with different
 * numbers.
 *
 * `capture()` flattens it to a base64 PNG — image and strokes fused into one
 * picture. That is the whole output of this feature. There is deliberately no
 * second representation of the strokes (no JSON column, no replay renderer):
 * the person reading the report wants to see the circle, and a stroke list in
 * the database would be a migration plus a renderer that can drift from this
 * one, in exchange for nothing.
 *
 * Everything below about mounting and capture is inherited from
 * `GeneratedPosterCanvas`, which learned it the hard way — read its comments
 * before changing any of it.
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import Svg, { Image as SvgImage, Path } from 'react-native-svg';
import {
  AnnotationError,
  ANNOTATION_CAPTURE_TIMEOUT_MS,
  assertAnnotationBoxIsUntransformed,
  assertCaptureFidelity,
  strokeToPathData,
  strokeWidthFor,
  type AnnotationStroke,
} from '@/utils/annotation';
import {
  measureCaptureFidelity,
  toRasterisableHref,
} from '@/utils/annotation-capture';

/**
 * Style for the host wrapping the CAPTURE canvas.
 *
 * Same reasoning as `posterCanvasHostStyle`, and it matters for the same
 * reason: `Svg.toDataURL()` snapshots a mounted native view, so the canvas has
 * to be really laid out at the screenshot's full size — which does not fit on
 * a phone. Parked off the left edge it is live, measured, and capturable, but
 * never visible and never touchable.
 *
 * NOT `display: 'none'` and NOT zero-size: an un-laid-out RNSVGSvgView
 * snapshots to nothing, which is a blank annotation by another route.
 */
export const annotationCanvasHostStyle: ViewStyle = {
  position: 'absolute',
  left: -10000,
  top: 0,
  opacity: 0,
};

/**
 * How long `capture()` will wait for the screenshot to decode before giving
 * up.
 *
 * ── The trap ─────────────────────────────────────────────────────────────────
 * react-native-svg loads an `<Image href>` asynchronously. Snapshot the canvas
 * before that finishes and you get a valid PNG, of exactly the right
 * dimensions, containing the strokes on an EMPTY background — a picture of a
 * circle round nothing. Every byte-level check would pass it. It is the same
 * "valid file, wrong content" shape as the blank posters.
 *
 * ── What this guard used to be, and why it did not work ──────────────────────
 * It used to wait 2s for `onLoad` and then capture ANYWAY, reasoning that
 * refusing to save a drawing the user can see would be the worse bug. That
 * reasoning had a false premise: it assumed the preview and the capture share
 * a fate. On web they do not. The preview renders in the live DOM, where the
 * picker's `blob:` URI loads perfectly and `onLoad` duly fires — while the
 * capture rasterises a DETACHED copy of the SVG in which that same `blob:`
 * URI cannot be fetched at all. The flag was `true`, the grace period never
 * elapsed, and the capture came out blank regardless. See the header comment
 * of `annotation-capture.ts` for the full mechanism.
 *
 * ── Readiness is now two different questions ────────────────────────────────
 * 1. HREF_READY_TIMEOUT_MS — is the href something that can survive
 *    rasterisation? On web that means an inline `data:` URI, and it is a HARD
 *    gate: this is the actual root cause, it is deterministic, and there is
 *    no honest way to proceed without it. On native the href is ready
 *    immediately and this never waits.
 *
 * 2. IMAGE_READY_GRACE_MS — has `onLoad` fired? Still best-effort, and still
 *    proceeds on expiry, because the original comment was right that `onLoad`
 *    is not guaranteed on every platform for every URI scheme. Making it a
 *    hard gate would risk refusing perfectly good native captures — trading
 *    this bug for a worse one.
 *
 * What makes proceeding safe now is not the waiting. It is that the flattened
 * PNG is compared against the screenshot afterwards (`assertCaptureFidelity`),
 * so a blank background is caught by looking rather than by assuming.
 */
const HREF_READY_TIMEOUT_MS = 10000;
const IMAGE_READY_GRACE_MS = 2000;
const IMAGE_READY_POLL_MS = 50;

export interface AnnotationCanvasHandle {
  /** Snapshot the canvas. Resolves to a bare base64 PNG (no data: prefix). */
  capture(): Promise<string>;
}

interface Props {
  /** Local URI of the screenshot being annotated. */
  uri: string;
  /** Canvas size in pixels. The capture canvas passes the source image's real
   *  size; the preview passes its displayed (letterboxed) size. */
  width: number;
  height: number;
  strokes: AnnotationStroke[];
  /** The stroke in progress, drawn on top so the line follows the finger. */
  activeStroke?: AnnotationStroke | null;
  /** Preview only — lets the parent own the touch handling. */
  pointerEvents?: ViewStyle extends never ? never : 'none' | 'auto' | 'box-none' | 'box-only';
}

export const AnnotationCanvas = forwardRef<AnnotationCanvasHandle, Props>(
  function AnnotationCanvas(
    { uri, width, height, strokes, activeStroke = null, pointerEvents = 'none' },
    ref
  ) {
    const svgRef = useRef<Svg>(null);
    // On react-native-web this ref IS the DOM node, which is what the
    // untransformed-box check needs. On native it is a host component instance
    // with no getBoundingClientRect, and the check no-ops.
    const hostRef = useRef<View>(null);
    const imageLoaded = useRef(false);

    /**
     * The href actually handed to `<SvgImage>` — on web, the screenshot
     * inlined as a `data:` URI so it survives being serialised into a
     * detached SVG. Null until that resolves; native resolves synchronously
     * to the original URI.
     */
    const [href, setHref] = useState<string | null>(
      Platform.OS === 'web' && !uri.startsWith('data:') ? null : uri
    );
    const [hrefError, setHrefError] = useState<string | null>(null);
    // Read by capture() without re-creating the imperative handle.
    const hrefRef = useRef<string | null>(href);
    hrefRef.current = href;

    useEffect(() => {
      let cancelled = false;
      imageLoaded.current = false;
      setHrefError(null);

      if (Platform.OS !== 'web' || uri.startsWith('data:')) {
        setHref(uri);
        return;
      }

      // Kicked off when the annotator MOUNTS, not at save time, so the whole
      // drawing session doubles as the loading window.
      setHref(null);
      toRasterisableHref(uri)
        .then((inlined) => {
          if (!cancelled) setHref(inlined);
        })
        .catch((err: unknown) => {
          if (!cancelled) setHrefError(String(err));
        });

      return () => {
        cancelled = true;
      };
    }, [uri]);

    const onImageLoad = useCallback(() => {
      imageLoaded.current = true;
    }, []);

    // Re-rendered on every stroke, so it is recomputed rather than memoised —
    // the whole path set for a realistic annotation is a few hundred numbers.
    const strokeWidth = strokeWidthFor(width, height);

    useImperativeHandle(
      ref,
      () => ({
        capture: async () => {
          const svg = svgRef.current;
          if (!svg) {
            throw new AnnotationError(
              "The annotation canvas wasn't ready. Please try again."
            );
          }

          assertAnnotationBoxIsUntransformed(
            hostRef.current,
            width,
            height,
            Platform.OS === 'web'
          );

          if (hrefError !== null) {
            throw new AnnotationError(
              "The screenshot couldn't be prepared for saving. Please try " +
                'attaching it again.'
            );
          }

          // (1) Hard gate: an href that can actually rasterise.
          const hrefDeadline = Date.now() + HREF_READY_TIMEOUT_MS;
          while (hrefRef.current === null && Date.now() < hrefDeadline) {
            await new Promise((resolve) => setTimeout(resolve, IMAGE_READY_POLL_MS));
          }
          if (hrefRef.current === null) {
            throw new AnnotationError(
              'The screenshot is still loading. Please try again in a moment.'
            );
          }

          // (2) Best-effort: give the decode a bounded chance, then proceed.
          const loadDeadline = Date.now() + IMAGE_READY_GRACE_MS;
          while (!imageLoaded.current && Date.now() < loadDeadline) {
            await new Promise((resolve) => setTimeout(resolve, IMAGE_READY_POLL_MS));
          }

          const base64 = await new Promise<string>((resolve, reject) => {
            // `toDataURL` is a callback API with no error channel: on a failed
            // snapshot the native side simply never calls back. Without this
            // timeout a failure would leave the Save button spinning forever.
            let settled = false;
            const timer = setTimeout(() => {
              if (settled) return;
              settled = true;
              reject(
                new AnnotationError(
                  'The annotated screenshot took too long to render. Please try again.'
                )
              );
            }, ANNOTATION_CAPTURE_TIMEOUT_MS);

            svg.toDataURL(
              (base64: string) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                if (!base64) {
                  reject(
                    new AnnotationError(
                      "The annotation didn't render properly on this device. Please try again."
                    )
                  );
                  return;
                }
                resolve(base64);
              },
              // Explicit pixel size, exactly as the poster canvas does it:
              // Android allocates a bitmap of this size and fits the viewBox to
              // it, web sizes its canvas from it, iOS treats it as points and
              // returns an integer multiple.
              { width, height }
            );
          });

          /**
           * Look at the pixels before handing them over.
           *
           * Everything above this line is an argument that the capture
           * SHOULD be correct. This is the only part that checks whether it
           * IS — and it is here because every previous version of that
           * argument was convincing and wrong. A blank capture reaching this
           * point scores ~0 and is refused; a real one scores ~1.
           */
          assertCaptureFidelity(
            await measureCaptureFidelity(hrefRef.current, base64)
          );

          return base64;
        },
      }),
      [width, height, hrefError]
    );

    return (
      <View ref={hostRef} style={{ width, height }} pointerEvents={pointerEvents}>
        <Svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          pointerEvents="none"
        >
          {/* The screenshot fills the canvas exactly — the canvas is sized to
              its aspect ratio by `fitContain`, so there is nothing to crop and
              nothing to letterbox. `slice` would silently crop if that ever
              stopped being true; `meet` would letterbox with transparency.
              Neither should ever happen, and both would be visible. */}
          {href !== null && (
            <SvgImage
              x={0}
              y={0}
              width={width}
              height={height}
              preserveAspectRatio="xMidYMid meet"
              href={{ uri: href }}
              onLoad={onImageLoad}
            />
          )}

          {/* Committed strokes, oldest first — later marks sit on top of
              earlier ones, which is what a person drawing expects. */}
          {strokes.map((stroke, index) => {
            const d = strokeToPathData(stroke, width, height);
            if (!d) return null;
            return (
              <Path
                key={`s-${index}-${stroke.points.length}-${stroke.color}`}
                d={d}
                stroke={stroke.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            );
          })}

          {/* The line currently under the finger. Same renderer, so it cannot
              jump when it is committed on release. */}
          {activeStroke && activeStroke.points.length > 0 && (
            <Path
              d={strokeToPathData(activeStroke, width, height)}
              stroke={activeStroke.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
        </Svg>
      </View>
    );
  }
);

