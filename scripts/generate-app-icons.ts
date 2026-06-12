/**
 * scripts/generate-app-icons.ts
 *
 * Generates the app icon set from the same SphaerIcon two-hoop artwork
 * used by scripts/generate-splash.ts (Figma node 2012:1757 lineage):
 *
 *   - assets/images/icon.png          1024×1024, white (#FFFFFF) canvas,
 *     hoops in chocolate (#2B2A27) centred. Glyph only — no wordmark,
 *     since icons read better as a mark at small sizes.
 *   - assets/images/adaptive-icon.png 1024×1024 Android adaptive-icon
 *     FOREGROUND layer: transparent background, hoops scaled down so the
 *     whole glyph fits inside the adaptive-icon safe zone (a centred
 *     circle of 66/108 of the canvas — launchers may mask anything
 *     outside it). The solid white back layer comes from
 *     android.adaptiveIcon.backgroundColor in app.json.
 *   - assets/images/favicon.png       48×48 (Expo's web default), same
 *     white-canvas artwork rendered at the full 1024px internal canvas
 *     with a larger glyph fraction (so the hoops survive tab size), then
 *     Lanczos-downsampled to 48px so the thin strokes anti-alias cleanly
 *     instead of vanishing.
 *
 * Resolves the P0 backlog item: "App icons are 1×1 placeholder stubs."
 *
 *   npx tsx scripts/generate-app-icons.ts
 */

import sharp from 'sharp';
import * as path from 'node:path';
import * as fs from 'node:fs';

const projectRoot = path.resolve(__dirname, '..');
const ICON_PATH = path.join(projectRoot, 'assets', 'images', 'icon.png');
const ADAPTIVE_PATH = path.join(projectRoot, 'assets', 'images', 'adaptive-icon.png');
const FAVICON_PATH = path.join(projectRoot, 'assets', 'images', 'favicon.png');

const CANVAS = 1024;
const INK = '#2B2A27';
const BG = '#FFFFFF';

// ── Source artwork geometry ──────────────────────────────────────────────
// The two hoop paths live on a 78×78 viewBox. Their painted ("ink")
// bounding box, including the 3.4px stroke (±1.7px past the path):
//   x: 15.7002 − 1.7 → 62.2998 + 1.7   = 14.0    → 64.0      (w = 50.0)
//   y: 22.7002 − 1.7 → 54.7166 + 1.7   = 21.0002 → 56.4166   (h = 35.4164)
const INK_W = 50.0;
const INK_H = 35.4164;
const INK_CX = 39.0; // horizontal ink centre (paths are symmetric in x)
const INK_CY = (21.0002 + 56.4166) / 2; // 38.7084

// ── icon.png sizing ──────────────────────────────────────────────────────
// Glyph-only icons want more presence than the splash lockup: target the
// hoops at ~62% of the canvas width, optically centred.
const ICON_GLYPH_FRACTION = 0.62;
const ICON_SCALE = (CANVAS * ICON_GLYPH_FRACTION) / INK_W; // ≈ 12.7

// ── adaptive-icon.png sizing ─────────────────────────────────────────────
// Android adaptive icons are authored on a 108dp grid; launchers are only
// guaranteed to show a centred circle of 66dp diameter. At 1024px that
// safe circle is 66/108 × 1024 ≈ 625.8px across. Scale the glyph so its
// corner-to-corner half-diagonal fits inside the safe radius.
const SAFE_RADIUS = ((66 / 108) * CANVAS) / 2; // ≈ 312.9
const INK_HALF_DIAGONAL = Math.sqrt((INK_W / 2) ** 2 + (INK_H / 2) ** 2); // ≈ 30.64
const ADAPTIVE_SCALE = SAFE_RADIUS / INK_HALF_DIAGONAL; // ≈ 10.2

