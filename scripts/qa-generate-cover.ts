/**
 * scripts/qa-generate-cover.ts
 *
 * Render the circle-cover generator for realistic circles and measure the
 * result, so the landscape families can be judged on pixels rather than on a
 * green test suite.
 *
 *   npx tsx scripts/qa-generate-cover.ts            # every family → two sheets
 *   npx tsx scripts/qa-generate-cover.ts --limit 4
 *
 * OFFLINE and READ-ONLY. It touches no network, no database and no Storage —
 * circles are synthesised from the fixture list below, which is deliberate:
 * production has 42 profiles and 171 events and this script must never be a
 * reason to reach for them.
 *
 * ── Why this is a sibling and not a flag on qa-generate-poster.ts ────────────
 * Everything about the OUTPUT differs: the tile aspect, the contact-sheet grid,
 * and above all the second sheet, which has no equivalent on the poster side.
 * The poster script's `composeSheet` hardcodes `POSTER_HEIGHT / POSTER_WIDTH`
 * for its tile aspect and would need an aspect parameter threaded through every
 * caller to be shared. Two focused scripts beat one with a mode switch.
 *
 * ── The second sheet is the point ────────────────────────────────────────────
 * A full-bleed 1440×810 render is NOT what anybody sees. `circles/[id].tsx`
 * displays a cover at `width: '100%', height: 160` with `contentFit="cover"`,
 * and hangs a 90pt avatar over its bottom-left corner. So this script emits:
 *
 *   _covers-contact-sheet.jpg   the full canvas, for judging the composition
 *   _covers-as-displayed.jpg    each cover CROPPED to the real display aspect,
 *                               at the real display size, with the avatar
 *                               drawn over it
 *
 * The second one is the honest test and it has already earned its place: it is
 * where you find out that a wordmark sitting at `height - 60` — where every
 * portrait family puts it — is not on screen at all.
 *
 * WHAT IT MEASURES, per cover:
 *   * dimensions       — must be 1440×810
 *   * visible pixels % — the alpha metric from audit-posters.ts. The eight
 *                        broken posters in production score 0.0%.
 *   * ink coverage %   — pixels differing from the background. A blank cover
 *                        with an opaque background scores 100% visible and ~0%
 *                        ink, which is exactly the failure this catches.
 *   * safe-band ink %  — ink INSIDE the uncropped band only. A cover that put
 *                        all its content in the cropped margins would pass the
 *                        ink check and show a person nothing.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import {
  buildCoverLayout,
  COVER_FAMILIES,
  COVER_HEIGHT,
  COVER_SAFE_BOTTOM_Y,
  COVER_SAFE_Y,
  COVER_WIDTH,
  type CoverInput,
  type CoverLayout,
} from '../src/utils/cover-template';
import { posterLayoutToSvgString } from '../src/utils/poster-template';
import { assertLayoutIsPaintable, assertPngIsPlausible } from '../src/utils/poster-guard';
import { photoDataUri, QA_PHOTO_CROPS } from './poster-qa-photos';

const projectRoot = path.resolve(__dirname, '..');
const OUT_DIR = path.join(projectRoot, 'docs', 'poster-qa');
const COVER_DIR = path.join(OUT_DIR, 'covers');

/** Below this fraction of non-transparent pixels a cover reads as empty. */
const MIN_OPAQUE_FRACTION = 0.05;
/** Below this fraction of non-background pixels nothing painted. */
const MIN_INK_FRACTION = 0.005;

/**
 * The real display geometry, straight off `app/(tabs)/circles/[id].tsx`.
 * `COVER_HEIGHT_PT` is the literal `height: 160`; the widths are the two phones
 * that bracket the range.
 */
const DISPLAY_WIDTH_PT = 393; // iPhone 15 / 14 Pro
const DISPLAY_WIDTH_PT_WIDE = 430; // Pro Max — the worst-case crop
const DISPLAY_HEIGHT_PT = 160;
const AVATAR_SIZE_PT = 90;
const AVATAR_LEFT_PT = 16;
/** The avatar hangs half below the banner: `bottom: -45`. */
const AVATAR_OVERHANG_PT = 45;

// ─── Fixtures ────────────────────────────────────────────────────────────────
/**
 * Names chosen to break the fitter: umlauts, ß, an ampersand, a one-word name,
 * a 52-character name, and a name whose first glyph is an emoji (the monogram
 * path in `ribbon` splits on it).
 */
