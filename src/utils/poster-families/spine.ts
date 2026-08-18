/**
 * Family: `spine` — the title set vertically up the left edge.
 * References: berlin-shiatsu.png, nigerian-film-festival.png.
 *
 * The title runs bottom-to-top in a heavy grotesque, flush to the top margin,
 * with the right-hand field carrying an oversized date and the meta. It is the
 * family that earns its place at thumbnail size: on the mural wall a poster is
 * ~120px wide and every horizontally-set title in the app is illegible mush,
 * but a vertical bar of type is still a recognisable silhouette. That is the
 * argument for it, not the novelty.
 *
 * ── How the rotation actually works ──────────────────────────────────────────
 * A run is rotated -90° about its own (x, y). Under that transform a local
 * offset (dx, dy) lands at (dy, -dx), which has two consequences that every
 * coordinate below depends on:
 *
 *   * Advancing along the text (+dx) moves UP the canvas. So the run's length
 *     is measured against the poster's HEIGHT, and `fitTitleIn` is called with
 *     boxWidth = the vertical run length.
 *   * Cap height (-dy, "above the baseline") moves LEFT, and descenders move
 *     RIGHT. So a line's x is its baseline, and the glyphs sit to the LEFT of
 *     it — which is why the first column starts at MARGIN + ascent rather than
 *     at MARGIN, and why the spine's right edge adds a descender.
 *
 * Getting either of those backwards puts the title half off the canvas without
 * any error anywhere, which is why `textRunBounds` measures rotation properly
 * and the layout test asserts against it rather than against x + width.
 *
 * Lines are flush to the TOP margin with a ragged bottom, as in berlin-shiatsu,
 * and the gap that leaves at the bottom of the spine is filled by a small
 * rotated credit line — again straight off the reference.
 */

import {
  MARGIN,
  POSTER_HEIGHT,
  POSTER_WIDTH,
  estimateTextWidth,
  fitSingleLine,
  fitTitleIn,
  truncateToWidth,
  type FamilyContext,
  type FamilyResult,
  type PosterFamily,
  type RectShape,
  type TextRun,
} from '@/utils/poster-metrics';

/** How far a rotated line may run — the poster's height, less both margins. */
const RUN_LENGTH = POSTER_HEIGHT - MARGIN * 2;
/**
 * How thick the spine column may get. Caps the title ladder: three lines at
 * 156px would be 468px of spine and leave the right field too narrow for the
 * date, so a three-line title steps down instead.
 */
const SPINE_MAX_THICKNESS = 430;

const TITLE_LADDER = [156, 132, 110, 92, 76, 62] as const;
const TITLE_LINE_HEIGHT_RATIO = 1.0;
const ASCENT_RATIO = 0.78;
const DESCENT_RATIO = 0.22;

const CREDIT_SIZE = 30;
/** Gutter between the spine and the right field. */
const GUTTER = 72;

const DAY_SIZE = 220;
const MONTH_SIZE = 56;
/** Tried largest-first against whatever width the spine left behind. */
const BIG_DATE_LADDER = [84, 72, 62, 54, 46] as const;
const VENUE_SIZE = 40;
const META_SIZE = 34;
const WORDMARK_SIZE = 24;

const WORDMARK_BASELINE = POSTER_HEIGHT - MARGIN;
const VENUE_BASELINE = WORDMARK_BASELINE - 58;
const META_BASELINE = VENUE_BASELINE - 52;

