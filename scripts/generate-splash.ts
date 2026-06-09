/**
 * scripts/generate-splash.ts
 *
 * Generates assets/images/splash.png to match the Figma Splash Screen
 * (node 2012:1757 in HIVq6Vaymj01dZ37AvwCUF / its drafts copy):
 *
 *   - Canvas: 1024×1024 white (#FFFFFF)
 *   - Logo: two overlapping horizontal hoops in chocolate (#2B2A27),
 *     centered, scaled up from the 78px source
 *   - Wordmark: "Sphaer" rendered below the logo with the same Figma
 *     overlap behaviour (-11px) and semibold weight
 *
 * Resolves a P2 backlog item: "Splash screen polish — current splash
 * is the Expo default. Custom Sphaer artwork matching the landing
 * screen."
 *
 *   npx tsx scripts/generate-splash.ts
 */

import sharp from 'sharp';
import * as path from 'node:path';
import * as fs from 'node:fs';

const projectRoot = path.resolve(__dirname, '..');
const OUT_PATH = path.join(projectRoot, 'assets', 'images', 'splash.png');

const CANVAS = 1024;
const INK = '#2B2A27';
const BG = '#FFFFFF';

// Logo source is 78×78. We scale it ~3× for the splash so it reads at
// reasonable size on a 1024 canvas without dominating it.
const LOGO_SCALE = 3;
const LOGO_SIZE = 78 * LOGO_SCALE; // 234

// Wordmark size — tuned visually to match the 124×34 Figma wordmark at
// 3× scale: roughly 102pt at semibold reads as ~120px tall, close to
// the 34 × 3 = 102 expected height of the rendered wordmark.
const WORDMARK_FONT_SIZE = 96;
const WORDMARK_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';

// Figma uses -11px between the logo and the wordmark — preserve the same
// proportional gap at 3× scale (-33px), then re-centre the cluster
// vertically. Cluster total height ≈ logo + wordmark + (negative gap).
const GAP = -11 * LOGO_SCALE;
const CLUSTER_HEIGHT = LOGO_SIZE + GAP + WORDMARK_FONT_SIZE;

// Centre the cluster vertically at the same 50% − 7.5px offset Figma uses
// (the spec lifts the cluster ~7.5px above the visual centre so the
// optical centre lands on the geometric centre).
const CLUSTER_TOP = (CANVAS - CLUSTER_HEIGHT) / 2 - 7.5;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <rect width="${CANVAS}" height="${CANVAS}" fill="${BG}"/>

  <!-- Logo: two overlapping hoops. Source paths are on a 78×78 viewBox,
       so we translate to the cluster origin then scale uniformly. -->
  <g transform="translate(${(CANVAS - LOGO_SIZE) / 2}, ${CLUSTER_TOP}) scale(${LOGO_SCALE})">
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
    />
  </g>

  <!-- Wordmark "Sphaer" — system sans-serif, semibold, kerned slightly
       wider than default to read as a confident logotype. -->
  <text
    x="${CANVAS / 2}"
    y="${CLUSTER_TOP + LOGO_SIZE + GAP + WORDMARK_FONT_SIZE * 0.78}"
    font-family='${WORDMARK_FONT_FAMILY}'
    font-size="${WORDMARK_FONT_SIZE}"
    font-weight="600"
    fill="${INK}"
    text-anchor="middle"
    letter-spacing="2"
  >Sphaer</text>
</svg>`;

async function main() {
  // Ensure the output directory exists.
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  fs.writeFileSync(OUT_PATH, buf);

  const size = (buf.length / 1024).toFixed(1);
  console.log(`✓ Wrote splash.png: ${CANVAS}×${CANVAS}, ${size} KB → ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
