/**
 * Cover family: `marquee` — the name centred on a flat field, as a title card.
 * Adapted from the portrait `classic` family.
 *
 * ── What survived the adaptation, and what did not ───────────────────────────
 * `classic` is a photo across the top and a solid type band beneath it, with
 * its vertical rhythm solved BOTTOM-UP from a wordmark pinned 60px off the
 * bottom edge. None of that geometry can come over: on a cover the bottom 140px
 * is cropped away by the circle detail screen, so a baseline at `height - 60`
 * is simply not on screen, and a two-part vertical stack in 530 usable pixels
 * gives each part 265 — too little for either to be a composition.
 *
 * What DID come over is the part of `classic` that was never about the split:
 * the serif display face, the accent rule as the thing the type starts from,
 * and the principle that the title carries the poster on its own. So this is
 * `classic`'s typography on a centred axis instead of `classic`'s skeleton at
 * the wrong aspect — which is the honest way to adapt a family that does not
 * survive a rotation, rather than squashing it and calling it landscape.
 *
 * It is also the family that matters most, per `docs/poster-reference/`, which
 * ranks type-as-image first for value-for-effort precisely because it needs no
 * photograph. Most circles will not have one.
 *
 * ── The letterbox band ───────────────────────────────────────────────────────
 * With a photo, the type does not sit on the picture — it sits on an opaque
 * full-width band across the middle. That is a different device from `plate`'s
 * inset lozenge and it suits a centred axis: the band spans the whole width so
 * the composition stays symmetric, and because it is full-width it cannot
 * collide with the avatar corner the way a floating plate can.
 */

import {
  fitTitleIn,
  truncateToWidth,
  type FamilyResult,
  type RectShape,
  type TextRun,
} from '@/utils/poster-metrics';
import {
  COVER_AVATAR_SAFE_Y,
  COVER_HEIGHT,
  COVER_MARGIN,
  COVER_MAX_TITLE_LINES,
  COVER_SAFE_HEIGHT,
  COVER_SAFE_Y,
  COVER_WIDTH,
  type CoverContext,
  type CoverFamily,
} from '@/utils/cover-metrics';

const CENTRE_X = COVER_WIDTH / 2;

/** Generous side rest — a centred line reads better with room either side. */
const NAME_BOX_WIDTH = COVER_WIDTH - COVER_MARGIN * 4;

/**
 * Two type scales, and the smaller one is not a detail.
 *
 * Owning the whole field, the name can run at 140px — it IS the composition.
 * Sitting on a letterbox band over a photograph it cannot, and not for taste:
 * the band has to be SHORTER than the visible strip or the photograph is never
 * seen at all. The first version of this family set one ladder for both and
 * sized the band to the safe area, which meant the band spanned y 100–710 while
 * the visible strip is y 112–698 — so every photo cover rendered as a flat
 * colour card with the picture entirely hidden behind it. Every automated check
 * passed. It was the as-displayed QA sheet that caught it.
 *
 * The box heights are what actually enforce it: at 170 a two-line name is
 * forced down to 70px, which keeps the solved band near 360px and leaves ~90px
 * of photograph above and below on the narrowest phone.
 */
const NAME_LADDER_FLAT = [140, 120, 102, 86, 72, 60, 50] as const;
const NAME_BOX_HEIGHT_FLAT = 260;
const NAME_LADDER_PHOTO = [96, 82, 70, 60, 50] as const;
const NAME_BOX_HEIGHT_PHOTO = 170;

const NAME_LINE_HEIGHT_RATIO = 1.08;
const NAME_ASCENT_RATIO = 0.78;

const KICKER_SIZE = 28;
const WORDMARK_SIZE = 24;

const RULE_WIDTH = 120;
const RULE_HEIGHT = 8;

/** Padding inside the letterbox band, above the kicker and below the wordmark. */
const BAND_PAD = 36;

