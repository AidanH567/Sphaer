/**
 * scripts/qa-annotate-screenshot.ts
 *
 *   npx tsx scripts/qa-annotate-screenshot.ts
 *
 * Render a real annotated screenshot and MEASURE it, so the annotation feature
 * is judged on pixels rather than on a green test suite.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * This project has been burned three times by work that passed every check and
 * did nothing: a poster that rendered blank, a mural test that measured a wall
 * that never moved, icons that shipped through a successful deploy. The shape
 * is always the same — a file that is the right size, the right format, and
 * decodes without error, containing the wrong thing.
 *
 * An annotated screenshot can fail in exactly that shape. Flatten before the
 * image has decoded and you get a valid PNG of a circle on an empty
 * background. Get the coordinate space wrong and you get a valid PNG with the
 * circle in the wrong place. Neither is visible from the bytes, the
 * dimensions, or the file size — and both would be sent to a designer as a
 * report.
 *
 * So this script asserts things a test double cannot fake:
 *   1. the annotated image is the source's real dimensions
 *   2. pixels INSIDE the stroke actually changed — measured, not assumed
 *   3. pixels OUTSIDE the stroke did NOT change — the screenshot survives
 *      intact, so nothing about the reported UI is altered
 *   4. the marker colour is genuinely present in the output
 *   5. the SAME strokes at preview scale land at the same RELATIVE position —
 *      which is the property that stops the reporter circling one thing and
 *      sending a picture of another
 *
 * ── The honest limitation ────────────────────────────────────────────────────
 * This rasterises with sharp through an SVG string; the app rasterises with
 * react-native-svg on a device. They are DIFFERENT renderers. What is proven
 * here is that the geometry in `src/utils/annotation.ts` — which both use, and
 * which is the part that can silently be wrong — produces visible marks in the
 * right places. It is not proof that a particular iPhone rasterises it
 * identically. Same limitation, and the same reasoning, as
 * `scripts/qa-generate-poster.ts`.
 *
 * READ-ONLY. No network, no database, no Storage. Output to docs/annotation-qa/.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import {
  strokeToPathData,
  strokeWidthFor,
  type AnnotationStroke,
} from '../src/utils/annotation';
// The REAL marker colours, from the module the app draws with. Not a copy —
// `theme.ts` itself imports react-native, which esbuild cannot parse here, and
// hardcoding the hexes would let the QA render prove a colour the app does not
// actually use. Same split, and same reason, as poster-palette.ts.
import { annotationColors } from '../src/constants/annotation-colors';

const OUT_DIR = path.join(process.cwd(), 'docs', 'annotation-qa');

/**
 * Palette for the SYNTHETIC screen below only.
 *
 * Local on purpose: this is a stand-in screenshot, not app UI, so it must not
 * pull in the theme (which cannot be parsed here) and it is not bound by the
 * no-hardcoded-values rule that governs real components. These are eyeballed
 * approximations of Sphaer's feed, sufficient to be recognisably an app screen
 * with a bug in it.
 */
const MOCK = {
  background: '#F1F3F6',
  card: '#FFFFFF',
  placeholder: '#E8E6E1',
  ink: '#1B1B18',
  meta: '#767779',
  error: '#E53935',
  errorText: '#FFFFFF',
} as const;

/** A realistic phone screenshot size — iPhone 13/14 at 3x. */
const SOURCE_WIDTH = 1170;
const SOURCE_HEIGHT = 2532;

/**
 * A stand-in Sphaer screen with a DELIBERATE bug in it: the second card's
 * inner padding is wrong, and there is a red error strip further down.
 *
 * Synthetic rather than a captured screenshot for two reasons — it can live in
 * the repo without shipping anyone's real data, and it lets the QA render
 * demonstrate the actual use case Aidan described: a designer circling a
 * styling error that a sentence would not have located.
 */
