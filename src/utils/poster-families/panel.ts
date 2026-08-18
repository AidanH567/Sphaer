/**
 * Family: `panel` — photograph across the whole poster, type on an inset panel.
 * Reference: earthbodies.png.
 *
 * The best showcase the generator has for an event that brought a real photo:
 * nothing crops the image, and the type sits on its own opaque plate floating
 * clear of the edges so the photograph reads as a photograph rather than as a
 * header strip.
 *
 * ── Why the type is centred ──────────────────────────────────────────────────
 * Every other family sets flush left. On a first pass this family did too, and
 * with a full-bleed photo above a solid type plate it looked like `classic`
 * with the band moved up — the two were the closest pair on the contact sheet.
 * Centring the panel's type (the `anchor: 'middle'` runs below) separates them
 * immediately, and it suits a plate that is itself floating and symmetrical.
 *
 * The panel's HEIGHT is solved from its content rather than fixed, so a
 * one-line title gets a compact plate and a three-line one gets a tall plate.
 * A fixed plate would leave a short title swimming in empty colour, which is
 * the same dead-space failure the old four-bar fallback had.
 *
 * Without a photo the whole ground becomes the accent colour and the same panel
 * floats in it — a gallery card. The composition is identical; only what is
 * behind the plate changes, which is what keeps the photo-less variant from
 * reading as a broken version of the photographic one.
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

const PANEL_WIDTH = 820;
const PANEL_X = (POSTER_WIDTH - PANEL_WIDTH) / 2;
/** The plate floats clear of the bottom edge so the photo runs past it. */
const PANEL_BOTTOM = POSTER_HEIGHT - 170;
const PAD = 60;

const CENTRE_X = POSTER_WIDTH / 2;

const TITLE_BOX_WIDTH = PANEL_WIDTH - PAD * 2;
const TITLE_BOX_HEIGHT = 380;
const TITLE_LADDER = [124, 106, 90, 76, 64, 54, 46] as const;
const TITLE_LINE_HEIGHT_RATIO = 1.1;
const TITLE_ASCENT_RATIO = 0.78;

const RULE_WIDTH = 96;
const RULE_HEIGHT = 8;

const DATE_SIZE = 36;
const VENUE_SIZE = 32;
const WORDMARK_SIZE = 24;

