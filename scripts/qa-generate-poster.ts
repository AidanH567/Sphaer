/**
 * scripts/qa-generate-poster.ts
 *
 * Render the poster template for REAL events and measure the result, so the
 * generator can be judged on pixels rather than on a green test suite.
 *
 *   npx tsx scripts/qa-generate-poster.ts              # 3 real events
 *   npx tsx scripts/qa-generate-poster.ts --limit 6
 *   npx tsx scripts/qa-generate-poster.ts --with-photo # also exercise the photo branch
 *   npx tsx scripts/qa-generate-poster.ts --offline    # synthetic fixtures, no network
 *   npx tsx scripts/qa-generate-poster.ts --families   # every family → contact sheet
 *
 * By default the real-event render is PHOTO-LESS, because that is the only
 * output the shipped feature produces: the app offers "Generate a poster" only
 * when an activity has no cover image. Feeding an event's existing poster back
 * in as the photo — which this script did at first — makes a much prettier
 * picture and proves nothing about what users will actually get. `--with-photo`
 * still does it, to keep the photo branch covered.
 *
 * WHY THIS EXISTS
 * `poster-guard.ts` deliberately does not sample pixels — decoding a PNG's
 * IDAT stream in JS on a phone to count opaque pixels is not a reasonable
 * thing to ship. So the guard asserts what a phone can honestly assert
 * (opaque full-bleed background, real text runs, a PNG of the right shape and
 * a plausible size), and THIS script is the evidence that a layout clearing
 * those checks actually paints something.
 *
 * It renders through `posterLayoutToSvgString` + sharp, which is a DIFFERENT
 * renderer from the react-native-svg one that runs on device. That is a real
 * limitation and is stated in the report: what this proves is that the solved
 * layout contains visible, well-placed content, not that a particular iPhone
 * rasterises it identically.
 *
 * WHAT IT MEASURES, per poster:
 *   * dimensions           — must be 1080×1528
 *   * visible pixels %     — the exact alpha metric from audit-posters.ts. The
 *                            eight broken posters in production score 0.0%.
 *   * ink coverage %       — pixels differing from the background colour. This
 *                            is the metric that actually matters here: a blank
 *                            poster with an opaque background scores 100% on
 *                            visible pixels and ~0% on ink.
 *
 * READ-ONLY. Fetches public events with the anon key; writes nothing to the
 * database and nothing to Storage. Output goes to docs/poster-qa/.
 */

import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import {
  buildPosterLayout,
  posterLayoutToSvgString,
  familyShortlist,
  POSTER_FAMILIES,
  POSTER_HEIGHT,
  POSTER_WIDTH,
  type PosterInput,
  type PosterLayout,
} from '../src/utils/poster-template';
import { assertLayoutIsPaintable, assertPngIsPlausible } from '../src/utils/poster-guard';
import { photoDataUri, QA_PHOTO_CROPS } from './poster-qa-photos';

const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env.local') });
dotenv.config({ path: path.join(projectRoot, '.env') });

const OUT_DIR = path.join(projectRoot, 'docs', 'poster-qa');

/** Below this fraction of non-transparent pixels a poster reads as empty. */
const MIN_OPAQUE_FRACTION = 0.05;
/**
 * Below this fraction of non-background pixels a poster is a flat colour field
 * with nothing on it. Tuned low on purpose: the template is mostly background
 * by design (that is what makes it a poster and not a screenshot), so real
 * output lands in the low single-digit percents. Anything under 0.5% means the
 * type did not paint.
 */
const MIN_INK_FRACTION = 0.005;

interface EventRow {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location_name: string | null;
  address: string | null;
  poster_url: string | null;
}

interface Measurement {
  width: number;
  height: number;
  bytes: number;
  opaqueFraction: number;
  inkFraction: number;
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

/**
 * Fraction of pixels whose colour differs meaningfully from the poster's own
 * background. The threshold of 24 per channel (of 255) is above JPEG-ish noise
 * and antialiasing fringe, and far below any real ink-on-background contrast in
 * the palette.
 */
async function inkFraction(buffer: Buffer, bg: string): Promise<number> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const hex = bg.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  const br = parseInt(full.slice(0, 2), 16);
  const bgG = parseInt(full.slice(2, 4), 16);
  const bb = parseInt(full.slice(4, 6), 16);

