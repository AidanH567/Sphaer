/**
 * The on-device poster renderer.
 *
 * Draws a solved `PosterLayout` with react-native-svg and exposes one
 * imperative method — `capture()` — which snapshots itself to a base64 PNG.
 * It computes no coordinates of its own: every x, y, and font size comes out
 * of `buildPosterLayout`, so the Node QA renderer
 * (`posterLayoutToSvgString`) and this component cannot drift apart in the
 * maths. They can still drift in *typography* — see the note on fonts below.
 *
 * ── Why it renders offscreen rather than in a preview ────────────────────────
 * `Svg.toDataURL()` snapshots the mounted native view, so the poster must be
 * really mounted at its real 1080×1528 size to be captured at full resolution.
 * A 1080pt-wide view does not fit on a phone, so the host wraps it in an
 * absolutely-positioned container parked off the left edge of the screen
 * (`posterCanvasHostStyle` below). It is laid out, drawn, and capturable, but
 * never visible and never touchable.
 */

import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import Svg, { Rect, Text as SvgText, Image as SvgImage } from 'react-native-svg';
import { typography } from '@/constants/theme';
import { PosterGenerationError } from '@/utils/poster-guard';
import type { FontRole, PosterLayout, RectShape } from '@/utils/poster-template';

/**
 * Style for the container the host screen must wrap this component in.
 *
 * Off the left edge rather than `opacity: 0` or `display: 'none'`: a hidden or
 * zero-opacity view is still laid out on both platforms, but a `display: none`
 * one is not, and an un-laid-out RNSVGSvgView snapshots to nothing. Parking it
 * at a negative x keeps it a fully live, measured view that no user can see.
 */
export const posterCanvasHostStyle: ViewStyle = {
  position: 'absolute',
  left: -10000,
  top: 0,
  opacity: 0,
};

/** How long we wait for the native snapshot before calling it a failure. */
const CAPTURE_TIMEOUT_MS = 15000;

/**
 * Web only: refuse to capture a canvas whose painted box is not its real size.
 *
 * ── The trap this closes ─────────────────────────────────────────────────────
 * react-native-svg's web `toDataURL` does not snapshot the element. It clones
 * it into a NEW `<svg>` whose viewBox it computes from
 * `getBoundingClientRect(ref)`, then rasterises that through an off-DOM image
 * element and a canvas. So the viewBox is the element's *CSS* box — after
 * transforms.
 *
 * Put a `transform: scale(0.25)` anywhere above the canvas and the wrapper
 * gets `viewBox="0 0 270 382"` around 1080×1528 of content: the capture is the
 * top-left quarter of the poster, magnified, with the entire type band cut
 * off. It is still a 1080×1528 PNG. It is still ~38 KB. It is still 100%
 * opaque. Every check in poster-guard.ts passes it, because from the bytes it
 * is indistinguishable from a good poster.
 *
 * This was not theoretical — it is what the browser QA harness produced on its
 * first run, and it is precisely "valid file, wrong content", the family of
 * bug that put eight blank tiles on the Mural. `onLayout` cannot catch it
 * (react-native-web reports the untransformed 1080×1528 in both cases), so the
 * check has to read the same quantity react-native-svg itself reads.
 *
 * Tolerance is 1px for subpixel layout. Native returns no rect and is skipped:
 * there, `toDataURL(w, h)` allocates its own bitmap and fits the viewBox to it,
 * so the on-screen box is irrelevant.
 */
const MAX_BOX_DRIFT_PX = 1;

export function assertCanvasBoxIsUntransformed(
  host: unknown,
  expectedWidth: number,
  expectedHeight: number
): void {
  if (Platform.OS !== 'web') return;
  const el = host as { getBoundingClientRect?: () => { width: number; height: number } };
  if (typeof el?.getBoundingClientRect !== 'function') return;
  const rect = el.getBoundingClientRect();
  // A zero box means the host is not laid out (display:none, or unmounted);
  // capturing it would produce an empty image.
  if (rect.width === 0 || rect.height === 0) {
    throw new PosterGenerationError(
      "The poster canvas wasn't ready. Please try again."
    );
  }
  if (
    Math.abs(rect.width - expectedWidth) > MAX_BOX_DRIFT_PX ||
    Math.abs(rect.height - expectedHeight) > MAX_BOX_DRIFT_PX
  ) {
    throw new PosterGenerationError(
      `The poster canvas is being displayed at ${Math.round(rect.width)}×${Math.round(
        rect.height
      )} instead of ${expectedWidth}×${expectedHeight}, which would crop the poster. ` +
        'Remove any scaling from the container that holds it.'
    );
  }
}

export interface PosterCanvasHandle {
  /** Snapshot the canvas. Resolves to a bare base64 PNG (no data: prefix). */
  capture(): Promise<string>;
}

interface Props {
  layout: PosterLayout;
}

