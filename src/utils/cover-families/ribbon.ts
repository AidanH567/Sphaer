/**
 * Cover family: `ribbon` — the Swiss two-block, re-cut for a wide frame.
 * Adapted from the portrait `block` family (reference: refined-play.png).
 *
 * ── What changed, and why it is not just a wider block ───────────────────────
 * `block` splits HORIZONTALLY: a colour block across the top two thirds, a
 * lower register beneath it holding meta on the left and a photograph on the
 * right. Every one of those decisions depends on having 1528px of height to
 * spend, and a cover has 810 of which only 530 survive the crop.
 *
 * So the split turns ninety degrees. The colour field takes the LEFT 61% and
 * the photograph the right, which is the natural banner form — and it keeps the
 * family's actual character, which was never "the block is on top", it was
 * "two flat fields meeting at a butt joint, type flush into the corner of one".
 *
 * Three further things had to move, none of them cosmetic:
 *
 *   1. The meta went ABOVE the name, as a kicker. `block` hangs its meta off
 *      the bottom-left; on a cover the bottom-left is under the circle's 90pt
 *      avatar (see `isUnderAvatar`). Putting a kicker on top is the only way to
 *      keep the name flush-left AND keep the meta readable.
 *   2. The wordmark went bottom-RIGHT, for the same reason, and is anchored
 *      `end` so a long name cannot push it off.
 *   3. `block`'s photo-less variant fills its empty field with the date at
 *      200px. A circle has no date — that is the single biggest difference
 *      between a cover and a poster, since every portrait family leans on an
 *      oversized day/month as its graphic anchor. The substitute is a monogram:
 *      the name's first letter at 300px. It is the only guaranteed graphic a
 *      circle owns.
 */

import {
  fitTitleIn,
  truncateToWidth,
  type FamilyResult,
  type RectShape,
  type TextRun,
} from '@/utils/poster-metrics';
import {
  COVER_HEIGHT,
  COVER_MARGIN,
  COVER_MAX_TITLE_LINES,
  COVER_SAFE_BOTTOM_Y,
  COVER_SAFE_Y,
  COVER_WIDTH,
  type CoverContext,
  type CoverFamily,
} from '@/utils/cover-metrics';

/** Where the two fields meet. 61% — the left field is the one that speaks. */
const SPLIT_X = 880;
const RIGHT_WIDTH = COVER_WIDTH - SPLIT_X;

const PAD = COVER_MARGIN;
const NAME_BOX_WIDTH = SPLIT_X - PAD * 2;

/**
 * Ladder tuned for the cover, not inherited. At 160pt display height one canvas
 * pixel is ~0.27pt, so 124px reads at ~34pt — a headline. `block`'s 140px top
 * step would be 38pt and leaves no room under it for the kicker.
 */
const NAME_LADDER = [124, 106, 90, 76, 64, 54] as const;
const NAME_LINE_HEIGHT_RATIO = 1.0;
const NAME_ASCENT_RATIO = 0.76;

const KICKER_SIZE = 30;
const KICKER_BASELINE = COVER_SAFE_Y + 44;
/** The name starts under the kicker and its rule, never at the safe edge. */
const NAME_TOP = KICKER_BASELINE + 52;
const NAME_BOX_HEIGHT = 300;

const RULE_WIDTH = 104;
const RULE_HEIGHT = 8;

const WORDMARK_SIZE = 24;
const WORDMARK_BASELINE = COVER_SAFE_BOTTOM_Y - 18;

const MONOGRAM_SIZE = 300;

/** First character of the name, uppercased. `Array.from` so an emoji or an
 *  astral-plane character counts as one glyph rather than half a surrogate. */
function monogramOf(name: string): string {
  return (Array.from(name.trim())[0] ?? 'S').toUpperCase();
}

