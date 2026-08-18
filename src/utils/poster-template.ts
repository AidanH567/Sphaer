/**
 * The Sphaer poster generator — FOUR layout families, auto-filled from an event.
 *
 * This module is pure. It takes the fields an event already has (title, start
 * time, venue, categories, optionally an embedded photo) and returns a fully
 * resolved `PosterLayout`: every rect, every baseline, every font size, already
 * solved. It draws nothing. Two renderers consume the layout:
 *
 *   * `src/components/events/GeneratedPosterCanvas.tsx` — react-native-svg,
 *     what the user actually generates on device.
 *   * `posterLayoutToSvgString()` below — an SVG document, which `sharp` can
 *     rasterise in Node. That is what `scripts/qa-generate-poster.ts` uses to
 *     produce real PNGs we can look at and measure without a device.
 *
 * Two renderers over one solved layout is a deliberate trade: it means the
 * layout maths — the part that can actually be wrong — is testable in Jest and
 * verifiable pixel-by-pixel in Node, instead of only being observable by
 * squinting at a phone. The cost is that the two renderers must agree; they
 * both drive off the same `PosterLayout` fields, and neither is allowed to
 * compute a coordinate of its own.
 *
 * ── What this file is, after the families landed ─────────────────────────────
 * It used to BE the template — one composition, ~500 lines of constants. It is
 * now the front door:
 *
 *   * `src/utils/poster-metrics.ts` — the measuring tape (wrapping, fitting,
 *     truncation, hashing, rotated bounding boxes) and the layout vocabulary.
 *   * `src/utils/poster-families/*.ts` — one file per composition.
 *   * `src/utils/poster-families/index.ts` — the registry: which family an
 *     event gets, and which palettes that family may use.
 *   * this file — `buildPosterLayout`, the SVG renderer, and a re-export of
 *     everything above so `@/utils/poster-template` stays the single address.
 *
 * `buildPosterLayout` keeps its exact signature and return shape, which is why
 * `GeneratedPosterCanvas`, `useGeneratedPoster` and `poster-guard` needed no
 * changes for the families themselves.
 *
 * ── The one renderer change, and why it was unavoidable ──────────────────────
 * `TextRun` gained two optional fields, `rotate` and `anchor`, and both
 * renderers learned to honour them. There is no way to set a title vertically
 * up the poster's edge, or to centre type on a plate, by choosing different
 * numbers for x and y — they are new primitives, not new arrangements.
 *
 * That was a ONE-TIME extension of the vocabulary. A fifth family is now a new
 * file in `poster-families/` plus two lines in the registry; it does not touch
 * either renderer, the guard, the hook, or this file.
 */

import type { PosterPalette } from '@/constants/poster-palette';
import {
  CLASSIC_TITLE_BOX_HEIGHT,
  CLASSIC_TITLE_LADDER,
  CLASSIC_TITLE_LINE_HEIGHT_RATIO,
} from '@/utils/poster-families/classic';
import { familyForInput, paletteForFamily, posterSeed } from '@/utils/poster-families';
import {
  COLUMN,
  fitTitleIn,
  formatPosterDateLine,
  formatPosterVenueLine,
  posterDateParts,
  POSTER_HEIGHT,
  POSTER_WIDTH,
  type FamilyContext,
  type FittedTitle,
  type FontRole,
  type PosterInput,
  type PosterLayout,
  type RectShape,
  type TextRun,
} from '@/utils/poster-metrics';

// The measuring tape and the vocabulary are re-exported so that
// `@/utils/poster-template` remains the one address every consumer imports
// from, exactly as it was before the split.
export {
  COLUMN,
  MARGIN,
  MAX_TITLE_LINES,
  POSTER_HEIGHT,
  POSTER_WIDTH,
  estimateTextWidth,
  fitTitleIn,
  formatPosterDateLine,
  formatPosterVenueLine,
  hashSeed,
  maxCharsForWidth,
  paletteForSeed,
  posterDateParts,
  textRunBounds,
  truncateToWidth,
  wrapText,
} from '@/utils/poster-metrics';
export type {
  FittedTitle,
  FontRole,
  PosterDateParts,
  PosterFamily,
  PosterInput,
  PosterLayout,
  RectShape,
  TextRun,
} from '@/utils/poster-metrics';
export {
  POSTER_FAMILIES,
  familyForInput,
  familyShortlist,
  paletteForFamily,
  posterFamilyById,
  posterSeed,
  variantCycleLength,
} from '@/utils/poster-families';