function build(ctx: FamilyContext): FamilyResult {
  const { bg, fg, accent } = ctx.palette;

  const title = fitTitleIn(ctx.input.title, {
    // The run is vertical, so the "width" the fitter budgets against is the
    // poster's height and the "height" is how thick the spine may become.
    boxWidth: RUN_LENGTH,
    boxHeight: SPINE_MAX_THICKNESS,
    ladder: TITLE_LADDER,
    role: 'uiBold',
    lineHeightRatio: TITLE_LINE_HEIGHT_RATIO,
  });

  const ascent = title.fontSize * ASCENT_RATIO;
  const descent = title.fontSize * DESCENT_RATIO;
  /** Baseline x of the first (leftmost) rotated line. */
  const firstX = MARGIN + ascent;
  const lastX = firstX + (title.lines.length - 1) * title.lineHeight;
  /** The credit sits in its own narrow column just right of the last title line. */
  const creditX = lastX + title.lineHeight * 0.62;
  const spineRight = creditX + descent;

  const fieldX = spineRight + GUTTER;
  const fieldWidth = POSTER_WIDTH - MARGIN - fieldX;

  const background: RectShape = {
    x: 0,
    y: 0,
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    fill: bg,
  };

  // No solid type ground in this family — the type sits directly on the flat
  // background, which is the point of it. `band` still has to be a rect, so it
  // is a zero-height one at the origin: drawn, costs nothing, paints nothing.
  const band: RectShape = { x: 0, y: 0, width: 0, height: 0, fill: bg };

  const accents: RectShape[] = [];
  const texts: TextRun[] = [];

  // ── The spine ──────────────────────────────────────────────────────────────
  // Flush to the top margin: a line's anchor is its BOTTOM, and it runs upward
  // for its own width, so anchoring at MARGIN + width puts every line's top on
  // the same line and leaves the ragged edge at the bottom.
  title.lines.forEach((line, i) => {
    texts.push({
      text: line,
      x: firstX + i * title.lineHeight,
      y: MARGIN + estimateTextWidth(line, title.fontSize, 'uiBold'),
      fontSize: title.fontSize,
      role: 'uiBold',
      fill: fg,
      opacity: 1,
      letterSpacing: -2,
      rotate: -90,
    });
  });

  // Small rotated credit filling the bottom of the spine column.
  const credit = truncateToWidth(ctx.venueLine.toUpperCase(), CREDIT_SIZE, 'ui', RUN_LENGTH * 0.42);
  if (credit) {
    texts.push({
      text: credit,
      x: creditX,
      y: POSTER_HEIGHT - MARGIN,
      fontSize: CREDIT_SIZE,
      role: 'ui',
      fill: fg,
      opacity: 0.75,
      letterSpacing: 3,
      rotate: -90,
    });
  }

  // ── The right field ────────────────────────────────────────────────────────
  const parts = ctx.dateParts;
  if (parts) {
    texts.push({
      text: parts.month,
      x: fieldX,
      y: 176,
      fontSize: MONTH_SIZE,
      role: 'uiBold',
      fill: fg,
      opacity: 1,
      letterSpacing: 8,
    });
    texts.push({
      text: parts.day,
      x: fieldX,
      y: 380,
      fontSize: DAY_SIZE,
      role: 'uiBold',
      fill: fg,
      opacity: 1,
      letterSpacing: -8,
    });
  }

  if (ctx.photoDataUri) {
    // A thin accent rule down the left of the photo, NOT a plate behind it.
    //
    // The first version pushed an accent rect at the photo's exact rect meaning
    // it as a backing plate — and accents are drawn AFTER the photo, so it
    // covered the photograph completely. Every check still passed: the layout
    // was paintable, the PNG was the right size, and the ink fraction was high
    // (a solid magenta block is ink). It took looking at the contact sheet to
    // see that four posters had no photo on them at all.
    //
    // There is no way to paint behind the photo in this vocabulary — the draw
    // order is background → photo → band → accents → texts — so the rule sits
    // beside it instead, which is what the reference does anyway.
    accents.push({ x: fieldX - 26, y: 470, width: 6, height: 780, fill: accent });
  } else if (parts) {
    // No photo: the field carries the date as a graphic instead — a rule and
    // the full numeric date set large. This is berlin-shiatsu's own solution to
    // exactly this problem, and it is a composition rather than a gap.
    accents.push({ x: fieldX, y: 470, width: 6, height: 430, fill: accent });
    // Indented past the rule, so the budget is the field MINUS the indent. The
    // first version budgeted against the full field width and a three-line
    // spine — which pushes the field ~86px narrower — turned "30.10.2026" into
    // "30.10.2…" on the contact sheet. An ellipsised date is worse than a
    // smaller one, so the size came down too.
    const dateIndent = 40;
    const numericDate = `${parts.day}.${String(
      new Date(ctx.input.startsAt).getMonth() + 1
    ).padStart(2, '0')}.${parts.year}`;
    // Sized to fit rather than set at a fixed size. The field's width depends on
    // how thick the spine came out, so a three-line title leaves ~386px here
    // against ~552px for a two-line one — and a fixed 72px date ellipsised to
    // "30.10.2…" in the narrow case. Shrinking a date is fine; truncating one
    // is not, since the date is the second thing a poster has to say.
    const dateAvail = fieldWidth - dateIndent;
    const dateSize = fitSingleLine(numericDate, BIG_DATE_LADDER, 'uiBold', dateAvail);
    texts.push({
      text: truncateToWidth(numericDate, dateSize, 'uiBold', dateAvail),
      x: fieldX + dateIndent,
      y: 640,
      fontSize: dateSize,
      role: 'uiBold',
      fill: fg,
      opacity: 1,
      letterSpacing: -2,
    });
    texts.push({
      text: truncateToWidth(parts.time, dateSize, 'uiBold', dateAvail),
      x: fieldX + dateIndent,
      y: 640 + dateSize * 1.45,
      fontSize: dateSize,
      role: 'uiBold',
      fill: fg,
      opacity: 0.85,
      letterSpacing: -2,
    });
  }

  const photo = ctx.photoDataUri
    ? {
        rect: { x: fieldX, y: 470, width: fieldWidth, height: 780, fill: bg },
        dataUri: ctx.photoDataUri,
      }
    : null;

  // ── Bottom-right meta ──────────────────────────────────────────────────────
  if (ctx.dateLine) {
    texts.push({
      text: truncateToWidth(ctx.dateLine, META_SIZE, 'uiBold', fieldWidth),
      x: fieldX,
      y: META_BASELINE,
      fontSize: META_SIZE,
      role: 'uiBold',
      fill: fg,
      opacity: 1,
      letterSpacing: 1,
    });
  }

  texts.push({
    text: truncateToWidth(ctx.venueLine, VENUE_SIZE, 'ui', fieldWidth),
    x: fieldX,
    y: VENUE_BASELINE,
    fontSize: VENUE_SIZE,
    role: 'ui',
    fill: fg,
    opacity: 0.85,
    letterSpacing: 0,
  });

  texts.push({
    text: 'SPHAER',
    x: fieldX,
    y: WORDMARK_BASELINE,
    fontSize: WORDMARK_SIZE,
    role: 'uiBold',
    fill: fg,
    opacity: 0.6,
    letterSpacing: 8,
  });

  return { background, photo, band, accents, texts, titleTruncated: title.truncated };
}

export const spineFamily: PosterFamily = {
  id: 'spine',
  label: 'Rotated spine',
  /**
   * The flat, saturated grounds. `bone` and `orange` are excluded not for
   * legibility but for character: this composition wants one confident colour
   * field behind 156px of type, and those two read as paper stock.
   */
  palettes: ['acid', 'signal', 'navy', 'yellow', 'aubergine', 'teal', 'blush', 'ink', 'paper'],
  build,
};
