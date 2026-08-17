/**
 * The blank-poster guard.
 *
 * ── The failure this exists to stop ──────────────────────────────────────────
 * Eight of the fifty seeded posters on the Mural are files that download with
 * HTTP 200, decode without error, report sane dimensions, and paint nothing:
 * valid WebPs whose alpha channel is entirely zero (see `scripts/audit-posters.ts`,
 * which found them at 0.0% visible pixels). Nothing in the app noticed. There
 * is no type, no HTTP status, and no `try/catch` that catches that.
 *
 * A generator that can produce the same artefact would make the Mural worse,
 * not better. So nothing reaches Storage without clearing two independent
 * checks:
 *
 *   1. `assertLayoutIsPaintable(layout)` — structural, runs BEFORE rendering.
 *      Confirms the poster's first drawn element is an opaque rect covering the
 *      whole canvas and that there is real text on it. A layout that passes
 *      this cannot render to a transparent image, because something opaque is
 *      always painted over every pixel.
 *
 *   2. `assertPngIsPlausible(bytes, w, h)` — runs on the rasteriser's OUTPUT.
 *      Parses the PNG signature and IHDR header and rejects anything that is
 *      not a real PNG at the dimensions we asked for, or is implausibly small.
 *      This catches the *other* way to get a blank poster: `toDataURL()` firing
 *      before the offscreen SVG has laid out, which returns a valid PNG that
 *      happens to be 0×0 or 1×1.
 *
 * ── What this deliberately does NOT do ───────────────────────────────────────
 * It does not sample pixels. Decoding a PNG's zlib-compressed IDAT stream in
 * JS on a phone to count opaque pixels is not a reasonable thing to ship, and
 * a wrong implementation of it would be a worse liability than the check is
 * worth. The genuine pixel-level measurement lives in
 * `scripts/qa-generate-poster.ts`, which renders the same layout with `sharp`
 * and runs the exact opaque-fraction logic from `audit-posters.ts`. The two
 * checks here are what a phone can honestly assert; the QA script is the
 * evidence that the template itself produces visible pixels.
 */

import type { PosterLayout } from '@/utils/poster-template';

export class PosterGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PosterGenerationError';
  }
}

/**
 * Floor for a plausible poster PNG, in bytes.
 *
 * Calibrated against the real rendered output: the QA render of a 1080×1528
 * poster is ~30 KB. A degenerate render (blank canvas, single flat colour, or
 * a stub) compresses to a small fraction of that. 4 KB sits well below any
 * genuine poster and well above any degenerate one — deliberately loose,
 * because this check's job is to catch catastrophe, not to police compression.
 */
export const MIN_POSTER_BYTES = 4096;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const BASE64_LOOKUP: Record<string, number> = {};
for (let i = 0; i < BASE64_ALPHABET.length; i++) {
  BASE64_LOOKUP[BASE64_ALPHABET[i]] = i;
}

/**
 * Decode base64 to bytes without depending on `atob` or `Buffer`.
 *
 * React Native, Hermes, and the web all disagree about which of those two is
 * present and how it behaves on binary payloads, and this runs on the path
 * that produces the bytes we upload — a subtly wrong decode would upload a
 * corrupt PNG, which is precisely the blank-tile outcome we are guarding
 * against. Thirty lines that are covered by tests beat a platform assumption.
 *
 * Accepts a bare base64 string or a full `data:image/png;base64,…` URI, since
 * `Svg.toDataURL()` returns the bare form on both native and web but callers
 * naturally hold the prefixed form for previewing.
 */
export function base64ToBytes(input: string): Uint8Array {
  const comma = input.indexOf(',');
  const raw = (input.startsWith('data:') && comma !== -1 ? input.slice(comma + 1) : input).replace(
    /[\r\n\s]/g,
    ''
  );
  const clean = raw.replace(/=+$/, '');

  const byteLength = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(byteLength);

  let buffer = 0;
  let bits = 0;
  let out = 0;
  for (let i = 0; i < clean.length; i++) {
    const value = BASE64_LOOKUP[clean[i]];
    if (value === undefined) {
      throw new PosterGenerationError('The poster image came back malformed. Please try again.');
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[out++] = (buffer >> bits) & 0xff;
    }
  }
  return out === byteLength ? bytes : bytes.subarray(0, out);
}

export interface PngHeader {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
}

/**
 * Read a PNG's IHDR. Returns null if the bytes are not a PNG whose first chunk
 * is a well-formed IHDR — which is itself a rejection, not an edge case.
 */
export function readPngHeader(bytes: Uint8Array): PngHeader | null {
  // 8 signature + 4 length + 4 type + 13 data = 29 bytes minimum.
  if (bytes.length < 29) return null;
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return null;
  }
  // Chunk length must be 13 for IHDR, and the type must read "IHDR".
  const chunkLength = readUint32(bytes, 8);
  if (chunkLength !== 13) return null;
  if (
    bytes[12] !== 0x49 || // I
    bytes[13] !== 0x48 || // H
    bytes[14] !== 0x44 || // D
    bytes[15] !== 0x52 // R
  ) {
    return null;
  }
  return {
    width: readUint32(bytes, 16),
    height: readUint32(bytes, 20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

/**
 * Structural check on the solved layout, run before anything is rendered.
 *
 * Throws unless the layout paints an opaque rect over the entire canvas and
 * carries at least two non-empty text runs (in practice: a title and the
 * wordmark). Passing this is what makes a transparent render impossible rather
 * than merely unlikely.
 */
export function assertLayoutIsPaintable(layout: PosterLayout): void {
  const bg = layout.background;
  const coversCanvas =
    bg.x <= 0 && bg.y <= 0 && bg.width >= layout.width && bg.height >= layout.height;
  if (!coversCanvas) {
    throw new PosterGenerationError(
      "Couldn't build the poster background. Please try again."
    );
  }
  if (!isOpaqueColor(bg.fill)) {
    throw new PosterGenerationError(
      "Couldn't build the poster background. Please try again."
    );
  }
  const visibleText = layout.texts.filter((t) => t.text.trim().length > 0 && t.opacity > 0.05);
  if (visibleText.length < 2) {
    throw new PosterGenerationError(
      'There is not enough information on this activity to make a poster yet. Add a title first.'
    );
  }
}

/** True for `#RGB` / `#RRGGBB` — no alpha channel, so nothing to see through. */
export function isOpaqueColor(fill: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(fill.trim());
}

/**
 * Output check on the rasterised PNG. `expectedWidth`/`expectedHeight` are the
 * canvas dimensions the layout asked for; a mismatch means the offscreen SVG
 * had not laid out when we snapshotted it.
 */
export function assertPngIsPlausible(
  bytes: Uint8Array,
  expectedWidth: number,
  expectedHeight: number
): PngHeader {
  const header = readPngHeader(bytes);
  if (!header) {
    throw new PosterGenerationError(
      "The poster didn't render properly on this device. Please try again."
    );
  }
  if (header.width !== expectedWidth || header.height !== expectedHeight) {
    throw new PosterGenerationError(
      `The poster rendered at ${header.width}×${header.height} instead of ` +
        `${expectedWidth}×${expectedHeight}. Please try again.`
    );
  }
  if (bytes.length < MIN_POSTER_BYTES) {
    throw new PosterGenerationError(
      'The poster came out blank. Please try again.'
    );
  }
  return header;
}