/**
 * Fit a title for the CLASSIC band, at its ladder and in its box.
 *
 * Kept at its original signature because it is the published helper and the
 * layout tests measure the ladder through it. Families do not call this — they
 * call `fitTitleIn` with their own box, ladder and face, which is the whole
 * reason a 132px grotesque block and a 156px vertical spine can share one
 * fitter.
 */
export function fitTitle(
  title: string,
  boxWidth = COLUMN,
  boxHeight = CLASSIC_TITLE_BOX_HEIGHT
): FittedTitle {
  return fitTitleIn(title, {
    boxWidth,
    boxHeight,
    ladder: CLASSIC_TITLE_LADDER,
    role: 'display',
    lineHeightRatio: CLASSIC_TITLE_LINE_HEIGHT_RATIO,
  });
}

/**
 * Solve the whole poster. Every number a renderer needs comes out of here.
 *
 * Invariants the tests and `assertLayoutIsPaintable` hold every family to,
 * because they are what stops the blank-poster failure from being generated in
 * the first place:
 *   1. `background` covers the full canvas with an opaque colour.
 *   2. `texts` always contains at least the title and the wordmark.
 */
export function buildPosterLayout(input: PosterInput): PosterLayout {
  const family = familyForInput(input);
  const palette: PosterPalette = paletteForFamily(posterSeed(input), family, input.variant ?? 0);

  // Resolved once, here, so no family re-derives a date or re-checks the photo.
  const ctx: FamilyContext = {
    input,
    palette,
    hasPhoto: !!input.photoDataUri,
    photoDataUri: input.photoDataUri ?? null,
    dateLine: formatPosterDateLine(input.startsAt, input.endsAt),
    dateParts: posterDateParts(input.startsAt),
    venueLine: formatPosterVenueLine(input.locationName, input.address),
  };

  const solved = family.build(ctx);

  return {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    palette,
    family: family.id,
    ...solved,
  };
}

// ─── SVG document renderer (Node / QA only) ──────────────────────────────────

/** Font stacks for the string renderer. Must exist on a plain machine. */
const SVG_FONT_STACK: Record<FontRole, { family: string; weight: number }> = {
  display: { family: "Georgia, 'Times New Roman', serif", weight: 400 },
  uiBold: { family: 'Helvetica, Arial, sans-serif', weight: 700 },
  ui: { family: 'Helvetica, Arial, sans-serif', weight: 400 },
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rectToSvg(r: RectShape): string {
  return `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${r.fill}"/>`;
}

function textToSvg(t: TextRun): string {
  const font = SVG_FONT_STACK[t.role];
  // Rotation is about the run's own anchor point, which is what the spine
  // family's coordinates assume — see the note in poster-families/spine.ts.
  const transform = t.rotate ? ` transform="rotate(${t.rotate} ${t.x} ${t.y})"` : '';
  const anchor = t.anchor && t.anchor !== 'start' ? ` text-anchor="${t.anchor}"` : '';
  return (
    `<text x="${t.x}" y="${t.y}" font-family="${font.family}" font-weight="${font.weight}" ` +
    `font-size="${t.fontSize}" fill="${t.fill}" opacity="${t.opacity}" ` +
    `letter-spacing="${t.letterSpacing}"${anchor}${transform} xml:space="preserve">` +
    `${escapeXml(t.text)}</text>`
  );
}

/**
 * Render a solved layout as a standalone SVG document. Used by
 * `scripts/qa-generate-poster.ts` (sharp → PNG) and by the layout tests. The
 * on-device renderer is the react-native-svg component, not this.
 *
 * Draw order is background → photo → band → accents → texts, and every family
 * is written against it: a family that wants type on flat colour puts that
 * colour in `band` (drawn over the photo), and a family that wants a plate over
 * a photograph puts the plate in `accents` (drawn over both).
 */
export function posterLayoutToSvgString(layout: PosterLayout): string {
  const parts: string[] = [];
  parts.push(rectToSvg(layout.background));
  if (layout.photo) {
    const { rect, dataUri } = layout.photo;
    parts.push(
      `<image x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" ` +
        `preserveAspectRatio="xMidYMid slice" href="${dataUri}"/>`
    );
  }
  parts.push(rectToSvg(layout.band));
  for (const a of layout.accents) parts.push(rectToSvg(a));
  for (const t of layout.texts) parts.push(textToSvg(t));
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}">\n` +
    parts.join('\n') +
    `\n</svg>`
  );
}
