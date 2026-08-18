/**
 * Family: `axial` — centred axial. References: p14, p15, p36 of Lara's 39
 * (docs/poster-reference/families.md §2, ranked #2 for value-for-effort in
 * generator-implications.md).
 *
 * A vertical centre line, and everything symmetric about it: headline above, a
 * contained image window in the middle, an oversized date beneath it, meta at
 * the foot. Symmetry reads as ceremony, which suits the things this app has
 * most of after club nights — a workshop, a teaching evening, an exhibition
 * opening. It is also the most forgiving family in the set: there is exactly
 * one alignment decision and it cannot be got wrong.
 *
 * ── How this is not `panel`, which is also centred ───────────────────────────
 * The obvious risk. `panel` bleeds a photograph to all four edges and floats an
 * opaque plate on it; the ground is invisible and the plate is the composition.
 * Here NOTHING BLEEDS. The image is a contained window with ground visible on
 * every side, the ground colour is half the poster's area, and the type sits
 * directly on it with no plate at all. On a thumbnail the two read as opposites:
 * `panel` is a photograph with a label, `axial` is a coloured field with a
 * window cut in it.
 *
 * The type is also a display serif set with positive letterspacing, against
 * `panel`'s tighter setting — the same trick `block` uses to stop reading as
 * `classic` recoloured. Geometry alone was not enough there and would not be
 * here.
 *
 * ── Without a photograph ─────────────────────────────────────────────────────
 * The window does not vanish, it fills: it becomes a solid accent field
 * carrying the day-of-month at 300px, centred, with the weekday and month
 * stacked under it. That is p36's move, where a vinyl disc replaces the
 * photograph and the composition is unchanged. The reason it matters is that a
 * scraped Berlin event usually has no usable picture, so the photo-less variant
 * is the common case — it must not read as the broken version.
 *
 * ── Why there is no circle ───────────────────────────────────────────────────
 * p15 crops to a circle inside a larger circle, and that is the best thing
 * about it. The layout vocabulary is opaque rects, one image and text runs;
 * adding an ellipse means touching BOTH renderers and the guard, which is a
 * bigger change than a family and belongs in its own commit. The square window
 * is the honest version of the same idea, not a stand-in pretending otherwise.
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

const CENTRE_X = POSTER_WIDTH / 2;

/**
 * A wide margin, wider than the other families use. The generous ground is
 * half of why this family reads as ceremonial rather than as a poster that ran
 * out of room, and it is what keeps the window from behaving like a bleed.
 */
const EDGE = 104;
const COLUMN = POSTER_WIDTH - EDGE * 2;

/**
 * The contained image/date window. Square, centred, and NARROWER than the text
 * column — it has to sit inside visible ground on all four sides or the family
 * starts reading as `panel` with a margin. Its vertical position is solved
 * against the meta block below it, not chosen: the window's foot, the hairline
 * under it and the date line have to clear each other at every title length.
 */
const WINDOW_SIZE = 760;
const WINDOW_X = (POSTER_WIDTH - WINDOW_SIZE) / 2;
const WINDOW_TOP = 470;
const WINDOW_BOTTOM = WINDOW_TOP + WINDOW_SIZE;

const TITLE_TOP = 150;
const TITLE_BOX_HEIGHT = WINDOW_TOP - TITLE_TOP - 60;
const TITLE_LADDER = [104, 88, 76, 64, 54, 46, 40] as const;
const TITLE_LINE_HEIGHT_RATIO = 1.08;
const TITLE_ASCENT_RATIO = 0.78;

/** The rule under the headline — the one horizontal that crosses the axis. */
const RULE_WIDTH = 148;
const RULE_HEIGHT = 6;

/** In the photo-less variant the window carries the date at display size. */
const BIG_DAY_SIZE = 300;
const BIG_MONTH_SIZE = 62;
const BIG_WEEKDAY_SIZE = 40;

const DATE_SIZE = 40;
const VENUE_SIZE = 34;
const WORDMARK_SIZE = 24;

const WORDMARK_BASELINE = POSTER_HEIGHT - EDGE + 24;
const VENUE_BASELINE = WORDMARK_BASELINE - 58;
const DATE_BASELINE = VENUE_BASELINE - 54;

