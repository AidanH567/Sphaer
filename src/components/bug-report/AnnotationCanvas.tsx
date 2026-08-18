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

import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import Svg, { Image as SvgImage, Path } from 'react-native-svg';
import {
  AnnotationError,
  ANNOTATION_CAPTURE_TIMEOUT_MS,
  assertAnnotationBoxIsUntransformed,
  strokeToPathData,
  strokeWidthFor,
  type AnnotationStroke,
} from '@/utils/annotation';

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
 * How long `capture()` will wait for the screenshot to decode before going
 * ahead anyway.
 *
 * ── The trap ─────────────────────────────────────────────────────────────────
 * react-native-svg loads an `<Image href>` asynchronously. Snapshot the canvas
 * before that finishes and you get a valid PNG, of exactly the right
 * dimensions, containing the strokes on an EMPTY background — a picture of a
 * circle round nothing. Every byte-level check would pass it. It is the same
 * "valid file, wrong content" shape as the blank posters.
 *
 * Two things make it very unlikely: the capture canvas is mounted the moment
 * the annotator opens (not at save time), so it has had the entire drawing
 * session to load; and `onLoad` flips a flag that `capture()` checks.
 *
 * It waits rather than failing, and then proceeds rather than hanging, because
 * `onLoad` is not guaranteed to fire on every platform for every URI scheme —
 * and refusing to save a drawing the user can plainly see on screen would be a
 * worse bug than the one being guarded against. By the time this grace period
 * expires the image has, in practice, been on screen for many seconds.
 */
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
    const imageReady = useRef(false);

    const onImageLoad = useCallback(() => {
      imageReady.current = true;
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

          // Give an undecoded screenshot a bounded chance to arrive. See
          // IMAGE_READY_GRACE_MS — this is the guard against flattening the
          // strokes onto nothing.
          const deadline = Date.now() + IMAGE_READY_GRACE_MS;
          while (!imageReady.current && Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, IMAGE_READY_POLL_MS));
          }

          return new Promise<string>((resolve, reject) => {
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
        },
      }),
      [width, height]
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
          <SvgImage
            x={0}
            y={0}
            width={width}
            height={height}
            preserveAspectRatio="xMidYMid meet"
            href={{ uri }}
            onLoad={onImageLoad}
          />

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

