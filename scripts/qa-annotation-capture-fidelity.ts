/**
 * scripts/qa-annotation-capture-fidelity.ts
 *
 *   npx tsx scripts/qa-annotation-capture-fidelity.ts
 *
 * Prove that the annotated screenshot actually CONTAINS the screenshot.
 *
 * ── Why this exists next to qa-annotate-screenshot.ts ────────────────────────
 * That script already measures the annotation geometry, and it is good at it.
 * It also could not possibly have caught the bug that shipped, and the reason
 * is worth stating plainly: it builds its SVG with
 *
 *     xlink:href="data:image/png;base64,${sourcePngBase64}"
 *
 * — the image ALWAYS inlined. The app did not do that. `expo-image-picker` on
 * web hands back `URL.createObjectURL(file)`, a `blob:` URI, and that is what
 * went into `<Image href>`. So the QA proved the geometry using the one href
 * form that always works, while production used the one that never does. The
 * check and the thing being checked had quietly stopped being the same.
 *
 * ── The mechanism being reproduced ───────────────────────────────────────────
 * `Svg.toDataURL()` on web does not photograph the live SVG. It clones the
 * node, serialises it, and rasterises the string through an `<img>`:
 *
 *     img.src = `data:image/svg+xml;utf8,${encodeSvg(serialised)}`;
 *
 * An SVG loaded via `<img>` renders in the browser's SECURE STATIC MODE, in
 * which NO external resource may be fetched. `blob:` is external. The image
 * silently resolves to nothing and the canvas gets the strokes over a void —
 * a valid PNG, correct dimensions, wrong contents. The fourth time this
 * codebase has shipped that exact shape.
 *
 * librsvg (via sharp) enforces the same rule for the same reason, which is
 * what makes this reproducible offline. That is the point of the script: the
 * BEFORE case really does come out blank here, without anyone arranging for
 * it to.
 *
 * ── What is asserted ─────────────────────────────────────────────────────────
 *   BEFORE (external `blob:` href, i.e. what shipped)
 *     · the capture is a valid PNG of exactly the right dimensions   ← passes
 *     · the screenshot is absent                                     ← caught
 *     · assertCaptureFidelity() REFUSES it
 *
 *   AFTER (inline `data:` href, i.e. toRasterisableHref)
 *     · assertCaptureFidelity() accepts it
 *     · every source colour block is reproduced in the capture, sampled
 *       away from the strokes — the pixels are really there, not merely
 *       "something opaque"
 *
 * The fidelity comparison runs the REAL `compareAlphaGrids` /
 * `assertCaptureFidelity` from src/utils/annotation.ts — the same functions
 * the web build calls. Not a reimplementation: a verifier that only resembles
 * the thing it verifies is how this class of bug survives in the first place.
 *
 * ── The honest limitation ────────────────────────────────────────────────────
 * sharp/librsvg is not Chrome, and the app on a device is neither. What this
 * proves is the MECHANISM — external href ⇒ empty background, inline href ⇒
 * pixels present — and that the guard's verdict flips between the two. It is
 * not a screenshot of Safari on Lara's phone.
 *
 * READ-ONLY. No network, no database, no Storage. Output to
 * docs/annotation-capture-qa/.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import {
  assertCaptureFidelity,
  compareAlphaGrids,
  strokeToPathData,
  strokeWidthFor,
  AnnotationError,
  CAPTURE_FIDELITY_MIN,
  FIDELITY_GRID,
  type AnnotationStroke,
} from '../src/utils/annotation';
import { annotationColors } from '../src/constants/annotation-colors';

const OUT_DIR = path.join(process.cwd(), 'docs', 'annotation-capture-qa');

/** A phone-ish canvas. Real screenshots are bigger; the mechanism is not. */
const WIDTH = 390;
const HEIGHT = 844;

/**
 * Four flat colour blocks plus a white band.
 *
 * Flat blocks on purpose: they make "did these exact pixels survive?" a
 * question with an exact answer, which a photograph or a gradient would blur
 * into a judgement call.
 */