const QA_CIRCLES: { name: string; tags: string[]; description?: string }[] = [
  { name: 'Neukölln Sound System', tags: ['Music'] },
  { name: 'Berlin Shiatsu', tags: ['Wellness', 'Therapy'] },
  { name: 'Kollektiv für Bewegte Bilder & Expanded Cinema', tags: ['Film'] },
  { name: 'Grauzone', tags: ['Art', 'Design'] },
  { name: 'Donaudampfschifffahrtsgesellschaftskapitänsverein', tags: ['Community'] },
  { name: 'Civic AI Berlin', tags: ['Tech'] },
  { name: '🌱 Prinzessinnengarten', tags: ['Food', 'Community'] },
  { name: 'Frauen im Netzwerk', tags: [] },
];

interface Measurement {
  width: number;
  height: number;
  bytes: number;
  opaqueFraction: number;
  inkFraction: number;
  safeBandInkFraction: number;
}

interface Tile {
  slug: string;
  label: string;
  family: string;
  palette: string;
  png: Buffer;
  measurement: Measurement;
  ok: boolean;
  notes: string[];
}

/** Exactly the sampling from scripts/audit-posters.ts, so the numbers compare. */
async function opaqueFraction(buffer: Buffer): Promise<number> {
  const image = sharp(buffer);
  const meta = await image.metadata();
  if (!meta.hasAlpha) return 1;
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  let total = 0;
  for (let i = 0; i < data.length; i += info.channels * 53) {
    total += 1;
    if (data[i + 3] > 10) opaque += 1;
  }
  return total === 0 ? 1 : opaque / total;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * Fraction of pixels differing meaningfully from the cover's own background,
 * optionally restricted to a horizontal band.
 */
async function inkFraction(
  buffer: Buffer,
  bg: string,
  band?: { top: number; bottom: number }
): Promise<number> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [br, bgG, bb] = hexToRgb(bg);

  const yTop = band ? Math.max(0, Math.round((band.top / COVER_HEIGHT) * info.height)) : 0;
  const yBottom = band
    ? Math.min(info.height, Math.round((band.bottom / COVER_HEIGHT) * info.height))
    : info.height;

  let ink = 0;
  let total = 0;
  for (let y = yTop; y < yBottom; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      total += 1;
      const dr = Math.abs(data[i] - br);
      const dg = Math.abs(data[i + 1] - bgG);
      const db = Math.abs(data[i + 2] - bb);
      if (dr + dg + db > 24) ink += 1;
    }
  }
  return total === 0 ? 0 : ink / total;
}

/**
 * Solve a layout that is definitely `familyId`.
 *
 * Family choice is a pure function of the circle, so the way to reach a
 * specific one is to walk `variant` — the counter Shuffle increments. Which
 * makes this an end-to-end exercise of Shuffle too: if shuffling could not
 * reach a family, the sheet would come up short.
 */
function layoutForFamily(
  input: CoverInput,
  familyId: string
): { layout: CoverLayout; untagged: boolean } | null {
  for (let variant = 0; variant < 64; variant++) {
    const layout = buildCoverLayout({ ...input, variant });
    if (layout.family === familyId) return { layout, untagged: false };
  }
  // Not reachable with these tags, which is the shortlist working as intended —
  // a Music circle is never offered `marquee`. For the contact sheet we still
  // want to SEE every family against every name, so retry with the tags
  // stripped, which opens the full set, and say so on the tile.
  for (let variant = 0; variant < 64; variant++) {
    const layout = buildCoverLayout({ ...input, tags: [], variant });
    if (layout.family === familyId) return { layout, untagged: true };
  }
  return null;
}

