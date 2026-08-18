/**
 * Family: `block` — Swiss two-block. Reference: refined-play.png.
 *
 * A solid colour block across the top two-thirds with the title set heavy and
 * flush into its top-left corner, and a lower register split hard down the
 * middle: meta and wordmark in the left column, photograph in the right. No
 * rounded corners, no gaps, no drop shadows — every edge is a butt joint, which
 * is the whole character of the reference.
 *
 * ── The two decisions worth knowing about ────────────────────────────────────
 * 1. The title is set in `uiBold` (a grotesque), not the `display` serif that
 *    `classic` uses. That is the single biggest reason the two families do not
 *    read as the same poster recoloured — geometry alone was not enough.
 *
 * 2. Ink on the colour block is `bg`, not `fg`. Every pair in the token list is
 *    designed so bg-against-accent is a deliberate two-colour combination,
 *    whereas `fg` is picked to sit on `bg` and can disappear entirely on the
 *    accent (acid green on yellow being the worst of them). The same rule
 *    governs the lower-right block, which is filled `fg` and inked `bg`.
 *
 * Without a photo the right-hand block does not disappear — it becomes a solid
 * `fg` field carrying the date at 200px. The composition is the same either
 * way, which is what stops the photo-less variant reading as a broken version
 * of the photo one.
 */

import {
  POSTER_HEIGHT,
  POSTER_WIDTH,
  fitTitleIn,
  truncateToWidth,
  type FamilyContext,
  type FamilyResult,
  type PosterFamily,
  type RectShape,
  type TextRun,
} from '@/utils/poster-metrics';

/** Outer inset. The composition floats on a hairline of background colour. */
const EDGE = 40;
const INNER_WIDTH = POSTER_WIDTH - EDGE * 2;
const INNER_HEIGHT = POSTER_HEIGHT - EDGE * 2;

/** Height of the upper colour block. ~55% — the reference's proportion. */
const UPPER_HEIGHT = 800;
const LOWER_TOP = EDGE + UPPER_HEIGHT;
const LOWER_HEIGHT = INNER_HEIGHT - UPPER_HEIGHT;

/** Where the lower register splits: meta column | photo block. */
const LEFT_COLUMN = 520;
const RIGHT_X = EDGE + LEFT_COLUMN;
const RIGHT_WIDTH = INNER_WIDTH - LEFT_COLUMN;

const PAD = 56;
const TITLE_BOX_WIDTH = INNER_WIDTH - PAD * 2;
const TITLE_BOX_HEIGHT = UPPER_HEIGHT - PAD * 2;
const TITLE_LADDER = [140, 118, 98, 80, 64, 52] as const;
/** Tight, near-solid leading. The reference sets its three lines almost touching. */
const TITLE_LINE_HEIGHT_RATIO = 1.0;
const TITLE_ASCENT_RATIO = 0.76;

const META_X = EDGE + PAD;
const META_WIDTH = LEFT_COLUMN - PAD - 32;
const DATE_SIZE = 28;
const VENUE_SIZE = 28;
const WORDMARK_SIZE = 24;

const WORDMARK_BASELINE = POSTER_HEIGHT - EDGE - 44;
const VENUE_BASELINE = WORDMARK_BASELINE - 90;
const DATE_BASELINE = VENUE_BASELINE - 44;

// The no-photo date block, set into the lower-right field.
const FIELD_X = RIGHT_X + 48;
const FIELD_DAY_SIZE = 200;
const FIELD_MONTH_SIZE = 56;
const FIELD_TIME_SIZE = 40;

