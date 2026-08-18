/**
 * Cover family: `plate` — full-bleed photograph, type on an inset plate.
 * Adapted from the portrait `panel` family (reference: earthbodies.png).
 *
 * This is the family that adapts most cleanly, because its idea — nothing crops
 * the picture, the type floats on its own opaque plate — is not an idea about
 * being tall. It is the best showcase a circle with a real photograph has.
 *
 * ── The one change that matters: the plate is not centred ────────────────────
 * `panel` centres its plate horizontally, and on a poster that is right. On a
 * cover it is wrong, and not for a taste reason: the circle detail screen hangs
 * a 90pt avatar over the banner at `left: 16, bottom: -45`, which occludes
 * roughly x < 400, y > 530 of this canvas. A centred plate spanning the middle
 * runs straight through it, and the bottom-left of the type block disappears
 * under a photograph of somebody's face.
 *
 * So the plate is pushed RIGHT, starting past the avatar's reach. The
 * composition becomes asymmetric on purpose, and it reads deliberately —
 * picture on the left, type block on the right, which is a normal banner
 * arrangement rather than a poster with a hole punched in it.
 *
 * Type stays centred WITHIN the plate, as in `panel`, and for the reason given
 * there: flush-left type on a plate over a photo makes this and the split
 * family look like the same composition recoloured.
 *
 * ── Height is solved from content, not fixed ─────────────────────────────────
 * Inherited from `panel` and worth keeping: a one-line name gets a compact
 * plate and a two-line name a taller one. A fixed plate leaves a short name
 * swimming, which is the same dead-space failure the old four-bar fallback had.
 */

import {
  fitTitleIn,
  truncateToWidth,
  type FamilyResult,
  type RectShape,
  type TextRun,
} from '@/utils/poster-metrics';
import {
  COVER_AVATAR_SAFE_X,
  COVER_HEIGHT,
  COVER_MARGIN,
  COVER_MAX_TITLE_LINES,
  COVER_SAFE_BOTTOM_Y,
  COVER_SAFE_Y,
  COVER_WIDTH,
  type CoverContext,
  type CoverFamily,
} from '@/utils/cover-metrics';

/**
 * The plate starts clear of the avatar's reach (x < 400) with 40px to spare,
 * and ends at the right margin.
 */
const PLATE_X = COVER_AVATAR_SAFE_X + 40;
const PLATE_RIGHT = COVER_WIDTH - COVER_MARGIN;
const PLATE_WIDTH = PLATE_RIGHT - PLATE_X;
const PLATE_CENTRE_X = PLATE_X + PLATE_WIDTH / 2;

const PAD = 48;
const NAME_BOX_WIDTH = PLATE_WIDTH - PAD * 2;
const NAME_BOX_HEIGHT = 220;
const NAME_LADDER = [104, 90, 78, 66, 56, 48] as const;
const NAME_LINE_HEIGHT_RATIO = 1.1;
const NAME_ASCENT_RATIO = 0.78;

const RULE_WIDTH = 88;
const RULE_HEIGHT = 6;

const KICKER_SIZE = 26;
const WORDMARK_SIZE = 22;

/** Hairline frame inset, as in `panel` — inside the safe band, not the canvas. */
const FRAME_INSET = 36;
const FRAME = 5;

