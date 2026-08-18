/**
 * The two platform-dependent halves of a trustworthy annotation capture:
 * getting the screenshot into a form the renderer can actually rasterise, and
 * checking afterwards that it did.
 *
 * Everything here is deliberately separate from `annotation.ts`, which stays
 * pure maths. This file is the one that touches `fetch`, `document`, and
 * canvases.
 *
 * ── The bug that produced this file ──────────────────────────────────────────
 * On web, `Svg.toDataURL()` does not snapshot the live SVG. It clones the
 * node, serialises it to XML, and hands that string to an `<img>`:
 *
 *     img.src = `data:image/svg+xml;utf8,${encodeSvg(serialised)}`;
 *     img.onload = () => { ctx.drawImage(img, 0, 0); … }
 *
 * (react-native-svg 15.15.3, `src/elements.web.ts`.) An SVG loaded through
 * `<img>` is rendered in the browser's SECURE STATIC MODE, which forbids
 * loading external resources of any kind. `expo-image-picker` on web returns
 * `URL.createObjectURL(file)` — a `blob:` URI (`ExponentImagePicker.web.js`,
 * `readFile`) — so the serialised `<image href="blob:…">` resolves to nothing
 * and the canvas receives the strokes over an empty background.
 *
 * The cruel part is that the PREVIEW is fine. In the live DOM a `blob:` URL
 * loads normally, so the user sees their screenshot, `onLoad` fires, and the
 * existing `imageReady` flag is `true` at capture time. The guard that was
 * supposed to catch exactly this could never have fired: it was watching the
 * live document while the failure happened inside a detached rasterisation.
 *
 * The fix is to make the SVG self-contained — a `data:` URI is inline in the
 * serialised markup, so secure static mode has nothing to fetch.
 */

import { Platform } from 'react-native';
import {
  compareAlphaGrids,
  FIDELITY_GRID,
  type CaptureFidelity,
} from '@/utils/annotation';

/** Can this platform look at decoded pixels at all? */
function canInspectPixels(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function'
  );
}

/**
 * A screenshot URI that will survive serialisation into a detached SVG.
 *
 * Native renderers load `file:`/`ph:` URIs through their own image pipeline
 * and are unaffected, so this is a pass-through everywhere except web — and
 * on web it is a no-op for a URI that is already inline.
 *
 * Throws rather than silently returning the original on failure: a `blob:`
 * URI that reaches the canvas is precisely the bug, and falling back to it
 * would reintroduce the thing this function exists to prevent.
 */
export async function toRasterisableHref(uri: string): Promise<string> {
  if (Platform.OS !== 'web') return uri;
  if (uri.startsWith('data:')) return uri;

  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('FileReader returned no data URI'));
          return;
        }
        resolve(result);
      };
      reader.readAsDataURL(blob);
    });
  } catch (cause) {
    throw new Error(
      `Could not inline the screenshot for capture (${String(cause)})`
    );
  }
}

/** Decode a URI into an HTMLImageElement. Web only. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to decode'));
    img.src = src;
  });
}

/** Alpha channel of `src` sampled onto a FIDELITY_GRID square. */
async function sampleAlpha(src: string): Promise<Uint8ClampedArray | null> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = FIDELITY_GRID;
  canvas.height = FIDELITY_GRID;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // Squash whatever aspect ratio into the grid — both images get the same
  // treatment, so cell i of one corresponds to cell i of the other.
  ctx.drawImage(img, 0, 0, FIDELITY_GRID, FIDELITY_GRID);
  return ctx.getImageData(0, 0, FIDELITY_GRID, FIDELITY_GRID).data;
}

/**
 * How much of `sourceHref` survived into `capturePngBase64`.
 *
 * Compares presence, not colour: a cell counts as matched when the source has
 * something there and the capture does too. Colour matching would flag the
 * strokes (which are supposed to differ) and every antialiasing difference
 * between the two rasterisers; presence isolates the one failure that matters
 * — the background going missing entirely.
 *
 * Returns `null` where pixels cannot be read (native), which
 * `assertCaptureFidelity` treats as "not measured".
 */
export async function measureCaptureFidelity(
  sourceHref: string,
  capturePngBase64: string
): Promise<CaptureFidelity | null> {
  if (!canInspectPixels()) return null;

  const [source, capture] = await Promise.all([
    sampleAlpha(sourceHref),
    sampleAlpha(`data:image/png;base64,${capturePngBase64}`),
  ]);
  if (!source || !capture) return null;

  return compareAlphaGrids(source, capture);
}