async function renderTile(
  input: CoverInput,
  familyId: string,
  slug: string
): Promise<Tile | null> {
  const solved = layoutForFamily(input, familyId);
  if (!solved) {
    console.log(`  x ${slug}: no variant reached the '${familyId}' family`);
    return null;
  }
  const { layout, untagged } = solved;
  // The same structural guard the app runs before rendering anything. It is
  // aspect-agnostic already, which is the whole reason a second canvas shape
  // needed no changes to it.
  assertLayoutIsPaintable(layout);

  const svg = posterLayoutToSvgString(layout);
  const png = await sharp(Buffer.from(svg), { density: 96 })
    .resize(COVER_WIDTH, COVER_HEIGHT)
    .png()
    .toBuffer();

  const header = assertPngIsPlausible(new Uint8Array(png), COVER_WIDTH, COVER_HEIGHT);

  const measurement: Measurement = {
    width: header.width,
    height: header.height,
    bytes: png.length,
    opaqueFraction: await opaqueFraction(png),
    inkFraction: await inkFraction(png, layout.palette.bg),
    safeBandInkFraction: await inkFraction(png, layout.palette.bg, {
      top: COVER_SAFE_Y,
      bottom: COVER_SAFE_BOTTOM_Y,
    }),
  };

  fs.mkdirSync(COVER_DIR, { recursive: true });
  fs.writeFileSync(path.join(COVER_DIR, `${slug}.png`), png);

  const notes: string[] = [];
  if (measurement.width !== COVER_WIDTH || measurement.height !== COVER_HEIGHT) {
    notes.push(`wrong size ${measurement.width}x${measurement.height}`);
  }
  if (measurement.opaqueFraction < MIN_OPAQUE_FRACTION) notes.push('transparent');
  if (measurement.inkFraction < MIN_INK_FRACTION) notes.push('no ink');
  // The check the poster script has no equivalent of: content has to survive
  // the crop, not merely exist.
  if (measurement.safeBandInkFraction < MIN_INK_FRACTION) notes.push('nothing in safe band');

  return {
    slug,
    label:
      `${layout.family} · ${layout.palette.id} · ` +
      `${input.photoDataUri ? 'photo' : 'no photo'}${untagged ? ' · untagged' : ''}`,
    family: layout.family,
    palette: layout.palette.id,
    png,
    measurement,
    ok: notes.length === 0,
    notes,
  };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Sheet 1: the full canvas ────────────────────────────────────────────────

async function composeSheet(tiles: Tile[], heading: string): Promise<Buffer> {
  const tileWidth = 460;
  const tileHeight = Math.round((tileWidth * COVER_HEIGHT) / COVER_WIDTH);
  const columns = 2;
  const gap = 18;
  const captionH = 46;
  const headerH = 86;
  const rows = Math.ceil(tiles.length / columns);

  const sheetWidth = gap + columns * (tileWidth + gap);
  const sheetHeight = headerH + rows * (tileHeight + captionH + gap) + gap;

  const resized = await Promise.all(
    tiles.map((t) => sharp(t.png).resize(tileWidth, tileHeight).png().toBuffer())
  );

  const positions = tiles.map((_, i) => ({
    left: gap + (i % columns) * (tileWidth + gap),
    top: headerH + Math.floor(i / columns) * (tileHeight + captionH + gap),
  }));

  const overlay: string[] = [];
  overlay.push(
    `<text x="${gap}" y="46" font-family="Helvetica, Arial, sans-serif" font-size="30" ` +
      `font-weight="700" fill="#141414">${escapeXml(heading)}</text>`
  );
  overlay.push(
    `<text x="${gap}" y="70" font-family="Helvetica, Arial, sans-serif" font-size="15" ` +
      `fill="#5A5A5A">${escapeXml(
        `${tiles.length} covers · ${new Set(tiles.map((t) => t.family)).size} families · ` +
          `${new Set(tiles.map((t) => t.palette)).size} palettes · ${COVER_WIDTH}x${COVER_HEIGHT} · ` +
          `generated ${new Date().toISOString().slice(0, 10)}`
      )}</text>`
  );

  tiles.forEach((t, i) => {
    const { left, top } = positions[i];
    overlay.push(
      `<rect x="${left - 0.5}" y="${top - 0.5}" width="${tileWidth + 1}" height="${
        tileHeight + 1
      }" fill="none" stroke="#BFBFBF" stroke-width="1"/>`
    );
    // The crop lines: everything outside them is gone on a real phone.
    const safeTopPx = top + (COVER_SAFE_Y / COVER_HEIGHT) * tileHeight;
    const safeBottomPx = top + (COVER_SAFE_BOTTOM_Y / COVER_HEIGHT) * tileHeight;
    for (const y of [safeTopPx, safeBottomPx]) {
      overlay.push(
        `<line x1="${left}" y1="${y}" x2="${left + tileWidth}" y2="${y}" ` +
          `stroke="#FF3B30" stroke-width="1" stroke-dasharray="5 4" opacity="0.85"/>`
      );
    }
    overlay.push(
      `<text x="${left}" y="${top + tileHeight + 20}" font-family="Helvetica, Arial, sans-serif" ` +
        `font-size="14" font-weight="700" fill="${t.ok ? '#141414' : '#C0392B'}">` +
        `${escapeXml(t.label)}</text>`
    );
    overlay.push(
      `<text x="${left}" y="${top + tileHeight + 38}" font-family="Helvetica, Arial, sans-serif" ` +
        `font-size="12" fill="#6B6B6B">${escapeXml(
          `${(t.measurement.inkFraction * 100).toFixed(1)}% ink · ` +
            `${(t.measurement.safeBandInkFraction * 100).toFixed(1)}% in safe band · ` +
            `${(t.measurement.bytes / 1024).toFixed(0)} KB` +
            (t.notes.length ? ` · ${t.notes.join(', ')}` : '')
        )}</text>`
    );
  });

  const overlaySvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth}" height="${sheetHeight}">` +
    overlay.join('') +
    `</svg>`;

  return sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 0xf2, g: 0xf1, b: 0xef, alpha: 1 },
    },
  })
    .composite([
      ...resized.map((buf, i) => ({ input: buf, left: positions[i].left, top: positions[i].top })),
      { input: Buffer.from(overlaySvg), left: 0, top: 0 },
    ])
    .jpeg({ quality: 86 })
    .toBuffer();
}