  let ink = 0;
  let total = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    total += 1;
    const dr = Math.abs(data[i] - br);
    const dg = Math.abs(data[i + 1] - bgG);
    const db = Math.abs(data[i + 2] - bb);
    if (dr + dg + db > 24) ink += 1;
  }
  return total === 0 ? 0 : ink / total;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'untitled'
  );
}

/** Fetch a remote image and inline it as a data URI, the only form the template takes. */
async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Normalise to JPEG: librsvg (and the RN renderer) both handle it, and it
    // keeps the embedded payload small enough that the SVG stays parseable.
    const jpeg = await sharp(buf)
      .resize(POSTER_WIDTH, 860, { fit: 'cover' })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return null;
  }
}

async function renderOne(input: PosterInput, slug: string): Promise<Measurement> {
  const layout = buildPosterLayout(input);
  // The same structural guard the app runs before it renders anything.
  assertLayoutIsPaintable(layout);

  const svg = posterLayoutToSvgString(layout);
  const png = await sharp(Buffer.from(svg), { density: 96 })
    .resize(POSTER_WIDTH, POSTER_HEIGHT)
    .png()
    .toBuffer();

  // The same output guard the upload path runs, on the same bytes.
  const header = assertPngIsPlausible(new Uint8Array(png), POSTER_WIDTH, POSTER_HEIGHT);

  fs.writeFileSync(path.join(OUT_DIR, `${slug}.png`), png);
  fs.writeFileSync(path.join(OUT_DIR, `${slug}.svg`), svg);

  return {
    width: header.width,
    height: header.height,
    bytes: png.length,
    opaqueFraction: await opaqueFraction(png),
    inkFraction: await inkFraction(png, layout.palette.bg),
  };
}

/** Synthetic inputs that exercise the layout's edges without needing network. */
const OFFLINE_FIXTURES: { label: string; input: PosterInput }[] = [
  {
    label: 'offline-short-title',
    input: {
      title: 'Nachtstrom',
      startsAt: '2026-09-12T22:00:00.000Z',
      endsAt: '2026-09-13T06:00:00.000Z',
      locationName: 'Sameheads',
    },
  },
  {
    label: 'offline-long-title',
    input: {
      title: 'An Evening of Improvised Electroacoustic Music and Expanded Cinema',
      startsAt: '2026-10-04T19:30:00.000Z',
      locationName: 'Acud Macht Neu',
    },
  },
  {
    label: 'offline-compound-noun',
    input: {
      title: 'Donaudampfschifffahrtsgesellschaftskapitänsabend',
      startsAt: '2026-11-21T20:00:00.000Z',
      address: 'Sonnenallee 123, 12059 Berlin',
    },
  },
];

// ─── Family contact sheet ────────────────────────────────────────────────────
/**
 * `--families` renders every layout family, with and without a photograph,
 * across several palettes and against realistic Berlin titles, then composes
 * the lot into one contact sheet plus a thumbnail strip.
 *
 * This mode exists because a green suite is not evidence. Yesterday a poster
 * passed every check in this repo and was blank; a mural test measured a wall
 * that never moved. Every assertion here still runs — `assertLayoutIsPaintable`
 * before rendering, `assertPngIsPlausible` on the bytes, opaque and ink
 * fractions on the pixels — but the OUTPUT is a picture a human looks at, and
 * that is the point of it.
 *
 * The thumbnail strip is not decoration either: these posters live on a mural
 * wall at roughly 120px wide. A composition that only works full-screen has
 * failed, and the strip is the only place that shows up.
 */