function build(ctx: CoverContext): FamilyResult {
  const { bg, fg, accent } = ctx.palette;

  const name = fitTitleIn(ctx.name, {
    boxWidth: NAME_BOX_WIDTH,
    boxHeight: NAME_BOX_HEIGHT,
    ladder: NAME_LADDER,
    role: 'display',
    lineHeightRatio: NAME_LINE_HEIGHT_RATIO,
    maxLines: COVER_MAX_TITLE_LINES,
  });

  const background: RectShape = {
    x: 0,
    y: 0,
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    fill: bg,
  };

  const photo = ctx.photoDataUri
    ? {
        rect: { x: 0, y: 0, width: COVER_WIDTH, height: COVER_HEIGHT, fill: bg },
        dataUri: ctx.photoDataUri,
      }
    : null;

  // With a photo the photograph IS the ground, so there is nothing to paint;
  // without one the whole field becomes accent and the same plate floats in it.
  const band: RectShape = ctx.hasPhoto
    ? { x: 0, y: 0, width: 0, height: 0, fill: bg }
    : { x: 0, y: 0, width: COVER_WIDTH, height: COVER_HEIGHT, fill: accent };

  const accents: RectShape[] = [];
  const texts: TextRun[] = [];

  // The frame sits INSIDE the safe band vertically, not inside the canvas.
  //
  // The first version inset outward from the safe band (140 - 36 = 104) and put
  // both horizontal bars outside the visible strip, which on a Pro Max starts
  // at y=137. The frame rendered as two unexplained vertical rules down the
  // edges of the banner and nothing else — precisely the failure this comment
  // originally claimed to be avoiding. The QA sheet caught it; the arithmetic
  // did not, because nothing in the layout maths knows about the crop.
  const frameTop = COVER_SAFE_Y + FRAME_INSET;
  const frameBottom = COVER_SAFE_BOTTOM_Y - FRAME_INSET;
  const frameW = COVER_WIDTH - FRAME_INSET * 2;
  const frameH = frameBottom - frameTop;
  for (const bar of [
    { x: FRAME_INSET, y: frameTop, width: frameW, height: FRAME },
    { x: FRAME_INSET, y: frameBottom - FRAME, width: frameW, height: FRAME },
    { x: FRAME_INSET, y: frameTop, width: FRAME, height: frameH },
    { x: COVER_WIDTH - FRAME_INSET - FRAME, y: frameTop, width: FRAME, height: frameH },
  ]) {
    accents.push({ ...bar, fill: bg });
  }

  // Solved from the content, then centred in the safe band so the plate never
  // drifts into the cropped zone at either edge.
  const kickerGap = ctx.metaLine ? 46 : 0;
  const nameHeight = name.lines.length * name.lineHeight;
  const contentHeight = kickerGap + RULE_HEIGHT + 36 + nameHeight + 44;
  const plateHeight = contentHeight + PAD * 2;
  const plateTop = COVER_SAFE_Y + (COVER_SAFE_BOTTOM_Y - COVER_SAFE_Y - plateHeight) / 2;

  accents.push({
    x: PLATE_X,
    y: plateTop,
    width: PLATE_WIDTH,
    height: plateHeight,
    fill: bg,
  });

  let cursor = plateTop + PAD;

  if (ctx.metaLine) {
    texts.push({
      text: truncateToWidth(ctx.metaLine, KICKER_SIZE, 'uiBold', NAME_BOX_WIDTH),
      x: PLATE_CENTRE_X,
      y: cursor + KICKER_SIZE * 0.78,
      fontSize: KICKER_SIZE,
      role: 'uiBold',
      fill: accent,
      opacity: 1,
      letterSpacing: 6,
      anchor: 'middle',
    });
    cursor += kickerGap;
  }

  accents.push({
    x: PLATE_CENTRE_X - RULE_WIDTH / 2,
    y: cursor,
    width: RULE_WIDTH,
    height: RULE_HEIGHT,
    fill: accent,
  });
  cursor += RULE_HEIGHT + 36;

  name.lines.forEach((line, i) => {
    texts.push({
      text: line,
      x: PLATE_CENTRE_X,
      y: cursor + name.fontSize * NAME_ASCENT_RATIO + i * name.lineHeight,
      fontSize: name.fontSize,
      role: 'display',
      fill: fg,
      opacity: 1,
      letterSpacing: 0,
      anchor: 'middle',
    });
  });
  cursor += nameHeight + 34;

  texts.push({
    text: 'SPHAER',
    x: PLATE_CENTRE_X,
    y: cursor,
    fontSize: WORDMARK_SIZE,
    role: 'uiBold',
    fill: fg,
    opacity: 0.55,
    letterSpacing: 8,
    anchor: 'middle',
  });

  return { background, photo, band, accents, texts, titleTruncated: name.truncated };
}

export const plateFamily: CoverFamily = {
  id: 'plate',
  label: 'Photo + inset plate',
  /**
   * `yellow`, `orange` and `blush` are excluded, inheriting `panel`'s reason:
   * with a photo behind it a high-key plate competes with the image instead of
   * sitting on it, and without one the whole cover becomes a field of that
   * colour.
   */
  palettes: ['acid', 'signal', 'bone', 'navy', 'aubergine', 'teal', 'paper', 'ink'],
  build,
};