function sourceScreenSvg(): string {
  const card = (y: number, padding: number, title: string) => `
    <rect x="48" y="${y}" width="1074" height="360" rx="28" fill="${MOCK.card}"/>
    <rect x="${48 + padding}" y="${y + padding}" width="${1074 - padding * 2}" height="200"
          rx="16" fill="${MOCK.placeholder}"/>
    <text x="${48 + padding}" y="${y + padding + 250}" font-family="Georgia, serif"
          font-size="44" fill="${MOCK.ink}">${title}</text>
    <text x="${48 + padding}" y="${y + padding + 305}" font-family="Helvetica, sans-serif"
          font-size="30" fill="${MOCK.meta}">Sat 22 Aug · Sameheads</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SOURCE_WIDTH}" height="${SOURCE_HEIGHT}"
     viewBox="0 0 ${SOURCE_WIDTH} ${SOURCE_HEIGHT}">
  <rect x="0" y="0" width="${SOURCE_WIDTH}" height="${SOURCE_HEIGHT}" fill="${MOCK.background}"/>
  <text x="48" y="180" font-family="Georgia, serif" font-size="72" fill="${MOCK.ink}">Feed</text>
  ${card(260, 32, 'Nachtstrom')}
  ${/* The bug: 96 instead of 32. */ ''}
  ${card(680, 96, 'Foreign Diplomats')}
  ${card(1100, 32, 'Open Mic Prenzlauer')}
  <rect x="48" y="1530" width="1074" height="120" rx="20" fill="${MOCK.error}"/>
  <text x="88" y="1605" font-family="Helvetica, sans-serif" font-size="36"
        fill="${MOCK.errorText}">Couldn't load your circles</text>
  ${card(1700, 32, 'Studio 8 Berlin')}
</svg>`;
}

/**
 * A hand-drawn-looking loop around a point, in NORMALISED coordinates.
 *
 * Built the way a finger would: a wobbling ellipse, decimated to about the
 * number of points a real drag survives. Deliberately not a perfect circle —
 * a perfect one would hide smoothing artefacts that a real stroke shows.
 */
function circleStroke(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string
): AnnotationStroke {
  const points = [];
  const steps = 34;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    // A little wobble, so it reads as drawn rather than generated.
    const wobble = 1 + Math.sin(t * 3) * 0.035;
    points.push({
      x: cx + Math.cos(t) * rx * wobble,
      y: cy + Math.sin(t) * ry * wobble,
    });
  }
  return { color, points };
}

/** Build the annotated SVG: the screenshot, then the marks on top. */
function annotatedSvg(
  sourcePngBase64: string,
  strokes: AnnotationStroke[],
  width: number,
  height: number
): string {
  const strokeWidth = strokeWidthFor(width, height);
  const paths = strokes
    .map(
      (stroke) =>
        `<path d="${strokeToPathData(stroke, width, height)}" stroke="${stroke.color}" ` +
        `stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
    )
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <image x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"
         xlink:href="data:image/png;base64,${sourcePngBase64}"/>
  ${paths}
</svg>`;
}

interface Rgba {
  data: Buffer;
  width: number;
  height: number;
  channels: number;
}

async function rawPixels(png: Buffer): Promise<Rgba> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

/** Bounding box of a stroke set in pixels, padded by the stroke width. */
function strokeBounds(strokes: AnnotationStroke[], width: number, height: number) {
  const pad = strokeWidthFor(width, height);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    for (const point of stroke.points) {
      minX = Math.min(minX, point.x * width);
      maxX = Math.max(maxX, point.x * width);
      minY = Math.min(minY, point.y * height);
      maxY = Math.max(maxY, point.y * height);
    }
  }
  return {
    minX: Math.floor(minX - pad),
    maxX: Math.ceil(maxX + pad),
    minY: Math.floor(minY - pad),
    maxY: Math.ceil(maxY + pad),
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

interface DiffReport {
  changed: number;
  changedInside: number;
  changedOutside: number;
  total: number;
  markerPixels: number;
  centroid: { x: number; y: number } | null;
}

/**
 * Compare the annotated image to the source it was drawn on.
 *
 * This is the measurement that a green test suite cannot give: it reads the
 * actual bytes of the actual rendered picture. "Decodes and is the right size"
 * proves nothing — that is precisely what the eight blank posters did.
 */
function diff(
  source: Rgba,
  annotated: Rgba,
  bounds: ReturnType<typeof strokeBounds>,
  markerHexes: string[]
): DiffReport {
  const markers = markerHexes.map(hexToRgb);
  let changed = 0;
  let changedInside = 0;
  let changedOutside = 0;
  let markerPixels = 0;
  let sumX = 0;
  let sumY = 0;

  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + x) * source.channels;
      const dr = Math.abs(source.data[i] - annotated.data[i]);
      const dg = Math.abs(source.data[i + 1] - annotated.data[i + 1]);
      const db = Math.abs(source.data[i + 2] - annotated.data[i + 2]);
      // A tolerance of 8 absorbs the rasteriser's own rounding on re-encode
      // without absorbing anything a stroke would do.
      if (dr + dg + db <= 8) continue;

      changed++;
      sumX += x;
      sumY += y;
      const inside =
        x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
      if (inside) changedInside++;
      else changedOutside++;

      const r = annotated.data[i];
      const g = annotated.data[i + 1];
      const b = annotated.data[i + 2];
      if (
        markers.some(
          ([mr, mg, mb]) =>
            Math.abs(r - mr) < 40 && Math.abs(g - mg) < 40 && Math.abs(b - mb) < 40
        )
      ) {
        markerPixels++;
      }
    }
  }

  return {
    changed,
    changedInside,
    changedOutside,
    total: source.width * source.height,
    markerPixels,
    centroid: changed > 0 ? { x: sumX / changed, y: sumY / changed } : null,
  };
}