// ─── Sheet 2: as actually displayed ──────────────────────────────────────────

/**
 * Crop a cover the way `contentFit="cover"` does into a `widthPt × 160pt` box,
 * then draw the circle avatar over it.
 *
 * This is the sheet that answers the only question that matters — is the thing
 * legible where a person meets it — and it is why the safe band exists.
 */
async function renderAsDisplayed(
  tile: Tile,
  widthPt: number,
  scale: number
): Promise<Buffer> {
  const boxW = Math.round(widthPt * scale);
  const boxH = Math.round(DISPLAY_HEIGHT_PT * scale);

  const cropped = await sharp(tile.png)
    .resize(boxW, boxH, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  const avatar = Math.round(AVATAR_SIZE_PT * scale);
  const avatarLeft = Math.round(AVATAR_LEFT_PT * scale);
  const avatarTop = boxH - Math.round(AVATAR_OVERHANG_PT * scale);

  // The avatar as the screen draws it: a white-ringed circle, half over the
  // banner. Drawn in flat grey because what matters is what it HIDES.
  const avatarSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${boxW}" height="${boxH}">` +
    `<circle cx="${avatarLeft + avatar / 2}" cy="${avatarTop + avatar / 2}" r="${avatar / 2}" ` +
    `fill="#C9C6BE" stroke="#FFFFFF" stroke-width="${Math.max(2, Math.round(2 * scale))}"/>` +
    `</svg>`;

  return sharp(cropped)
    .composite([{ input: Buffer.from(avatarSvg), left: 0, top: 0 }])
    .png()
    .toBuffer();
}

async function composeDisplaySheet(tiles: Tile[]): Promise<Buffer> {
  const scale = 2;
  const gap = 20;
  const headerH = 92;
  const captionH = 40;
  const rowH = Math.round(DISPLAY_HEIGHT_PT * scale);
  const narrowW = Math.round(DISPLAY_WIDTH_PT * scale);
  const wideW = Math.round(DISPLAY_WIDTH_PT_WIDE * scale);

  const sheetWidth = gap * 3 + narrowW + wideW;
  const sheetHeight = headerH + tiles.length * (rowH + captionH + gap) + gap;

  const rendered = await Promise.all(
    tiles.map(async (t) => ({
      narrow: await renderAsDisplayed(t, DISPLAY_WIDTH_PT, scale),
      wide: await renderAsDisplayed(t, DISPLAY_WIDTH_PT_WIDE, scale),
    }))
  );

  const overlay: string[] = [];
  overlay.push(
    `<text x="${gap}" y="42" font-family="Helvetica, Arial, sans-serif" font-size="28" ` +
      `font-weight="700" fill="#141414">Circle covers AS DISPLAYED — the honest test</text>`
  );
  overlay.push(
    `<text x="${gap}" y="66" font-family="Helvetica, Arial, sans-serif" font-size="14" ` +
      `fill="#5A5A5A">${escapeXml(
        `Cropped by contentFit="cover" into width x 160pt and overlaid with the 90pt avatar, ` +
          `exactly as circles/[id].tsx draws it. Shown at 2x.`
      )}</text>`
  );
  overlay.push(
    `<text x="${gap}" y="86" font-family="Helvetica, Arial, sans-serif" font-size="13" ` +
      `font-weight="700" fill="#141414">393pt (iPhone 15) — 27.6% cropped` +
      `</text>`
  );
  overlay.push(
    `<text x="${gap * 2 + narrowW}" y="86" font-family="Helvetica, Arial, sans-serif" ` +
      `font-size="13" font-weight="700" fill="#141414">430pt (Pro Max) — 33.9% cropped</text>`
  );

  const composites: sharp.OverlayOptions[] = [];
  tiles.forEach((t, i) => {
    const top = headerH + i * (rowH + captionH + gap);
    composites.push({ input: rendered[i].narrow, left: gap, top });
    composites.push({ input: rendered[i].wide, left: gap * 2 + narrowW, top });
    overlay.push(
      `<text x="${gap}" y="${top + rowH + 24}" font-family="Helvetica, Arial, sans-serif" ` +
        `font-size="14" font-weight="700" fill="${t.ok ? '#141414' : '#C0392B'}">` +
        `${escapeXml(t.label)}</text>`
    );
  });

  const overlaySvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth}" height="${sheetHeight}">` +
    overlay.join('') +
    `</svg>`;

  return sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 0xf2, g: 0xf1, b: 0xef, alpha: 1 },
    },
  })
    .composite([...composites, { input: Buffer.from(overlaySvg), left: 0, top: 0 }])
    .jpeg({ quality: 86 })
    .toBuffer();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : QA_CIRCLES.length;

  fs.mkdirSync(COVER_DIR, { recursive: true });

  const circles = QA_CIRCLES.slice(0, Math.max(1, limit));
  console.log(
    `Rendering ${COVER_FAMILIES.length} cover families x ${circles.length} circles ` +
      `-> docs/poster-qa/covers/\n`
  );

  const tiles: Tile[] = [];
  let photoIndex = 0;

  for (const family of COVER_FAMILIES) {
    for (let i = 0; i < circles.length; i++) {
      const circle = circles[i];
      // Alternate photo / no photo so every family is seen both ways.
      const wantsPhoto = i % 2 === 1;
      const crop = QA_PHOTO_CROPS[photoIndex % QA_PHOTO_CROPS.length];
      const photo = wantsPhoto
        ? await photoDataUri(crop, COVER_WIDTH, COVER_HEIGHT)
        : null;
      if (wantsPhoto) photoIndex += 1;

      const input: CoverInput = {
        name: circle.name,
        tags: circle.tags,
        description: circle.description ?? null,
        photoDataUri: photo,
      };

      const slug = `${family.id}-${i}-${wantsPhoto ? 'photo' : 'flat'}`;
      const tile = await renderTile(input, family.id, slug);
      if (!tile) continue;
      tiles.push(tile);
      console.log(
        `  ${tile.ok ? 'OK' : '!!'} ${slug.padEnd(22)} ${tile.label.padEnd(34)} ` +
          `${(tile.measurement.inkFraction * 100).toFixed(1)}% ink · ` +
          `${(tile.measurement.safeBandInkFraction * 100).toFixed(1)}% safe` +
          (tile.notes.length ? `  << ${tile.notes.join(', ')}` : '')
      );
    }
  }

  if (tiles.length === 0) {
    console.error('No tiles rendered.');
    process.exitCode = 1;
    return;
  }

  // JPEG, not PNG. These sheets carry photographs and the as-displayed one is
  // 1706x9232; as PNG it lands at 7.4 MB, which is not a reasonable thing to
  // put in git history every time the families are touched. `docs/poster-reference`
  // already sets the precedent with a 315 KB contact-sheet.jpg.
  const sheet = await composeSheet(tiles, 'Sphaer circle covers — QA contact sheet');
  fs.writeFileSync(path.join(OUT_DIR, '_covers-contact-sheet.jpg'), sheet);

  const displaySheet = await composeDisplaySheet(tiles);
  fs.writeFileSync(path.join(OUT_DIR, '_covers-as-displayed.jpg'), displaySheet);

  const failed = tiles.filter((t) => !t.ok);
  console.log(
    `\nContact sheet  -> docs/poster-qa/_covers-contact-sheet.jpg\n` +
      `As displayed   -> docs/poster-qa/_covers-as-displayed.jpg\n` +
      `${tiles.length} rendered, ${failed.length} flagged.\n` +
      `LOOK at the second sheet — it is the only one showing what a person sees.`
  );
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