function build(ctx: CoverContext): FamilyResult {
  const { bg, fg, accent } = ctx.palette;

  const name = fitTitleIn(ctx.name, {
    boxWidth: NAME_BOX_WIDTH,
    boxHeight: ctx.hasPhoto ? NAME_BOX_HEIGHT_PHOTO : NAME_BOX_HEIGHT_FLAT,
    ladder: ctx.hasPhoto ? NAME_LADDER_PHOTO : NAME_LADDER_FLAT,
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

  const accents: RectShape[] = [];
  const texts: TextRun[] = [];

  // ── Solve the content block first, then place it ───────────────────────────
  // Centred in the SAFE band, never measured from the canvas edges: the top and
  // bottom 140px are cropped away and cannot anchor anything. A poster family
  // solves bottom-up from the bottom edge; here that would put the wordmark
  // off screen.
  const kickerBlock = ctx.metaLine ? KICKER_SIZE + 18 : 0;
  const ruleBlock = RULE_HEIGHT + 34;
  const nameHeight = name.lines.length * name.lineHeight;
  const wordmarkBlock = 26 + WORDMARK_SIZE;
  const contentHeight = kickerBlock + ruleBlock + nameHeight + wordmarkBlock;

  let contentTop = COVER_SAFE_Y + (COVER_SAFE_HEIGHT - contentHeight) / 2;

  // ── Keep the name's descenders out of the avatar corner ────────────────────
  // Centred type is not automatically safe from a bottom-LEFT obstruction. A
  // wide two-line name — `SXTN — "Kann Sein, Dass Scheiße Wird"` is the real
  // one — reaches x ≈ 180 at 120px, well inside the avatar's x < 400, and if
  // the block sits low its last line clips.
  //
  // Shift the whole block up rather than step the type down: losing 20px of air
  // costs nothing, losing a ladder step costs the composition. The wordmark
  // below the name is narrow and centred (x ≈ 680–760), so it is never at risk.
  const nameBottomFrom = (top: number) => {
    const nameTopAt = top + kickerBlock + ruleBlock;
    const lastBaseline =
      nameTopAt + name.fontSize * NAME_ASCENT_RATIO + (name.lines.length - 1) * name.lineHeight;
    return lastBaseline + name.fontSize * 0.22;
  };
  const overshoot = nameBottomFrom(contentTop) - (COVER_AVATAR_SAFE_Y - 8);
  if (overshoot > 0) contentTop = Math.max(COVER_SAFE_Y, contentTop - overshoot);

  // With a photo, `band` is the opaque letterbox the type sits on, sized to the
  // content so the photograph is still visible above and below it. Without one
  // the whole ground is already `bg`, so the band has nothing to do and is a
  // zero-height rect — the same trick `panel` uses.
  const band: RectShape = ctx.hasPhoto
    ? {
        x: 0,
        y: contentTop - BAND_PAD,
        width: COVER_WIDTH,
        height: contentHeight + BAND_PAD * 2,
        fill: bg,
      }
    : { x: 0, y: 0, width: 0, height: 0, fill: bg };

  const kickerBaseline = contentTop + KICKER_SIZE;
  const ruleY = contentTop + kickerBlock;
  const nameTop = ruleY + ruleBlock;
  const wordmarkBaseline = nameTop + nameHeight + wordmarkBlock - 6;

  if (ctx.metaLine) {
    texts.push({
      text: truncateToWidth(ctx.metaLine, KICKER_SIZE, 'uiBold', NAME_BOX_WIDTH),
      x: CENTRE_X,
      y: kickerBaseline,
      fontSize: KICKER_SIZE,
      role: 'uiBold',
      fill: accent,
      opacity: 1,
      letterSpacing: 8,
      anchor: 'middle',
    });
  }

  accents.push({
    x: CENTRE_X - RULE_WIDTH / 2,
    y: ruleY,
    width: RULE_WIDTH,
    height: RULE_HEIGHT,
    fill: accent,
  });

  name.lines.forEach((line, i) => {
    texts.push({
      text: line,
      x: CENTRE_X,
      y: nameTop + name.fontSize * NAME_ASCENT_RATIO + i * name.lineHeight,
      fontSize: name.fontSize,
      role: 'display',
      fill: fg,
      opacity: 1,
      letterSpacing: 0,
      anchor: 'middle',
    });
  });

  // Centred, so it is nowhere near the avatar's bottom-left corner.
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

  return { background, photo, band, accents, texts, titleTruncated: name.truncated };
}

export const marqueeFamily: CoverFamily = {
  id: 'marquee',
  label: 'Centred title card',
  /**
   * This family sets `fg` on `bg` and nothing else large, so it can carry the
   * pairs whose accent is too close in value to be an ink — including `blush`
   * and `acid`, which the split family has to refuse. The full list is
   * deliberate: with no photograph in most cases, colour is the only thing
   * separating one circle's cover from another's.
   */
  palettes: [
    'acid',
    'signal',
    'bone',
    'navy',
    'yellow',
    'aubergine',
    'teal',
    'blush',
    'paper',
    'ink',
  ],
  build,
};
