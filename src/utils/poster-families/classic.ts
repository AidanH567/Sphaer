/**
 * Family: `classic` — photo across the top, solid type band beneath.
 *
 * This is the original Sphaer poster, kept because it was never actually bad
 * WITH a photo — it was only bad as the one and only option. Its geometry is
 * unchanged from the single-template era, so an event that lands on `classic`
 * today regenerates the poster it always had, give or take the palette subset.
 *
 * ── What did change: the no-photo field ──────────────────────────────────────
 * The old fallback painted four descending accent bars down the empty upper
 * half. On the contact sheet that reads unmistakably as a loading skeleton —
 * the four grey lines every list placeholder in the app draws — and it was on
 * every photo-less poster the generator had ever made.
 *
 * It is replaced by a full-bleed accent field carrying the date at 340px. That
 * is a real poster move (a date IS the headline on a gig poster), it survives
 * being shrunk to a mural thumbnail where the title is illegible anyway, and it
 * cannot be mistaken for a component that has not finished loading.
 */

import {
  COLUMN,
  MARGIN,
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

/**
 * Where the solid type band starts. Above it is either the photo or the accent
 * date field; below it is always flat opaque colour, so the type never sits on
 * an unpredictable photo.
 */
const BAND_TOP = 856;

// Vertical rhythm inside the band, solved bottom-up from the wordmark so the
// block is optically anchored to the bottom edge rather than floating.
const WORDMARK_BASELINE = POSTER_HEIGHT - 60;
const VENUE_BASELINE = WORDMARK_BASELINE - 62;
const DATE_BASELINE = VENUE_BASELINE - 56;
/** Lowest the title block may reach before it crowds the date line. */
const TITLE_MAX_BOTTOM = DATE_BASELINE - 58;

const RULE_Y = BAND_TOP + 56;
const RULE_HEIGHT = 10;
const RULE_WIDTH = 140;
const TITLE_TOP = RULE_Y + RULE_HEIGHT + 44;

/**
 * Exported because `fitTitle()` in poster-template.ts is the pre-family public
 * helper and has to keep meaning "fit a title for the classic band" — callers
 * and tests outside this module still expect a 104px "Nachtstrom". Re-exporting
 * the numbers rather than restating them is what stops the shim drifting away
 * from the family it claims to describe.
 */
export const CLASSIC_TITLE_LADDER = [104, 88, 76, 64, 54] as const;
export const CLASSIC_TITLE_LINE_HEIGHT_RATIO = 1.06;
export const CLASSIC_TITLE_BOX_HEIGHT = TITLE_MAX_BOTTOM - TITLE_TOP;

const TITLE_LADDER = CLASSIC_TITLE_LADDER;
const TITLE_LINE_HEIGHT_RATIO = CLASSIC_TITLE_LINE_HEIGHT_RATIO;
const TITLE_BOX_HEIGHT = CLASSIC_TITLE_BOX_HEIGHT;
/** Baseline offset within a line box — roughly the cap-height of the serif. */
const TITLE_ASCENT_RATIO = 0.78;

const DATE_SIZE = 40;
const VENUE_SIZE = 34;
const WORDMARK_SIZE = 26;

// The no-photo date field.
const FIELD_MONTH_SIZE = 64;
const FIELD_DAY_SIZE = 340;
const FIELD_WEEKDAY_SIZE = 60;

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

  const photo = ctx.photoDataUri
    ? {
        rect: { x: 0, y: 0, width: POSTER_WIDTH, height: BAND_TOP, fill: bg },
        dataUri: ctx.photoDataUri,
      }
    : null;

  const band: RectShape = {
    x: 0,
    y: BAND_TOP,
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT - BAND_TOP,
    fill: bg,
  };

  const accents: RectShape[] = [];
  const texts: TextRun[] = [];

  if (!ctx.hasPhoto) {
    // Full-bleed accent field, then the date set into it as the headline.
    // Ink is `bg` rather than `fg`: every pair in the token list is designed so
    // that bg-on-accent is a deliberate two-colour combination, whereas fg is
    // chosen to sit on bg and can vanish on the accent.
    accents.push({ x: 0, y: 0, width: POSTER_WIDTH, height: BAND_TOP, fill: accent });

    const parts = ctx.dateParts;
    if (parts) {
      texts.push({
        text: `${parts.month} ${parts.year}`,
        x: MARGIN,
        y: 236,
        fontSize: FIELD_MONTH_SIZE,
        role: 'uiBold',
        fill: bg,
        opacity: 1,
        letterSpacing: 6,
      });
      texts.push({
        text: parts.day,
        x: MARGIN,
        y: 660,
        fontSize: FIELD_DAY_SIZE,
        role: 'uiBold',
        fill: bg,
        opacity: 1,
        letterSpacing: -8,
      });
      texts.push({
        text: `${parts.weekday} · ${parts.time}`,
        x: MARGIN,
        y: 776,
        fontSize: FIELD_WEEKDAY_SIZE,
        role: 'uiBold',
        fill: bg,
        opacity: 1,
        letterSpacing: 4,
      });
    } else {
      // Unparseable start time. Reachable only by calling the builder directly
      // with garbage — the hook refuses a NaN date — but the field must not be
      // an empty 856px slab if it happens, so the venue carries it instead.
      texts.push({
        text: truncateToWidth(ctx.venueLine.toUpperCase(), FIELD_MONTH_SIZE, 'uiBold', COLUMN),
        x: MARGIN,
        y: 236,
        fontSize: FIELD_MONTH_SIZE,
        role: 'uiBold',
        fill: bg,
        opacity: 1,
        letterSpacing: 6,
      });
    }
  }

  // The rule above the title, inside the band. Drawn after the field so it is
  // never covered by it.
  accents.push({ x: MARGIN, y: RULE_Y, width: RULE_WIDTH, height: RULE_HEIGHT, fill: accent });

  title.lines.forEach((line, i) => {
    texts.push({
      text: line,
      x: MARGIN,
      y: TITLE_TOP + title.fontSize * TITLE_ASCENT_RATIO + i * title.lineHeight,
      fontSize: title.fontSize,
      role: 'display',
      fill: fg,
      opacity: 1,
      letterSpacing: 0,
    });
  });

  if (ctx.dateLine) {
    texts.push({
      text: truncateToWidth(ctx.dateLine, DATE_SIZE, 'uiBold', COLUMN),
      x: MARGIN,
      y: DATE_BASELINE,
      fontSize: DATE_SIZE,
      role: 'uiBold',
      fill: fg,
      opacity: 1,
      letterSpacing: 1,
    });
  }

  texts.push({
    text: truncateToWidth(ctx.venueLine, VENUE_SIZE, 'ui', COLUMN),
    x: MARGIN,
    y: VENUE_BASELINE,
    fontSize: VENUE_SIZE,
    role: 'ui',
    fill: fg,
    opacity: 0.8,
    letterSpacing: 0,
  });

  texts.push({
    text: 'SPHAER',
    x: MARGIN,
    y: WORDMARK_BASELINE,
    fontSize: WORDMARK_SIZE,
    role: 'uiBold',
    fill: fg,
    opacity: 0.55,
    letterSpacing: 8,
  });

  return { background, photo, band, accents, texts, titleTruncated: title.truncated };
}

export const classicFamily: PosterFamily = {
  id: 'classic',
  label: 'Classic band',
  // Every pair works here: the type sits on `bg` in the band, and the only
  // bg-on-accent surface is the no-photo date field, which all eleven carry.
  palettes: [
    'acid',
    'signal',
    'bone',
    'navy',
    'yellow',
    'aubergine',
    'teal',
    'orange',
    'blush',
    'paper',
    'ink',
  ],
  build,
};