const BLOCKS = [
  { name: 'header', colour: '#1B1B18', y: 0, h: 120 },
  { name: 'body', colour: '#FCFCF9', y: 120, h: 360 },
  { name: 'card', colour: '#E4572E', y: 480, h: 180 },
  { name: 'footer', colour: '#2E5E4E', y: 660, h: 184 },
] as const;

function sourceScreenshotSvg(): string {
  const rects = BLOCKS.map(
    (b) =>
      `<rect x="0" y="${b.y}" width="${WIDTH}" height="${b.h}" fill="${b.colour}"/>`
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">${rects}</svg>`;
}

/**
 * The annotated canvas, built the way AnnotationCanvas builds it: one
 * `<image>` filling the frame, then the stroke paths over it. The href is the
 * variable under test.
 */
function annotatedSvg(href: string, strokes: AnnotationStroke[]): string {
  const strokeWidth = strokeWidthFor(WIDTH, HEIGHT);
  const paths = strokes
    .map((s) => {
      const d = strokeToPathData(s, WIDTH, HEIGHT);
      if (!d) return '';
      return `<path d="${d}" stroke="${s.color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    })
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    `<image x="0" y="0" width="${WIDTH}" height="${HEIGHT}" ` +
    `preserveAspectRatio="xMidYMid meet" xlink:href="${href}"/>` +
    `${paths}</svg>`
  );
}

/** A marker circle round the "card" block — what a reporter would draw. */
const CIRCLE: AnnotationStroke = {
  color: annotationColors.red,
  points: Array.from({ length: 33 }, (_, i) => {
    const t = (i / 32) * Math.PI * 2;
    return {
      x: 0.5 + 0.34 * Math.cos(t),
      y: 0.675 + 0.075 * Math.sin(t),
    };
  }),
};

/** Alpha+colour grid of a PNG buffer, sampled onto FIDELITY_GRID². */
async function sampleGrid(png: Buffer): Promise<Uint8ClampedArray> {
  const { data } = await sharp(png)
    .resize(FIDELITY_GRID, FIDELITY_GRID, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new Uint8ClampedArray(data);
}

/** Mean colour of a rectangle, ignoring transparent pixels. */
async function meanColour(
  png: Buffer,
  top: number,
  height: number
): Promise<{ r: number; g: number; b: number; alpha: number }> {
  const { data, info } = await sharp(png)
    .extract({ left: 0, top, width: WIDTH, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  const px = info.width * info.height;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    a += data[i + 3];
  }
  return { r: r / px, g: g / px, b: b / px, alpha: a / px };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

async function rasterise(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

interface Verdict {
  label: string;
  href: string;
  bytes: number;
  dimensions: string;
  dimensionsOk: boolean;
  sourceOpaqueCells: number;
  matchedCells: number;
  ratio: number;
  guard: 'accepted' | 'refused';
  guardMessage?: string;
}

async function evaluate(
  label: string,
  hrefForDisplay: string,
  href: string,
  sourcePng: Buffer,
  sourceGrid: Uint8ClampedArray
): Promise<{ verdict: Verdict; png: Buffer }> {
  const png = await rasterise(annotatedSvg(href, [CIRCLE]));
  const meta = await sharp(png).metadata();
  const captureGrid = await sampleGrid(png);

  // THE REAL comparison + THE REAL assertion, straight from src/utils.
  const fidelity = compareAlphaGrids(sourceGrid, captureGrid);
  const ratio =
    fidelity.sourceOpaqueCells === 0
      ? 1
      : fidelity.matchedCells / fidelity.sourceOpaqueCells;

  let guard: 'accepted' | 'refused' = 'accepted';
  let guardMessage: string | undefined;
  try {
    assertCaptureFidelity(fidelity);
  } catch (err) {
    guard = 'refused';
    guardMessage = err instanceof AnnotationError ? err.message : String(err);
  }

  return {
    png,
    verdict: {
      label,
      href: hrefForDisplay,
      bytes: png.length,
      dimensions: `${meta.width}×${meta.height}`,
      dimensionsOk: meta.width === WIDTH && meta.height === HEIGHT,
      sourceOpaqueCells: fidelity.sourceOpaqueCells,
      matchedCells: fidelity.matchedCells,
      ratio,
      guard,
      guardMessage,
    },
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const sourcePng = await rasterise(sourceScreenshotSvg());
  const sourceGrid = await sampleGrid(sourcePng);
  fs.writeFileSync(path.join(OUT_DIR, 'source-screenshot.png'), sourcePng);

  const dataHref = `data:image/png;base64,${sourcePng.toString('base64')}`;

  const before = await evaluate(
    'BEFORE — external blob: href (what shipped)',
    'blob:http://localhost:8081/9f2c…',
    'blob:http://localhost:8081/9f2c-fake-object-url',
    sourcePng,
    sourceGrid
  );
  const after = await evaluate(
    'AFTER — inline data: href (toRasterisableHref)',
    'data:image/png;base64,… (inlined)',
    dataHref,
    sourcePng,
    sourceGrid
  );

  fs.writeFileSync(path.join(OUT_DIR, 'capture-before-fix.png'), before.png);
  fs.writeFileSync(path.join(OUT_DIR, 'capture-after-fix.png'), after.png);

  // ── Colour fidelity: are the SCREENSHOT'S pixels really in the output? ──
  // Sampled per block, away from the stroke, and compared to the source's own
  // colours. "Opaque" is not the same claim as "the right picture".
  const colourRows: string[] = [];
  let colourFailures = 0;
  for (const block of BLOCKS) {
    const expected = hexToRgb(block.colour);
    const got = await meanColour(after.png, block.y, block.h);
    const drift = Math.max(
      Math.abs(got.r - expected.r),
      Math.abs(got.g - expected.g),
      Math.abs(got.b - expected.b)
    );
    // The circle crosses the card/footer bands, so a few units of mean drift
    // are expected and correct. 24 is comfortably tighter than the ~200 a
    // missing background would produce.
    const ok = drift < 24;
    if (!ok) colourFailures += 1;
    colourRows.push(
      `| ${block.name} | ${block.colour} | ` +
        `rgb(${got.r.toFixed(0)}, ${got.g.toFixed(0)}, ${got.b.toFixed(0)}) | ` +
        `${drift.toFixed(1)} | ${ok ? 'present' : 'MISSING'} |`
    );
  }

  const beforeBlocks = await meanColour(before.png, 0, HEIGHT);

  const lines: string[] = [];
  lines.push('# Annotation capture — does the screenshot survive the flatten?');
  lines.push('');
  lines.push(
    'Generated by `npx tsx scripts/qa-annotation-capture-fidelity.ts`. Regenerate after touching'
  );
  lines.push('`AnnotationCanvas`, `annotation.ts`, or `annotation-capture.ts`.');
  lines.push('');
  lines.push('## The bug');
  lines.push('');
  lines.push(
    'Report `97398534`: *"when you draw on a screenshot… the photo is blank and you can only'
  );
  lines.push('see what users draw on a blank page."*');
  lines.push('');
  lines.push(
    '`Svg.toDataURL()` on web serialises the SVG and rasterises it through an `<img>`, which'
  );
  lines.push(
    'the browser renders in **secure static mode** — no external resource may be loaded.'
  );
  lines.push(
    '`expo-image-picker` on web returns a `blob:` URI, so the image resolved to nothing and the'
  );
  lines.push(
    'capture came out as strokes over a void. The preview looked fine throughout, because the'
  );
  lines.push('live DOM has no such restriction — which is why `onLoad` fired and the old');
  lines.push('`imageReady` guard never triggered.');
  lines.push('');
  lines.push('## Result');
  lines.push('');
  lines.push('| | BEFORE (`blob:`) | AFTER (`data:`) |');
  lines.push('| --- | --- | --- |');
  lines.push(
    `| Valid PNG, correct size | ${before.verdict.dimensionsOk ? `yes — ${before.verdict.dimensions}` : 'no'} | ${after.verdict.dimensionsOk ? `yes — ${after.verdict.dimensions}` : 'no'} |`
  );
  lines.push(`| File size | ${before.verdict.bytes} B | ${after.verdict.bytes} B |`);
  lines.push(
    `| Screenshot cells retained | ${before.verdict.matchedCells}/${before.verdict.sourceOpaqueCells} (${(before.verdict.ratio * 100).toFixed(1)}%) | ${after.verdict.matchedCells}/${after.verdict.sourceOpaqueCells} (${(after.verdict.ratio * 100).toFixed(1)}%) |`
  );
  lines.push(
    `| \`assertCaptureFidelity\` (min ${(CAPTURE_FIDELITY_MIN * 100).toFixed(0)}%) | **${before.verdict.guard}** | **${after.verdict.guard}** |`
  );
  lines.push('');
  lines.push(
    'Both files are valid PNGs of exactly the right dimensions. That is the whole problem with'
  );
  lines.push(
    'checking files instead of pixels — the BEFORE column passes every structural test there is.'
  );
  lines.push('');
  if (before.verdict.guardMessage) {
    lines.push('The message the reporter now gets instead of a blank report:');
    lines.push('');
    lines.push('> ' + before.verdict.guardMessage);
    lines.push('');
  }
  lines.push(
    `For reference, the BEFORE capture's mean colour over the whole frame is ` +
      `rgb(${beforeBlocks.r.toFixed(0)}, ${beforeBlocks.g.toFixed(0)}, ${beforeBlocks.b.toFixed(0)}) ` +
      `at alpha ${beforeBlocks.alpha.toFixed(1)}/255 — an empty canvas with a little ink on it.`
  );
  lines.push('');
  lines.push('## Are the screenshot’s own pixels there?');
  lines.push('');
  lines.push(
    'Alpha presence alone would accept any opaque rectangle. Each block of the source is'
  );
  lines.push('therefore compared to the same band of the capture, by colour:');
  lines.push('');
  lines.push('| Block | Source | Capture (mean) | Max drift | |');
  lines.push('| --- | --- | --- | --- | --- |');
  lines.push(...colourRows);
  lines.push('');
  lines.push(
    colourFailures === 0
      ? 'Every block survives the flatten at its own colour. The marker circle accounts for the'
      : '**A block is missing from the capture.**'
  );
  if (colourFailures === 0) {
    lines.push('few units of drift where it crosses a band.');
  }
  lines.push('');
  lines.push('## Files');
  lines.push('');
  lines.push('- `source-screenshot.png` — the screenshot being annotated');
  lines.push('- `capture-before-fix.png` — the flatten with an external `blob:` href');
  lines.push('- `capture-after-fix.png` — the flatten with the href inlined');
  lines.push('');
  lines.push('## Limitation');
  lines.push('');
  lines.push(
    'Rasterised by sharp/librsvg, which enforces the same no-external-resources rule as a'
  );
  lines.push(
    'browser rasterising an SVG in an `<img>`. This demonstrates the mechanism and the guard’s'
  );
  lines.push(
    'verdict flipping between the two href forms; it is not a capture taken from Safari on a'
  );
  lines.push('phone.');
  lines.push('');

  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), lines.join('\n'));

  // ── Console summary + exit code ──
  for (const v of [before.verdict, after.verdict]) {
    console.log(`\n${v.label}`);
    console.log(`  href            ${v.href}`);
    console.log(`  PNG             ${v.dimensions} (${v.bytes} B)`);
    console.log(
      `  screenshot kept ${v.matchedCells}/${v.sourceOpaqueCells} cells = ${(v.ratio * 100).toFixed(1)}%`
    );
    console.log(`  guard           ${v.guard.toUpperCase()}`);
  }

  const problems: string[] = [];
  if (!before.verdict.dimensionsOk || !after.verdict.dimensionsOk) {
    problems.push('a capture came out at the wrong dimensions');
  }
  if (before.verdict.guard !== 'refused') {
    problems.push(
      'the blank capture was ACCEPTED — the guard does not catch the shipped bug'
    );
  }
  if (after.verdict.guard !== 'accepted') {
    problems.push('the good capture was REFUSED — the guard rejects valid annotations');
  }
  if (colourFailures > 0) {
    problems.push(`${colourFailures} source colour block(s) missing from the capture`);
  }

  console.log('');
  if (problems.length > 0) {
    for (const p of problems) console.error(`FAIL: ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    'PASS: blank capture refused, real capture accepted, every source colour present.'
  );
  console.log(`Evidence written to ${path.relative(process.cwd(), OUT_DIR)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