function build(ctx: FamilyContext): FamilyResult {
  const { bg, fg, accent } = ctx.palette;

  const title = fitTitleIn(ctx.input.title, {
    boxWidth: COLUMN,
    boxHeight: TITLE_BOX_HEIGHT,
    ladder: TITLE_LADDER,
    role: 'display',
    lineHeightRatio: TITLE_LINE_HEIGHT_RATIO,
  });

  const background: RectShape = {
    x: 0,
    y: 0,
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    fill: bg,
  };

  // `band` is this family's window. It is drawn after the photo and before the
  // accents, so when there IS a photo it must not cover it — it is placed
  // outside the window in that case, as a hairline under the headline rule.
  // (Every family has to return a band; this is how `axial` spends its one.)
  const band: RectShape = ctx.hasPhoto
    ? { x: EDGE, y: WINDOW_BOTTOM + 30, width: COLUMN, height: 3, fill: fg }
    : { x: WINDOW_X, y: WINDOW_TOP, width: WINDOW_SIZE, height: WINDOW_SIZE, fill: accent };

  const photo = ctx.photoDataUri
    ? {
        rect: {
          x: WINDOW_X,
          y: WINDOW_TOP,
          width: WINDOW_SIZE,
          height: WINDOW_SIZE,
          fill: accent,
        },
        dataUri: ctx.photoDataUri,
      }
    : null;

  const accents: RectShape[] = [];
  const texts: TextRun[] = [];

  // Headline, centred, flush to the top of its box and reading downward.
  title.lines.forEach((line, i) => {
    texts.push({
      text: line,
      x: CENTRE_X,
      y: TITLE_TOP + title.fontSize * TITLE_ASCENT_RATIO + i * title.lineHeight,
      fontSize: title.fontSize,
      role: 'display',
      fill: fg,
      opacity: 1,
      letterSpacing: 1,
      anchor: 'middle',
    });
  });

  // The rule sits between the headline and the window, centred on the axis.
  // It is the family's one horizontal and the thing that stops the stack from
  // reading as three unrelated blocks floating in a field.
  //
  // Its y is the MIDPOINT between the headline and the window, not a fixed
  // offset under the headline. A short title otherwise leaves all of its air in
  // one lump above the window, and the rule sitting high in that gap makes the
  // poster read as two stacked things rather than one column.
  const titleBottom = TITLE_TOP + title.lines.length * title.lineHeight;
  accents.push({
    x: CENTRE_X - RULE_WIDTH / 2,
    y: Math.round((titleBottom + WINDOW_TOP) / 2) - RULE_HEIGHT / 2,
    width: RULE_WIDTH,
    height: RULE_HEIGHT,
    fill: accent,
  });

  if (!ctx.hasPhoto) {
    // p36's move: the window fills rather than disappearing, and the date
    // becomes the image. Ink is `bg` on the accent field for the same reason
    // `block` gives — `fg` is chosen to sit on `bg` and can vanish on `accent`.
    const parts = ctx.dateParts;
    if (parts) {
      texts.push({
        text: parts.day,
        x: CENTRE_X,
        y: WINDOW_TOP + WINDOW_SIZE * 0.58,
        fontSize: BIG_DAY_SIZE,
        role: 'uiBold',
        fill: bg,
        opacity: 1,
        letterSpacing: -8,
        anchor: 'middle',
      });
      texts.push({
        text: parts.weekday,
        x: CENTRE_X,
        y: WINDOW_TOP + 90,
        fontSize: BIG_WEEKDAY_SIZE,
        role: 'ui',
        fill: bg,
        opacity: 0.75,
        letterSpacing: 10,
        anchor: 'middle',
      });
      texts.push({
        text: `${parts.month} ${parts.year}`,
        x: CENTRE_X,
        y: WINDOW_TOP + WINDOW_SIZE - 70,
        fontSize: BIG_MONTH_SIZE,
        role: 'uiBold',
        fill: bg,
        opacity: 1,
        letterSpacing: 8,
        anchor: 'middle',
      });
    } else {
      // No parseable date. Rather than an empty accent square, set the time-
      // less venue large in the window so it still carries something.
      texts.push({
        text: truncateToWidth(ctx.venueLine, BIG_MONTH_SIZE, 'uiBold', WINDOW_SIZE - 80),
        x: CENTRE_X,
        y: WINDOW_TOP + WINDOW_SIZE / 2,
        fontSize: BIG_MONTH_SIZE,
        role: 'uiBold',
        fill: bg,
        opacity: 1,
        letterSpacing: 6,
        anchor: 'middle',
      });
    }
  }

  if (ctx.dateLine) {
    texts.push({
      text: truncateToWidth(ctx.dateLine, DATE_SIZE, 'uiBold', COLUMN),
      x: CENTRE_X,
      y: DATE_BASELINE,
      fontSize: DATE_SIZE,
      role: 'uiBold',
      fill: fg,
      opacity: 1,
      letterSpacing: 2,
      anchor: 'middle',
    });
  }

  texts.push({
    text: truncateToWidth(ctx.venueLine, VENUE_SIZE, 'ui', COLUMN),
    x: CENTRE_X,
    y: VENUE_BASELINE,
    fontSize: VENUE_SIZE,
    role: 'ui',
    fill: fg,
    opacity: 0.85,
    letterSpacing: 1,
    anchor: 'middle',
  });

  texts.push({
    text: 'SPHAER',
    x: CENTRE_X,
    y: WORDMARK_BASELINE,
    fontSize: WORDMARK_SIZE,
    role: 'uiBold',
    fill: fg,
    opacity: 0.6,
    letterSpacing: 8,
    anchor: 'middle',
  });

  return { background, photo, band, accents, texts, titleTruncated: title.truncated };
}

export const axialFamily: PosterFamily = {
  id: 'axial',
  label: 'Centred axial',
  /**
   * Saturated or neutral grounds — palettes.md: "the ground is usually a
   * saturated field rather than a neutral" for this family, and the ground is
   * half the poster's area here, so it has to carry.
   *
   * Excluded on purpose:
   *   * `acid` — a 300px numeral in black on acid green is the loudest thing
   *     the generator can produce, and this is the calm family. It belongs to
   *     `technical`, where near-black is definitional.
   *   * `paper` — its klein-blue accent against a near-white ground makes the
   *     window read as a UI panel rather than as a field.
   */
  palettes: ['signal', 'bone', 'navy', 'yellow', 'teal', 'orange', 'blush', 'aubergine', 'ink'],
  build,
};