const checks: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name} — ${detail}`);
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // ── The screenshot the reporter took ──────────────────────────────────────
  const sourcePng = await sharp(Buffer.from(sourceScreenSvg())).png().toBuffer();
  fs.writeFileSync(path.join(OUT_DIR, 'source-screenshot.png'), sourcePng);
  const sourceBase64 = sourcePng.toString('base64');

  // ── What Rabon would draw: circle the bad padding, circle the error ───────
  const strokes: AnnotationStroke[] = [
    // Round the over-padded card. Red, the default.
    circleStroke(0.5, 0.335, 0.44, 0.068, annotationColors.red),
    // Round the red error strip — in CYAN, because a red circle on a red
    // error is invisible. This is the entire argument for more than one
    // colour, and this render is the evidence for it.
    circleStroke(0.5, 0.627, 0.46, 0.032, annotationColors.cyan),
  ];

  console.log(`\nAnnotating a ${SOURCE_WIDTH}x${SOURCE_HEIGHT} screenshot with ${strokes.length} strokes`);
  console.log(`Stroke width at source scale: ${strokeWidthFor(SOURCE_WIDTH, SOURCE_HEIGHT).toFixed(2)}px\n`);

  // ── Flatten ───────────────────────────────────────────────────────────────
  const annotatedPng = await sharp(
    Buffer.from(annotatedSvg(sourceBase64, strokes, SOURCE_WIDTH, SOURCE_HEIGHT))
  )
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(OUT_DIR, 'annotated-screenshot.png'), annotatedPng);

  const source = await rawPixels(sourcePng);
  const annotated = await rawPixels(annotatedPng);
  const bounds = strokeBounds(strokes, SOURCE_WIDTH, SOURCE_HEIGHT);
  const report = diff(source, annotated, bounds, [
    annotationColors.red,
    annotationColors.cyan,
  ]);

  // ── The measurements ──────────────────────────────────────────────────────
  check(
    'annotated image is the source resolution',
    annotated.width === SOURCE_WIDTH && annotated.height === SOURCE_HEIGHT,
    `${annotated.width}x${annotated.height}`
  );

  check(
    'pixels actually changed where the strokes were drawn',
    report.changedInside > 5000,
    `${report.changedInside.toLocaleString()} pixels differ inside the stroke bounds`
  );

  check(
    'the screenshot itself is untouched outside the marks',
    report.changedOutside === 0,
    `${report.changedOutside} changed pixels outside the stroke bounds`
  );

  check(
    'the marker colour is present in the output',
    report.markerPixels > 3000,
    `${report.markerPixels.toLocaleString()} pixels are marker-coloured`
  );

  const inkPercent = (report.changed / report.total) * 100;
  check(
    'the marks are a mark, not a smear',
    inkPercent > 0.05 && inkPercent < 6,
    `${inkPercent.toFixed(3)}% of the image is ink`
  );

  // ── Scale invariance, measured in real pixels ─────────────────────────────
  // The unit tests assert this on the path strings. This asserts it on the
  // rendered result, which is what the reporter actually sees and sends.
  const PREVIEW_WIDTH = 340;
  const PREVIEW_HEIGHT = Math.round((SOURCE_HEIGHT / SOURCE_WIDTH) * PREVIEW_WIDTH);
  const previewSourcePng = await sharp(sourcePng)
    .resize(PREVIEW_WIDTH, PREVIEW_HEIGHT)
    .png()
    .toBuffer();
  const previewAnnotated = await sharp(
    Buffer.from(
      annotatedSvg(
        previewSourcePng.toString('base64'),
        strokes,
        PREVIEW_WIDTH,
        PREVIEW_HEIGHT
      )
    )
  )
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(OUT_DIR, 'annotated-preview.png'), previewAnnotated);

  const previewSource = await rawPixels(previewSourcePng);
  const previewOut = await rawPixels(previewAnnotated);
  const previewBounds = strokeBounds(strokes, PREVIEW_WIDTH, PREVIEW_HEIGHT);
  const previewReport = diff(previewSource, previewOut, previewBounds, [
    annotationColors.red,
    annotationColors.cyan,
  ]);

  if (report.centroid && previewReport.centroid) {
    const fullRel = { x: report.centroid.x / SOURCE_WIDTH, y: report.centroid.y / SOURCE_HEIGHT };
    const previewRel = {
      x: previewReport.centroid.x / PREVIEW_WIDTH,
      y: previewReport.centroid.y / PREVIEW_HEIGHT,
    };
    const drift = Math.hypot(fullRel.x - previewRel.x, fullRel.y - previewRel.y);
    check(
      'the preview and the flattened image mark the SAME place',
      drift < 0.01,
      `relative centroid drift ${(drift * 100).toFixed(3)}% of the image`
    );
  } else {
    check('the preview and the flattened image mark the SAME place', false, 'no ink found');
  }

  const previewInk = (previewReport.changed / previewReport.total) * 100;
  check(
    'the stroke stays proportionally as heavy on the preview',
    Math.abs(previewInk - inkPercent) < 1.2,
    `preview ink ${previewInk.toFixed(3)}% vs full ${inkPercent.toFixed(3)}%`
  );

  // ── What it looks like on a SMALL phone ───────────────────────────────────
  // iPhone SE, minus header and toolbar. This is the worst case for the
  // feature: a tall screenshot on a short phone is height-constrained, so the
  // drawing surface is only ~222pt wide. If the marks are illegible here they
  // are illegible where Lara and Rabon will actually be drawing them.
  const SE_BOX = { width: 320, height: 460 };
  const seScale = Math.min(SE_BOX.width / SOURCE_WIDTH, SE_BOX.height / SOURCE_HEIGHT);
  const seWidth = Math.round(SOURCE_WIDTH * seScale);
  const seHeight = Math.round(SOURCE_HEIGHT * seScale);
  const seSource = await sharp(sourcePng).resize(seWidth, seHeight).png().toBuffer();
  const seAnnotated = await sharp(
    Buffer.from(annotatedSvg(seSource.toString('base64'), strokes, seWidth, seHeight))
  )
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(OUT_DIR, 'small-phone-preview.png'), seAnnotated);

  const seReport = diff(
    await rawPixels(seSource),
    await rawPixels(seAnnotated),
    strokeBounds(strokes, seWidth, seHeight),
    [annotationColors.red, annotationColors.cyan]
  );
  check(
    'the marks are still visible on an iPhone SE preview',
    seReport.markerPixels > 200,
    `${seWidth}x${seHeight}pt surface, ${seReport.markerPixels.toLocaleString()} marker pixels, ` +
      `stroke ${strokeWidthFor(seWidth, seHeight).toFixed(2)}px`
  );

  // ── A side-by-side for a human to actually look at ────────────────────────
  const sheetScale = 0.28;
  const tileWidth = Math.round(SOURCE_WIDTH * sheetScale);
  const tileHeight = Math.round(SOURCE_HEIGHT * sheetScale);
  const gap = 24;
  await sharp({
    create: {
      width: tileWidth * 2 + gap * 3,
      height: tileHeight + gap * 2,
      channels: 4,
      background: { r: 24, g: 24, b: 24, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp(sourcePng).resize(tileWidth, tileHeight).toBuffer(),
        left: gap,
        top: gap,
      },
      {
        input: await sharp(annotatedPng).resize(tileWidth, tileHeight).toBuffer(),
        left: gap * 2 + tileWidth,
        top: gap,
      },
    ])
    .png()
    .toFile(path.join(OUT_DIR, 'before-after.png'));

  const failed = checks.filter((c) => !c.ok);
  console.log(
    `\n${checks.length - failed.length}/${checks.length} checks passed. ` +
      `Images written to docs/annotation-qa/\n`
  );
  if (failed.length > 0) {
    console.error('FAILED:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