function build(ctx: FamilyContext): FamilyResult {
  const { bg, fg, accent } = ctx.palette;

  const title = fitTitleIn(ctx.input.title, {
    boxWidth: TITLE_BOX_WIDTH,
    boxHeight: TITLE_BOX_HEIGHT,
    ladder: TITLE_LADDER,
    role: 'display',
    lineHeightRatio: TITLE_LINE_HEIGHT_RATIO,
  });

  // Solved bottom-up from the plate's lower edge, then the plate's top is
  // whatever the content needed. Nothing here is a fixed panel height.
  const wordmarkBaseline = PANEL_BOTTOM - PAD;
  const venueBaseline = wordmarkBaseline - 52;
  const dateBaseline = venueBaseline - 52;
  const titleBottom = dateBaseline - 58;
  const titleHeight = title.lines.length * title.lineHeight;
  const titleTop = titleBottom - titleHeight;
  const ruleY = titleTop - 46;
  const panelTop = ruleY - PAD;

  const background: RectShape = {
    x: 0,
    y: 0,
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    fill: bg,
  };

  const photo = ctx.photoDataUri
    ? {
        rect: { x: 0, y: 0, width: POSTER_WIDTH, height: POSTER_HEIGHT, fill: bg },
        dataUri: ctx.photoDataUri,
      }
    : null;

  const accents: RectShape[] = [];

  // `band` is the ground behind the plate. With a photo there is nothing to
  // paint (the photograph is the ground), so it is a zero-height rect; without
  // one it is a full-bleed accent field.
  const band: RectShape = ctx.hasPhoto
    ? { x: 0, y: 0, width: 0, height: 0, fill: bg }
    : { x: 0, y: 0, width: POSTER_WIDTH, height: POSTER_HEIGHT, fill: accent };

  // An inset hairline frame, as in sensory-drift.
  //
  // Added after the first contact sheet: at mural thumbnail size the photo-less
  // variant was the weakest tile on the sheet — a small plate adrift in a field
  // of flat colour, with no structure at all once the type stopped being
  // legible. The frame gives the field an edge to hold, and it does the same
  // job over a photograph, so both variants get it and the composition stays
  // the same either way.
  const FRAME_INSET = 44;
  const FRAME = 6;
  const frameW = POSTER_WIDTH - FRAME_INSET * 2;
  const frameH = POSTER_HEIGHT - FRAME_INSET * 2;
  for (const bar of [
    { x: FRAME_INSET, y: FRAME_INSET, width: frameW, height: FRAME },
    { x: FRAME_INSET, y: POSTER_HEIGHT - FRAME_INSET - FRAME, width: frameW, height: FRAME },
    { x: FRAME_INSET, y: FRAME_INSET, width: FRAME, height: frameH },
    { x: POSTER_WIDTH - FRAME_INSET - FRAME, y: FRAME_INSET, width: FRAME, height: frameH },
  ]) {
    accents.push({ ...bar, fill: bg });
  }

  // The plate itself, opaque, over whichever ground was painted.
  accents.push({
    x: PANEL_X,
    y: panelTop,
    width: PANEL_WIDTH,
    height: PANEL_BOTTOM - panelTop,
    fill: bg,
  });
  accents.push({
    x: CENTRE_X - RULE_WIDTH / 2,
    y: ruleY,
    width: RULE_WIDTH,
    height: RULE_HEIGHT,
    fill: accent,
  });

  const texts: TextRun[] = [];

  title.lines.forEach((line, i) => {
    texts.push({
      text: line,
      x: CENTRE_X,
      y: titleTop + title.fontSize * TITLE_ASCENT_RATIO + i * title.lineHeight,
      fontSize: title.fontSize,
      role: 'display',
      fill: fg,
      opacity: 1,
      letterSpacing: 0,
      anchor: 'middle',
    });
  });

  if (ctx.dateLine) {
    texts.push({
      text: truncateToWidth(ctx.dateLine, DATE_SIZE, 'uiBold', TITLE_BOX_WIDTH),
      x: CENTRE_X,
      y: dateBaseline,
      fontSize: DATE_SIZE,
      role: 'uiBold',
      fill: fg,
      opacity: 1,
      letterSpacing: 2,
      anchor: 'middle',
    });
  }

  texts.push({
    text: truncateToWidth(ctx.venueLine, VENUE_SIZE, 'ui', TITLE_BOX_WIDTH),
    x: CENTRE_X,
    y: venueBaseline,
    fontSize: VENUE_SIZE,
    role: 'ui',
    fill: fg,
    opacity: 0.8,
    letterSpacing: 0,
    anchor: 'middle',
  });

  texts.push({
    text: 'SPHAER',
    x: CENTRE_X,
    y: wordmarkBaseline,
    fontSize: WORDMARK_SIZE,
    role: 'uiBold',
    fill: fg,
    opacity: 0.55,
    letterSpacing: 8,
    anchor: 'middle',
  });

  return { background, photo, band, accents, texts, titleTruncated: title.truncated };
}

export const panelFamily: PosterFamily = {
  id: 'panel',
  label: 'Full-bleed + panel',
  /**
   * `yellow`, `orange` and `blush` are excluded: with a photo behind it, a
   * high-key plate competes with the image instead of sitting on it, and
   * without one the whole poster becomes a field of that colour, which at
   * poster scale is a lot of yellow.
   */
  palettes: ['acid', 'signal', 'bone', 'navy', 'aubergine', 'teal', 'paper', 'ink'],
  build,
};