function build(ctx: CoverContext): FamilyResult {
  const { bg, fg, accent } = ctx.palette;

  const name = fitTitleIn(ctx.name, {
    boxWidth: NAME_BOX_WIDTH,
    boxHeight: NAME_BOX_HEIGHT,
    ladder: NAME_LADDER,
    role: 'uiBold',
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

  // `band` is the left colour field. Drawn after the photo and before the
  // accents, which is where a solid type ground belongs.
  const band: RectShape = {
    x: 0,
    y: 0,
    width: SPLIT_X,
    height: COVER_HEIGHT,
    fill: accent,
  };

  const photo = ctx.photoDataUri
    ? {
        rect: { x: SPLIT_X, y: 0, width: RIGHT_WIDTH, height: COVER_HEIGHT, fill: bg },
        dataUri: ctx.photoDataUri,
      }
    : null;

  const accents: RectShape[] = [];
  const texts: TextRun[] = [];

  // Ink on the colour block is `bg`, not `fg` — the same rule the portrait
  // block follows, and for the same reason: every pair is designed so
  // bg-against-accent is a deliberate two-colour combination, whereas `fg` is
  // picked to sit on `bg` and can vanish entirely on the accent.
  if (ctx.metaLine) {
    texts.push({
      text: truncateToWidth(ctx.metaLine, KICKER_SIZE, 'uiBold', NAME_BOX_WIDTH),
      x: PAD,
      y: KICKER_BASELINE,
      fontSize: KICKER_SIZE,
      role: 'uiBold',
      fill: bg,
      opacity: 0.75,
      letterSpacing: 6,
    });
  } else {
    // No tags: a short accent rule stands in, so the name never starts against
    // an empty band with nothing above it.
    accents.push({ x: PAD, y: KICKER_BASELINE - 18, width: RULE_WIDTH, height: RULE_HEIGHT, fill: bg });
  }

  name.lines.forEach((line, i) => {
    texts.push({
      text: line,
      x: PAD,
      y: NAME_TOP + name.fontSize * NAME_ASCENT_RATIO + i * name.lineHeight,
      fontSize: name.fontSize,
      role: 'uiBold',
      fill: bg,
      opacity: 1,
      letterSpacing: -1,
    });
  });

  if (!ctx.hasPhoto) {
    // The right field becomes a flat `fg` block carrying the monogram — the
    // stand-in for the oversized date a poster would put here.
    accents.push({ x: SPLIT_X, y: 0, width: RIGHT_WIDTH, height: COVER_HEIGHT, fill: fg });
    texts.push({
      text: monogramOf(ctx.name),
      x: SPLIT_X + RIGHT_WIDTH / 2,
      y: COVER_HEIGHT / 2 + MONOGRAM_SIZE * 0.36,
      fontSize: MONOGRAM_SIZE,
      role: 'uiBold',
      fill: bg,
      opacity: 1,
      letterSpacing: -8,
      anchor: 'middle',
    });
  }

  // Pinned to the INSIDE of the split, end-anchored, not to the canvas edge.
  //
  // Two constraints meet here and only one position satisfies both. Bottom-left
  // is under the avatar, so it cannot go where a poster would put it. But the
  // far bottom-right is over the photograph, and `bg` is only guaranteed to
  // read against `accent` — over an arbitrary user photo no palette colour is
  // safe. Ending it at the split keeps it on the accent field, and at
  // x ≈ 680–800 it clears the avatar's x < 400 comfortably.
  texts.push({
    text: 'SPHAER',
    x: SPLIT_X - PAD,
    y: WORDMARK_BASELINE,
    fontSize: WORDMARK_SIZE,
    role: 'uiBold',
    fill: bg,
    opacity: 0.7,
    letterSpacing: 8,
    anchor: 'end',
  });

  return { background, photo, band, accents, texts, titleTruncated: name.truncated };
}

export const ribbonFamily: CoverFamily = {
  id: 'ribbon',
  label: 'Two-field split',
  /**
   * Excluded on purpose, inheriting `block`'s reasoning:
   *   * `acid` — an acid-green field beside a yellow one is two fluorescents
   *     fighting; the composition needs one loud colour, not two.
   *   * `blush` — its accent and fg are the same pine green, so the left field
   *     and the right field come out identical and the split disappears, which
   *     on a cover is the entire composition.
   */
  palettes: ['signal', 'bone', 'navy', 'yellow', 'teal', 'orange', 'paper', 'ink', 'aubergine'],
  build,
};