/** Titles chosen to break things: umlauts, ß, quotes, compounds, 66 characters. */
const QA_EVENTS: { title: string; categories: string[]; venue: string; startsAt: string; endsAt?: string }[] = [
  {
    title: 'Nachtstrom',
    categories: ['Music'],
    venue: 'Sameheads',
    startsAt: '2026-09-12T22:00:00.000Z',
    endsAt: '2026-09-13T06:00:00.000Z',
  },
  {
    title: 'SXTN — "Kann Sein, Dass Scheiße Wird" Tour',
    categories: ['Concert'],
    venue: 'Astra Kulturhaus',
    startsAt: '2026-10-30T21:30:00.000Z',
  },
  {
    title: 'Öffentliche Führung: Körper & Grenzen',
    categories: ['Art'],
    venue: 'Gropius Bau',
    startsAt: '2026-11-07T18:00:00.000Z',
    endsAt: '2026-11-07T20:00:00.000Z',
  },
  {
    title: 'An Evening of Improvised Electroacoustic Music and Expanded Cinema',
    categories: ['Film'],
    venue: 'Acud Macht Neu',
    startsAt: '2026-10-04T19:30:00.000Z',
  },
  {
    title: 'Donaudampfschifffahrtsgesellschaftskapitänsabend',
    categories: ['Talk'],
    venue: 'Sonnenallee 123, Neukölln',
    startsAt: '2026-11-21T20:00:00.000Z',
  },
  {
    title: 'Shiatsu Grundkurs',
    categories: ['Wellness'],
    venue: 'Studio Am Fluss',
    startsAt: '2026-03-22T10:00:00.000Z',
    endsAt: '2026-03-22T18:00:00.000Z',
  },
  {
    title: 'Klubnacht',
    categories: ['Music'],
    venue: 'Berghain',
    startsAt: '2026-08-29T23:59:00.000Z',
  },
  {
    title: 'Lines, Borders, Bodies — An Artist Talk',
    categories: ['Talk'],
    venue: 'ACUD Studio',
    startsAt: '2027-02-09T19:00:00.000Z',
    endsAt: '2027-02-09T21:30:00.000Z',
  },
];

/**
 * Solve a layout that is definitely `familyId`.
 *
 * Family choice is a pure function of the event, so the way to reach a specific
 * one is to walk `variant` — the very counter the Shuffle button increments.
 * Which means this helper is also an end-to-end exercise of Shuffle: if
 * shuffling could not reach a family, the sheet would come up short.
 */
function layoutForFamily(input: PosterInput, familyId: string): PosterLayout | null {
  for (let variant = 0; variant < 64; variant++) {
    const layout = buildPosterLayout({ ...input, variant });
    if (layout.family === familyId) return layout;
  }
  return null;
}

interface Tile {
  slug: string;
  label: string;
  family: string;
  palette: string;
  png: Buffer;
  measurement: Measurement;
  ok: boolean;
}