function build(ctx: FamilyContext): FamilyResult {
  const { bg, fg, accent } = ctx.palette;
  const title = fitTitleIn(ctx.input.title, {
    boxWidth: TITLE_BOX_WIDTH,
    boxHeight: TITLE_BOX_HEIGHT,
    ladder: TITLE_LADDER,
    role: 'uiBold',
    lineHeightRatio: TITLE_LINE_HEIGHT_RATIO,
  });

  const background: RectShape = {
    x: 0,
    y: 0,
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    fill: bg,
  };

  // `band` is this family's upper colour block. It is drawn after the photo and
  // before the accents, which is exactly where a solid type ground belongs.
  const band: RectShape = {
    x: EDGE,
    y: EDGE,
    width: INNER_WIDTH,
    height: UPPER_HEIGHT,
    fill: accent,
  };

  const photo = ctx.photoDataUri
    ? {
        rect: { x: RIGHT_X, y: LOWER_TOP, width: RIGHT_WIDTH, height: LOWER_HEIGHT, fill: bg },
        dataUri: ctx.photoDataUri,
      }
    : null;

  const accents: RectShape[] = [];
  const texts: TextRun[] = [];

  title.lines.forEach((line, i) => {
    texts.push({
      text: line,
      x: EDGE + PAD,
      y: EDGE + PAD + title.fontSize * TITLE_ASCENT_RATIO + i * title.lineHeight,
      fontSize: title.fontSize,
      role: 'uiBold',
      fill: bg,
      opacity: 1,
      letterSpacing: -1,
    });
  });

  if (!ctx.hasPhoto) {
    accents.push({
      x: RIGHT_X,
      y: LOWER_TOP,
      width: RIGHT_WIDTH,
      height: LOWER_HEIGHT,
      fill: fg,
    });

    const parts = ctx.dateParts;
    if (parts) {
      texts.push({
        text: parts.day,
        x: FIELD_X,
        y: LOWER_TOP + 250,
        fontSize: FIELD_DAY_SIZE,
        role: 'uiBold',
        fill: bg,
        opacity: 1,
        letterSpacing: -6,
      });
      texts.push({
        text: parts.month,
        x: FIELD_X,
        y: LOWER_TOP + 330,
        fontSize: FIELD_MONTH_SIZE,
        role: 'uiBold',
        fill: bg,
        opacity: 1,
        letterSpacing: 4,
      });
      texts.push({
        text: parts.time,
        x: FIELD_X,
        y: LOWER_TOP + 400,
        fontSize: FIELD_TIME_SIZE,
        role: 'ui',
        fill: bg,
        opacity: 0.85,
        letterSpacing: 2,
      });
    }
  }

  // A short accent rule above the meta. The left column is otherwise a large
  // empty field of background — on the first contact sheet it was the weakest
  // part of this family — and a rule gives the block something to start from,
  // the same device `classic` uses above its title.
  accents.push({
    x: META_X,
    y: DATE_BASELINE - 52,
    width: 104,
    height: 8,
    fill: accent,
  });

  if (ctx.dateLine) {
    texts.push({
      text: truncateToWidth(ctx.dateLine, DATE_SIZE, 'uiBold', META_WIDTH),
      x: META_X,
      y: DATE_BASELINE,
      fontSize: DATE_SIZE,
      role: 'uiBold',
      fill: fg,
      opacity: 1,
      letterSpacing: 1,
    });
  }

  texts.push({
    text: truncateToWidth(ctx.venueLine, VENUE_SIZE, 'ui', META_WIDTH),
    x: META_X,
    y: VENUE_BASELINE,
    fontSize: VENUE_SIZE,
    role: 'ui',
    fill: fg,
    opacity: 0.85,
    letterSpacing: 0,
  });

  texts.push({
    text: 'SPHAER',
    x: META_X,
    y: WORDMARK_BASELINE,
    fontSize: WORDMARK_SIZE,
    role: 'uiBold',
    fill: fg,
    opacity: 0.6,
    letterSpacing: 8,
  });

  return { background, photo, band, accents, texts, titleTruncated: title.truncated };
}

export const blockFamily: PosterFamily = {
  id: 'block',
  label: 'Swiss two-block',
  /**
   * Excluded on purpose:
   *   * `acid` — an acid-green lower block next to a yellow upper one is two
   *     fluorescents fighting; the composition needs one loud colour, not two.
   *   * `blush` — its accent and fg are the same pine green, so the upper block
   *     and the lower-right block come out identical and the split disappears.
   */
  palettes: ['signal', 'bone', 'navy', 'yellow', 'teal', 'orange', 'paper', 'ink', 'aubergine'],
  build,
};
