/**
 * Family: `technical` — dark technical. Reference: p21's skeleton
 * (docs/poster-reference/families.md; ranked #5 for value-for-effort, and
 * called out as "well suited to tech and AI events, which Berlin has a lot of").
 *
 * Near-black ground, hairline sans set small and widely letterspaced, running
 * heads pinned into all four corners, registration crosses, and a footer
 * specification plate of labelled fields separated by rules. The title is set
 * flush left at moderate size — this is the one family where the title is NOT
 * the loudest thing on the poster; the apparatus around it is.
 *
 * ── Why it earns a place next to four existing families ──────────────────────
 * Two reasons, both structural rather than stylistic.
 *
 * 1. It is the only DARK-ONLY family. palettes.md calls near-black definitional
 *    here and caps accents "under 2% coverage". Every other family is allowed a
 *    saturated ground, so on a mural wall this one is the only poster that
 *    reads as a hole rather than as a colour — which is exactly the variety the
 *    wall was missing.
 * 2. It is the only family whose silhouette is defined by its EDGES. The corner
 *    running heads and registration marks mean the thumbnail has content in all
 *    four corners; `classic`, `block`, `panel` and `axial` are all centre-heavy
 *    and `spine` is left-heavy.
 *
 * ── The apparatus is the accent rule ─────────────────────────────────────────
 * generator-implications.md's "biggest gap" is that every Lara poster contains
 * one decision and the generator contains none. This family's decision is that
 * the metadata is presented as INSTRUMENTATION — four corner marks, a field
 * plate with rules, a sequence number derived from the date — so the poster
 * looks measured rather than decorated. Take the apparatus away and what is
 * left is a title on black, which is nothing.
 *
 * ── Without a photograph ─────────────────────────────────────────────────────
 * The image window becomes a hairline-framed empty aperture with a centred
 * cross — a registration target. That is deliberate: an empty frame is a real
 * element in technical printing, so the photo-less variant reads as intentional
 * rather than as a picture that failed to load. With a photo the same aperture
 * holds it, and the frame becomes its keyline.
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

const EDGE = 64;
const COLUMN = POSTER_WIDTH - EDGE * 2;

/** Hairline weight. Everything ruled on this poster is this thick. */
const HAIR = 3;

/** The running heads pinned into the four corners. */
const HEAD_SIZE = 22;
const HEAD_TOP_BASELINE = EDGE + HEAD_SIZE;
const HEAD_BOTTOM_BASELINE = POSTER_HEIGHT - EDGE;

/**
 * Registration crosses. A PAIR at the top corners, mirroring each other —
 * the first version put the second one at bottom-right, where the taller
 * aperture now drops it straight through the TIME field of the plate.
 */
const MARK_ARM = 26;
const MARK_INSET = EDGE + 54;
const MARK_Y = EDGE + 54;

/**
 * The aperture: a hairline-framed window holding the photo, or empty.
 *
 * Its height was 520 on the first contact sheet and that was wrong — it left
 * ~230px of dead ground between the specification plate and the foot, so the
 * poster's whole weight sat in its top half and the bottom read as unfinished.
 * Seen by looking at the render; no test could have said it.
 */
const APERTURE_TOP = 560;
const APERTURE_HEIGHT = 700;
const APERTURE_BOTTOM = APERTURE_TOP + APERTURE_HEIGHT;

const TITLE_TOP = 214;
const TITLE_BOX_HEIGHT = APERTURE_TOP - TITLE_TOP - 90;
const TITLE_LADDER = [104, 88, 76, 64, 54, 46, 40] as const;
const TITLE_LINE_HEIGHT_RATIO = 1.12;
const TITLE_ASCENT_RATIO = 0.78;

/** The footer specification plate. */
const PLATE_LABEL_SIZE = 20;
const PLATE_VALUE_SIZE = 34;
const PLATE_TOP = APERTURE_BOTTOM + 48;
const PLATE_LABEL_BASELINE = PLATE_TOP + PLATE_LABEL_SIZE;
const PLATE_VALUE_BASELINE = PLATE_LABEL_BASELINE + 52;
/** Three fields across the column: DATE | VENUE | REF. */
const FIELD_WIDTH = COLUMN / 3;

/**
 * A stable four-digit reference derived from the event's own date. Not random,
 * not a counter — the poster must regenerate identically forever, and anything
 * with state in it would break that. It exists because a specification plate
 * with two fields looks like a plate with a field missing.
 */
function referenceCode(startsAt: string): string {
  const t = Date.parse(startsAt);
  if (Number.isNaN(t)) return '0000';
  // Days since the epoch, wrapped. Two events on the same day share a code,
  // which is correct: it is a date stamp, not an identifier.
  return String(Math.floor(t / 86400000) % 10000).padStart(4, '0');
}