async function renderTile(
  input: PosterInput,
  familyId: string,
  slug: string
): Promise<Tile | null> {
  const layout = layoutForFamily(input, familyId);
  if (!layout) {
    console.log(`  ✗ ${slug}: no variant reached the '${familyId}' family`);
    return null;
  }
  // The same structural guard the app runs before it renders anything. Every
  // family has to clear it — that is the requirement, not a nice-to-have.
  assertLayoutIsPaintable(layout);

  const svg = posterLayoutToSvgString(layout);
  const png = await sharp(Buffer.from(svg), { density: 96 })
    .resize(POSTER_WIDTH, POSTER_HEIGHT)
    .png()
    .toBuffer();

  const header = assertPngIsPlausible(new Uint8Array(png), POSTER_WIDTH, POSTER_HEIGHT);
  const measurement: Measurement = {
    width: header.width,
    height: header.height,
    bytes: png.length,
    opaqueFraction: await opaqueFraction(png),
    inkFraction: await inkFraction(png, layout.palette.bg),
  };

  const dir = path.join(OUT_DIR, 'families');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${slug}.png`), png);

  const ok =
    measurement.width === POSTER_WIDTH &&
    measurement.height === POSTER_HEIGHT &&
    measurement.opaqueFraction >= MIN_OPAQUE_FRACTION &&
    measurement.inkFraction >= MIN_INK_FRACTION;

  return {
    slug,
    label: `${layout.family} · ${layout.palette.id} · ${input.photoDataUri ? 'photo' : 'no photo'}`,
    family: layout.family,
    palette: layout.palette.id,
    png,
    measurement,
    ok,
  };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Lay the tiles out on one sheet with a caption under each. */
async function composeSheet(
  tiles: Tile[],
  opts: { tileWidth: number; columns: number; heading: string; captions: boolean }
): Promise<Buffer> {
  const { tileWidth, columns, heading, captions } = opts;
  const tileHeight = Math.round((tileWidth * POSTER_HEIGHT) / POSTER_WIDTH);
  const gap = 18;
  const captionH = captions ? 44 : 12;
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
        `${tiles.length} posters · ${new Set(tiles.map((t) => t.family)).size} families · ` +
          `${new Set(tiles.map((t) => t.palette)).size} palettes · generated ${new Date()
            .toISOString()
            .slice(0, 10)}`
      )}</text>`
  );

  tiles.forEach((t, i) => {
    const { left, top } = positions[i];
    // Hairline so a bone or paper poster does not bleed into the sheet ground.
    overlay.push(
      `<rect x="${left - 0.5}" y="${top - 0.5}" width="${tileWidth + 1}" height="${
        tileHeight + 1
      }" fill="none" stroke="#BFBFBF" stroke-width="1"/>`
    );
    if (captions) {
      overlay.push(
        `<text x="${left}" y="${top + tileHeight + 20}" font-family="Helvetica, Arial, sans-serif" ` +
          `font-size="14" font-weight="700" fill="${t.ok ? '#141414' : '#C0392B'}">` +
          `${escapeXml(t.label)}</text>`
      );
      overlay.push(
        `<text x="${left}" y="${top + tileHeight + 38}" font-family="Helvetica, Arial, sans-serif" ` +
          `font-size="12" fill="#6B6B6B">${escapeXml(
            `${(t.measurement.inkFraction * 100).toFixed(1)}% ink · ${(
              t.measurement.bytes / 1024
            ).toFixed(0)} KB`
          )}</text>`
      );
    }
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
    .png()
    .toBuffer();
}

async function runFamilySheet(): Promise<boolean> {
  console.log(
    `Rendering ${POSTER_FAMILIES.length} families × 4 scenarios → docs/poster-qa/families/\n`
  );

  const tiles: Tile[] = [];

  for (let fi = 0; fi < POSTER_FAMILIES.length; fi++) {
    const family = POSTER_FAMILIES[fi];

    // A category shortlist is only two families wide, so `variant` cannot reach
    // a family the event's category does not route to — which is the selection
    // rule working, not a bug. So each family is shown on events whose CATEGORY
    // actually sends them there, which is the truthful sample; where there are
    // fewer than four such events, the rest are filled with uncategorised ones
    // (an uncategorised event can reach any family).
    const matching = QA_EVENTS.filter((ev) => familyShortlist(ev.categories).includes(family.id));
    const fillers = QA_EVENTS.filter((ev) => !matching.includes(ev));

    for (let k = 0; k < 4; k++) {
      const useCategories = k < matching.length;
      const ev = useCategories
        ? matching[k]
        : fillers[(k - matching.length) % Math.max(1, fillers.length)];
      // Alternate so every family shows two photographic tiles and two without.
      const wantsPhoto = k % 2 === 0;
      const crop = QA_PHOTO_CROPS[(fi * 2 + k) % QA_PHOTO_CROPS.length];

      const input: PosterInput = {
        title: ev.title,
        startsAt: ev.startsAt,
        endsAt: ev.endsAt ?? null,
        locationName: ev.venue,
        categories: useCategories ? ev.categories : [],
        photoDataUri: wantsPhoto
          ? await photoDataUri(crop, POSTER_WIDTH, POSTER_HEIGHT)
          : null,
      };

      const slug = `${family.id}-${k}-${slugify(ev.title)}${wantsPhoto ? '-photo' : ''}`;
      const tile = await renderTile(input, family.id, slug);
      if (!tile) continue;
      tiles.push(tile);
      console.log(
        `  ${tile.ok ? '✓' : '✗'} ${tile.label.padEnd(34)} ${(
          tile.measurement.inkFraction * 100
        )
          .toFixed(1)
          .padStart(5)}% ink  ${(tile.measurement.bytes / 1024).toFixed(0).padStart(3)} KB  ${
          ev.title.length > 40 ? `${ev.title.slice(0, 40)}…` : ev.title
        }`
      );
    }
  }

  const sheet = await composeSheet(tiles, {
    tileWidth: 300,
    columns: 4,
    heading: 'Sphaer poster families — QA contact sheet',
    captions: true,
  });
  fs.writeFileSync(path.join(OUT_DIR, '_families-contact-sheet.png'), sheet);

  // Mural scale. These sit on a wall at roughly this size, and a composition
  // that only reads full-screen has failed.
  const thumbs = await composeSheet(tiles, {
    tileWidth: 118,
    columns: 8,
    heading: 'At mural thumbnail size (118px wide — actual wall scale)',
    captions: false,
  });
  fs.writeFileSync(path.join(OUT_DIR, '_families-thumbnails.png'), thumbs);

  const passed = tiles.filter((t) => t.ok).length;
  console.log(`\n${passed}/${tiles.length} posters render with real, visible content.`);
  console.log(
    `Contact sheet  → docs/poster-qa/_families-contact-sheet.png\n` +
      `Thumbnail strip → docs/poster-qa/_families-thumbnails.png\n` +
      `LOOK at them.`
  );
  return passed === tiles.length && tiles.length >= 12;
}

async function loadRealEvents(limit: number): Promise<EventRow[]> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY — use --offline instead.');
  }
  const query =
    `${url}/rest/v1/events` +
    `?select=id,title,starts_at,ends_at,location_name,address,poster_url` +
    `&or=(visibility.is.null,visibility.eq.anyone)` +
    `&order=starts_at.desc&limit=${limit}`;
  const res = await fetch(query, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Failed to list events: ${res.status} ${res.statusText}`);
  return (await res.json()) as EventRow[];
}

function report(label: string, m: Measurement): boolean {
  const dimsOk = m.width === POSTER_WIDTH && m.height === POSTER_HEIGHT;
  const visibleOk = m.opaqueFraction >= MIN_OPAQUE_FRACTION;
  const inkOk = m.inkFraction >= MIN_INK_FRACTION;
  const ok = dimsOk && visibleOk && inkOk;
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  console.log(
    `      ${m.width}×${m.height}, ${(m.bytes / 1024).toFixed(1)} KB, ` +
      `${(m.opaqueFraction * 100).toFixed(1)}% visible pixels, ` +
      `${(m.inkFraction * 100).toFixed(2)}% ink`
  );
  if (!dimsOk) console.log(`      ✗ expected ${POSTER_WIDTH}×${POSTER_HEIGHT}`);
  if (!visibleOk) console.log('      ✗ effectively transparent — the blank-poster failure');
  if (!inkOk) console.log('      ✗ flat colour field — nothing painted on the background');
  return ok;
}

async function main() {
  const args = process.argv.slice(2);
  const offline = args.includes('--offline');
  const limitArg = args.indexOf('--limit');
  const limit = limitArg !== -1 ? Number(args[limitArg + 1]) || 3 : 3;

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // The family contact sheet is its own mode: it needs no network, renders
  // every family rather than whatever the database happens to hold, and its
  // real output is a picture rather than a line of numbers.
  if (args.includes('--families')) {
    const ok = await runFamilySheet();
    if (!ok) process.exit(1);
    return;
  }

  const results: boolean[] = [];

  if (offline) {
    console.log(`Rendering ${OFFLINE_FIXTURES.length} synthetic posters → docs/poster-qa/\n`);
    for (const fixture of OFFLINE_FIXTURES) {
      results.push(report(fixture.label, await renderOne(fixture.input, fixture.label)));
    }
  } else {
    const withPhoto = args.includes('--with-photo');
    const rows = await loadRealEvents(limit);
    console.log(
      `Rendering ${withPhoto ? 'photo' : 'typographic'} posters for ${rows.length} real events ` +
        `→ docs/poster-qa/\n`
    );
    for (const row of rows) {
      const photoDataUri =
        withPhoto && row.poster_url ? await fetchAsDataUri(row.poster_url) : null;
      const slug = `${slugify(row.title)}${photoDataUri ? '-photo' : ''}`;
      const m = await renderOne(
        {
          title: row.title,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          locationName: row.location_name,
          address: row.address,
          photoDataUri,
        },
        slug
      );
      results.push(report(`${slug}${photoDataUri ? '' : '  (no photo)'}`, m));
    }
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} posters render with real, visible content.`);
  console.log(`PNGs written to ${path.relative(projectRoot, OUT_DIR)} — LOOK at them.`);
  if (passed !== results.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