/**
 * Font family per layout role.
 *
 * The display face is the app's own token, so a generated poster's title is
 * set in the same type as an event title everywhere else in Sphaer. Note that
 * `TestMartinaPlantijn-Regular` is NOT currently loaded by `app/_layout.tsx`
 * (the `useFonts` call there is still commented out), so today this resolves
 * to the platform default and the poster's title renders sans-serif. That is a
 * cosmetic difference from the Node QA render, which has Georgia available —
 * it is not a correctness problem, and it fixes itself the day the font files
 * land in `assets/fonts/`.
 */
const FONT_FAMILY: Record<FontRole, string> = {
  display: typography.fontFamily.display,
  uiBold: typography.fontFamily.ui,
  ui: typography.fontFamily.ui,
};

const FONT_WEIGHT: Record<FontRole, string> = {
  display: '400',
  uiBold: '700',
  ui: '400',
};

function shapeKey(r: RectShape, i: number): string {
  return `${i}-${r.x}-${r.y}-${r.width}-${r.height}`;
}

export const GeneratedPosterCanvas = forwardRef<PosterCanvasHandle, Props>(
  function GeneratedPosterCanvas({ layout }, ref) {
    const svgRef = useRef<Svg>(null);
    // On react-native-web this ref IS the DOM node, which is what
    // assertCanvasBoxIsUntransformed needs. On native it is a host component
    // instance with no getBoundingClientRect, and the check no-ops.
    const hostRef = useRef<View>(null);

    useImperativeHandle(
      ref,
      () => ({
        capture: () =>
          new Promise<string>((resolve, reject) => {
            const svg = svgRef.current;
            if (!svg) {
              reject(
                new PosterGenerationError(
                  "The poster canvas wasn't ready. Please try again."
                )
              );
              return;
            }

            try {
              assertCanvasBoxIsUntransformed(hostRef.current, layout.width, layout.height);
            } catch (e) {
              reject(e);
              return;
            }

            // `toDataURL` is a callback API with no error channel: on a failed
            // snapshot the native side simply never calls back (iOS retries
            // once, then invokes with no arguments). Without this timeout a
            // failure would leave the button spinning forever.
            let settled = false;
            const timer = setTimeout(() => {
              if (settled) return;
              settled = true;
              reject(
                new PosterGenerationError(
                  'The poster took too long to render. Please try again.'
                )
              );
            }, CAPTURE_TIMEOUT_MS);

            svg.toDataURL(
              (base64: string) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                if (!base64) {
                  reject(
                    new PosterGenerationError(
                      "The poster didn't render properly on this device. Please try again."
                    )
                  );
                  return;
                }
                resolve(base64);
              },
              // Explicit pixel size. Android allocates a bitmap of exactly
              // this size and fits the viewBox to it; web sizes its canvas
              // from it; iOS treats it as a point rect and renders at screen
              // scale, so an iPhone returns an integer multiple. The guard
              // accepts any of those — see assertPngIsPlausible.
              { width: layout.width, height: layout.height }
            );
          }),
      }),
      [layout.width, layout.height]
    );

    return (
      <View
        ref={hostRef}
        style={{ width: layout.width, height: layout.height }}
        pointerEvents="none"
      >
        <Svg
          ref={svgRef}
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
        >
          {/* Always first, always full-bleed, always opaque. This single rect
              is what makes the transparent-poster failure structurally
              impossible; assertLayoutIsPaintable checks it before we render. */}
          <Rect
            x={layout.background.x}
            y={layout.background.y}
            width={layout.background.width}
            height={layout.background.height}
            fill={layout.background.fill}
          />

          {layout.photo && (
            <SvgImage
              x={layout.photo.rect.x}
              y={layout.photo.rect.y}
              width={layout.photo.rect.width}
              height={layout.photo.rect.height}
              preserveAspectRatio="xMidYMid slice"
              href={{ uri: layout.photo.dataUri }}
            />
          )}

          <Rect
            x={layout.band.x}
            y={layout.band.y}
            width={layout.band.width}
            height={layout.band.height}
            fill={layout.band.fill}
          />

          {layout.accents.map((a, i) => (
            <Rect
              key={shapeKey(a, i)}
              x={a.x}
              y={a.y}
              width={a.width}
              height={a.height}
              fill={a.fill}
            />
          ))}

          {layout.texts.map((t, i) => (
            <SvgText
              key={`t-${i}-${t.y}`}
              x={t.x}
              y={t.y}
              fontSize={t.fontSize}
              fontFamily={FONT_FAMILY[t.role]}
              fontWeight={FONT_WEIGHT[t.role]}
              fill={t.fill}
              opacity={t.opacity}
              letterSpacing={t.letterSpacing}
            >
              {t.text}
            </SvgText>
          ))}
        </Svg>
      </View>
    );
  }
);