function cross(cx: number, cy: number, fill: string): RectShape[] {
  return [
    { x: cx - MARK_ARM, y: cy - HAIR / 2, width: MARK_ARM * 2, height: HAIR, fill },
    { x: cx - HAIR / 2, y: cy - MARK_ARM, width: HAIR, height: MARK_ARM * 2, fill },
  ];
}

function build(ctx: FamilyContext): FamilyResult {
  const { bg, fg, accent } = ctx.palette;

  const title = fitTitleIn(ctx.input.title, {
    boxWidth: COLUMN,
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

  // `band` is the footer specification plate — the block the type sits on.
  //
  // ⚠️ It is emphatically NOT the aperture, which is where it wanted to go. The
  // band is painted AFTER the photo (see PosterLayout in poster-metrics.ts), so
  // a band at the aperture's rect would cover the photograph completely — the
  // exact bug `spine` shipped once, where a backing plate hid the picture while
  // the layout stayed paintable, the PNG stayed the right size, and the ink
  // fraction went UP because a solid block is ink. Only looking at it caught
  // that. The aperture is drawn as four hairline accents instead.
  const band: RectShape = {
    x: EDGE,
    y: PLATE_TOP - 26,
    width: COLUMN,
    height: PLATE_VALUE_BASELINE - PLATE_TOP + 46,
    fill: bg,
  };

  const photo = ctx.photoDataUri
    ? {
        rect: { x: EDGE, y: APERTURE_TOP, width: COLUMN, height: APERTURE_HEIGHT, fill: bg },
        dataUri: ctx.photoDataUri,
      }
    : null;

  const accents: RectShape[] = [];
  const texts: TextRun[] = [];

  // ── The aperture's keyline. Four hairlines, never a filled rect: a filled
  // one would cover the photograph, which is the mistake `spine` shipped once
  // (a backing plate at exactly the photo's rect, hiding it completely while
  // every check stayed green).
  accents.push(
    { x: EDGE, y: APERTURE_TOP - HAIR, width: COLUMN, height: HAIR, fill: accent },
    { x: EDGE, y: APERTURE_BOTTOM, width: COLUMN, height: HAIR, fill: accent },
    { x: EDGE, y: APERTURE_TOP, width: HAIR, height: APERTURE_HEIGHT, fill: accent },
    {
      x: EDGE + COLUMN - HAIR,
      y: APERTURE_TOP,
      width: HAIR,
      height: APERTURE_HEIGHT,
      fill: accent,
    }
  );

  if (!ctx.hasPhoto) {
    // An empty aperture with a target in it — a real element in technical
    // printing, so this reads as intentional rather than as a failed image.
    accents.push(...cross(POSTER_WIDTH / 2, APERTURE_TOP + APERTURE_HEIGHT / 2, accent));
    const parts = ctx.dateParts;
    if (parts) {
      texts.push({
        text: parts.day,
        x: POSTER_WIDTH / 2,
        y: APERTURE_TOP + APERTURE_HEIGHT / 2 - 70,
        fontSize: 150,
        role: 'uiBold',
        fill: fg,
        opacity: 0.92,
        letterSpacing: -4,
        anchor: 'middle',
      });
      texts.push({
        text: `${parts.weekday} · ${parts.month} ${parts.year}`,
        x: POSTER_WIDTH / 2,
        y: APERTURE_BOTTOM - 56,
        fontSize: 28,
        role: 'ui',
        fill: fg,
        opacity: 0.7,
        letterSpacing: 8,
        anchor: 'middle',
      });
    }
  }

  // ── Running heads, one per corner. This is the family's silhouette.
  // The top-left head is the wordmark, set exactly 'SPHAER' and nothing else:
  // this family has no separate wordmark line, and every family must carry one.
  // A decorated version ('SPHAER / BERLIN') would look identical on the poster
  // and silently stop being the wordmark.
  const heads: [string, number, 'start' | 'end', number][] = [
    ['SPHAER', EDGE, 'start', HEAD_TOP_BASELINE],
    [`REF ${referenceCode(ctx.input.startsAt)}`, POSTER_WIDTH - EDGE, 'end', HEAD_TOP_BASELINE],
    ['BERLIN', EDGE, 'start', HEAD_BOTTOM_BASELINE],
    ['EVENT POSTER', POSTER_WIDTH - EDGE, 'end', HEAD_BOTTOM_BASELINE],
  ];
  for (const [text, x, anchor, y] of heads) {
    texts.push({
      text,
      x,
      y,
      fontSize: HEAD_SIZE,
      role: 'ui',
      fill: fg,
      opacity: 0.55,
      letterSpacing: 6,
      anchor,
    });
  }

  // Registration marks as a top pair. Two, not four: four fence the poster in
  // and start competing with the running heads for the same corners.
  accents.push(...cross(MARK_INSET, MARK_Y, accent));
  accents.push(...cross(POSTER_WIDTH - MARK_INSET, MARK_Y, accent));

  // ── The title, flush left, with a short accent rule above it.
  //
  // Solved UPWARD from just above the aperture, not downward from a fixed top.
  // Top-anchored, a one-line title left ~250px of dead ground between it and
  // the window — visible immediately in the render and invisible to every
  // test, since both elements were exactly where they were told to be. Anchored
  // to the aperture, a short title sits close to its window and a long one
  // grows toward the running heads. The fitter's box guarantees the block never
  // reaches them: lines × lineHeight ≤ TITLE_BOX_HEIGHT by construction.
  const titleBlockBottom = APERTURE_TOP - 84;
  const titleTop = titleBlockBottom - title.lines.length * title.lineHeight;
  accents.push({ x: EDGE, y: titleTop - 40, width: 120, height: HAIR * 2, fill: accent });
  title.lines.forEach((line, i) => {
    texts.push({
      text: line,
      x: EDGE,
      y: titleTop + title.fontSize * TITLE_ASCENT_RATIO + i * title.lineHeight,
      fontSize: title.fontSize,
      role: 'uiBold',
      fill: fg,
      opacity: 1,
      letterSpacing: -1,
    });
  });

  // ── The specification plate: three labelled fields under one rule.
  accents.push({ x: EDGE, y: PLATE_TOP - 26, width: COLUMN, height: HAIR, fill: accent });

  const parts = ctx.dateParts;
  const fields: [string, string][] = [
    ['DATE', parts ? `${parts.day} ${parts.month}` : ctx.dateLine || 'TBC'],
    ['VENUE', ctx.venueLine],
    ['TIME', parts ? parts.time : '—'],
  ];
  fields.forEach(([label, value], i) => {
    const x = EDGE + i * FIELD_WIDTH;
    texts.push({
      text: label,
      x,
      y: PLATE_LABEL_BASELINE,
      fontSize: PLATE_LABEL_SIZE,
      role: 'ui',
      fill: accent,
      opacity: 0.9,
      letterSpacing: 6,
    });
    texts.push({
      text: truncateToWidth(value, PLATE_VALUE_SIZE, 'uiBold', FIELD_WIDTH - 24),
      x,
      y: PLATE_VALUE_BASELINE,
      fontSize: PLATE_VALUE_SIZE,
      role: 'uiBold',
      fill: fg,
      opacity: 1,
      letterSpacing: 0,
    });
    // A hairline between fields, not after the last one.
    if (i < fields.length - 1) {
      accents.push({
        x: x + FIELD_WIDTH - 12,
        y: PLATE_LABEL_BASELINE - PLATE_LABEL_SIZE,
        width: HAIR,
        height: PLATE_VALUE_BASELINE - PLATE_LABEL_BASELINE + PLATE_LABEL_SIZE + 10,
        fill: accent,
      });
    }
  });

  // NOTHING goes in the foot's centre. The first version put the full date
  // line there and the poster then stated its date THREE times — in the
  // aperture, in the plate's DATE field, and again at the foot. The plate is
  // the one that belongs; the other two were repetition dressed as apparatus.

  // ── The wordmark. It LOOKS like the fourth running head and it is drawn in
  // the top-left corner with the others — but it is emitted LAST and in
  // `uiBold`, because two cross-family contracts say so: the wordmark is the
  // final text run in every family, and it is always the 700 weight
  // (GeneratedPosterCanvas.test.tsx asserts both). Setting it inline with the
  // other heads would have looked identical on the poster and quietly stopped
  // it being the wordmark — exactly the class of bug this repo keeps paying
  // for: a valid file with the wrong content.
  texts.push({
    text: 'SPHAER',
    x: EDGE,
    y: HEAD_TOP_BASELINE,
    fontSize: HEAD_SIZE,
    role: 'uiBold',
    fill: fg,
    opacity: 0.6,
    letterSpacing: 6,
  });

  return { background, photo, band, accents, texts, titleTruncated: title.truncated };
}

export const technicalFamily: PosterFamily = {
  id: 'technical',
  label: 'Dark technical',
  /**
   * DARK ONLY — palettes.md: "Near-black is definitional. Accents stay under
   * 2% coverage." Every hairline on this poster is 3px, so the accent coverage
   * is a fraction of a percent, which is the constraint met by construction
   * rather than by review.
   *
   * `acid` lives here and nowhere else: acid green on black is the one pairing
   * in the token list that looks like instrumentation instead of a costume,
   * which is exactly the complaint palettes.md raises about it turning up under
   * a Swiss grid.
   */
  palettes: ['ink', 'acid', 'aubergine', 'navy', 'teal'],
  build,
};