// ── favicon.png sizing ───────────────────────────────────────────────────
// Expo's web default favicon is 48×48. Rendering the SVG straight at 48px
// would leave the 3.4-unit strokes ~2px and ragged, so render at the full
// 1024px canvas — with the glyph pushed to 80% width for legibility at tab
// size — then downsample to 48px (Lanczos) for clean anti-aliased strokes.
const FAVICON_SIZE = 48;
const FAVICON_GLYPH_FRACTION = 0.8;
const FAVICON_SCALE = (CANVAS * FAVICON_GLYPH_FRACTION) / INK_W; // ≈ 16.4

/** The two-hoop logo paths (78×78 source viewBox), stroke-scaled by the group transform. */
const HOOPS = `
    <path
      d="M15.7002 33.5C15.7002 31.039 17.7396 28.3533 22.083 26.1816C26.3247 24.0609 32.3033 22.7002 39 22.7002C45.6967 22.7002 51.6753 24.0609 55.917 26.1816C60.2604 28.3533 62.2998 31.039 62.2998 33.5C62.2998 35.961 60.2604 38.6467 55.917 40.8184C51.6753 42.9391 45.6967 44.2998 39 44.2998C32.3033 44.2998 26.3247 42.9391 22.083 40.8184C17.7396 38.6467 15.7002 35.961 15.7002 33.5Z"
      stroke="${INK}"
      stroke-width="3.4"
      fill="none"
    />
    <path
      d="M15.7002 43.9167C15.7002 41.4558 17.7396 38.7701 22.083 36.5984C26.3247 34.4776 32.3033 33.1169 39 33.1169C45.6967 33.1169 51.6753 34.4776 55.917 36.5984C60.2604 38.7701 62.2998 41.4558 62.2998 43.9167C62.2998 46.3777 60.2604 49.0634 55.917 51.2351C51.6753 53.3559 45.6967 54.7166 39 54.7166C32.3033 54.7166 26.3247 53.3559 22.083 51.2351C17.7396 49.0634 15.7002 46.3777 15.7002 43.9167Z"
      stroke="${INK}"
      stroke-width="3.4"
      fill="none"
    />`;

/** Build a 1024×1024 SVG with the hoops' ink centre on the canvas centre. */
function iconSvg(scale: number, opaqueBackground: boolean): string {
  const tx = CANVAS / 2 - INK_CX * scale;
  const ty = CANVAS / 2 - INK_CY * scale;
  const background = opaqueBackground
    ? `\n  <rect width="${CANVAS}" height="${CANVAS}" fill="${BG}"/>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">${background}
  <g transform="translate(${tx}, ${ty}) scale(${scale})">${HOOPS}
  </g>
</svg>`;
}

async function writePng(
  svg: string,
  outPath: string,
  label: string,
  outSize: number = CANVAS,
): Promise<void> {
  let pipeline = sharp(Buffer.from(svg));
  if (outSize !== CANVAS) {
    pipeline = pipeline.resize(outSize, outSize, { kernel: sharp.kernel.lanczos3 });
  }
  const buf = await pipeline.png().toBuffer();
  fs.writeFileSync(outPath, buf);
  const size = (buf.length / 1024).toFixed(1);
  console.log(`✓ Wrote ${label}: ${outSize}×${outSize}, ${size} KB → ${outPath}`);
}

async function main() {
  fs.mkdirSync(path.dirname(ICON_PATH), { recursive: true });

  // iOS / universal icon — opaque white, glyph at ~62% width.
  await writePng(iconSvg(ICON_SCALE, true), ICON_PATH, 'icon.png');

  // Android adaptive-icon foreground — transparent, glyph inside the
  // 66/108 safe-zone circle (white comes from adaptiveIcon.backgroundColor).
  await writePng(iconSvg(ADAPTIVE_SCALE, false), ADAPTIVE_PATH, 'adaptive-icon.png');

  // Web favicon — opaque white like icon.png (chocolate hoops stay visible
  // on dark browser tabs), rendered large then downsampled to 48×48.
  await writePng(iconSvg(FAVICON_SCALE, true), FAVICON_PATH, 'favicon.png', FAVICON_SIZE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
