/**
 * Shared measuring tape for every poster family.
 *
 * This module knows how to FIT things — wrap a title, shrink it down a ladder,
 * truncate a venue line, hash a seed, measure a rotated text run's bounding box.
 * It knows nothing about any particular composition. Families
 * (`src/utils/poster-families/`) import from here; this file imports from none
 * of them, which is what keeps the registry free of cycles.
 *
 * It is deliberately dependency-free (no `react-native`, no `@/constants/theme`)
 * for the same reason `poster-palette.ts` is: `scripts/qa-generate-poster.ts`
 * has to import the whole layout pipeline under plain Node, and anything that
 * reaches `react-native` is Flow-typed source that esbuild refuses to parse.
 *
 * ── Why width is estimated rather than measured ──────────────────────────────
 * SVG has no text layout engine: no wrapping, no shrink-to-fit, no ellipsis, and
 * no way to ask how wide a string will be before it is drawn. Neither renderer
 * can measure. So every advance below is an average per font role, tuned
 * conservatively WIDE — the failure mode is a title that breaks one word early,
 * never one that runs off the canvas. Only one of those is recoverable.
 */

import { posterPalette, type PosterPalette } from '@/constants/poster-palette';

// ─── Canvas ──────────────────────────────────────────────────────────────────
// 1080 × 1528 ≈ 0.707, the ISO/A-series ratio. Matches FALLBACK_ASPECT in
// useMuralLayout, so a generated poster slots into the wall at its assumed
// ratio and never forces a row to re-justify around it.
export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1528;

/** Side margin. Most typographic content lives inside this gutter. */
export const MARGIN = 72;
/** Default type column width. */
export const COLUMN = POSTER_WIDTH - MARGIN * 2;

export const MAX_TITLE_LINES = 3;

// ─── Text metrics ────────────────────────────────────────────────────────────

export type FontRole = 'display' | 'uiBold' | 'ui';

/**
 * Average character advance in em, per font role. Measured by eye against the
 * seed posters and rounded UP — see the module note on why this is estimated.
 */
const ADVANCE: Record<FontRole, number> = {
  display: 0.5, // Martina Plantijn / Georgia, regular
  uiBold: 0.56, // SF Pro / Helvetica, 700 — wider than the serif
  ui: 0.52, // SF Pro / Helvetica, 400
};

/** Estimated rendered width of `text` in px. */
export function estimateTextWidth(text: string, fontSize: number, role: FontRole): number {
  return text.length * fontSize * ADVANCE[role];
}

/** How many characters of `role` at `fontSize` fit in `width` px. */
export function maxCharsForWidth(width: number, fontSize: number, role: FontRole): number {
  return Math.max(1, Math.floor(width / (fontSize * ADVANCE[role])));
}

/**
 * Greedy word wrap to a character budget. Words longer than the budget are
 * hard-split rather than allowed to overhang — a 40-character German compound
 * noun is a real event title, not a hypothetical.
 */
export function wrapText(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxChars) {
      // Flush what we have, then chop the oversized word into full-width pieces.
      if (current) {
        lines.push(current);
        current = '';
      }
      let rest = word;
      while (rest.length > maxChars) {
        lines.push(rest.slice(0, maxChars));
        rest = rest.slice(maxChars);
      }
      current = rest;
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Largest size from `ladder` at which `text` fits `maxWidth` on ONE line.
 *
 * For the short, unwrappable strings a family sets as a graphic element — a
 * numeric date, a time, a day number — where truncating is far worse than
 * shrinking. `spine` needs it because its right-hand field is not a fixed
 * width: a three-line title makes the spine thicker and the field ~80px
 * narrower, which is exactly how "30.10.2026" became "30.10.2…" on the first
 * contact sheet while every test stayed green.
 *
 * Falls back to the smallest size on the ladder, so the caller still has to
 * truncate if even that overflows.
 */
export function fitSingleLine(
  text: string,
  ladder: readonly number[],
  role: FontRole,
  maxWidth: number
): number {
  for (const size of ladder) {
    if (estimateTextWidth(text, size, role) <= maxWidth) return size;
  }
  return ladder[ladder.length - 1];
}

/** Cut `text` to fit `width`, appending "…" when anything was dropped. */
export function truncateToWidth(
  text: string,
  fontSize: number,
  role: FontRole,
  width: number
): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const budget = maxCharsForWidth(width, fontSize, role);
  if (trimmed.length <= budget) return trimmed;
  if (budget <= 1) return '…';
  return `${trimmed.slice(0, budget - 1).trimEnd()}…`;
}

export interface FittedTitle {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  /** True when the title had to be clipped to MAX_TITLE_LINES. */
  truncated: boolean;
}

export interface FitTitleOptions {
  boxWidth: number;
  boxHeight: number;
  /** Tried largest-first; the first size whose wrap fits the box wins. */
  ladder: readonly number[];
  role?: FontRole;
  lineHeightRatio?: number;
  maxLines?: number;
}

/**
 * Pick the largest ladder size whose wrap fits both the line budget and the
 * vertical box. If even the smallest size overflows, clip and ellipsise the last
 * line — a poster with a shortened title beats a poster with a title running
 * through the date.
 *
 * Every family calls this with its own box, ladder and face, which is precisely
 * what lets a 132px grotesque block and a 150px vertical spine share one fitter.
 */
export function fitTitleIn(title: string, opts: FitTitleOptions): FittedTitle {
  const text = title.trim() || 'Untitled';
  const role = opts.role ?? 'display';
  const ratio = opts.lineHeightRatio ?? 1.06;
  const maxLines = opts.maxLines ?? MAX_TITLE_LINES;

  for (const fontSize of opts.ladder) {
    const lineHeight = fontSize * ratio;
    const lines = wrapText(text, maxCharsForWidth(opts.boxWidth, fontSize, role));
    if (lines.length <= maxLines && lines.length * lineHeight <= opts.boxHeight) {
      return { lines, fontSize, lineHeight, truncated: false };
    }
  }

  const fontSize = opts.ladder[opts.ladder.length - 1];
  const lineHeight = fontSize * ratio;
  const all = wrapText(text, maxCharsForWidth(opts.boxWidth, fontSize, role));
  const roomForLines = Math.max(1, Math.min(maxLines, Math.floor(opts.boxHeight / lineHeight)));
  if (all.length <= roomForLines) {
    return { lines: all, fontSize, lineHeight, truncated: false };
  }
  const lines = all.slice(0, roomForLines);
  const last = lines[lines.length - 1];
  lines[lines.length - 1] = `${last.replace(/\s+\S*$/, '').trimEnd() || last}…`;
  return { lines, fontSize, lineHeight, truncated: true };
}

// ─── Hashing ─────────────────────────────────────────────────────────────────
/**
 * FNV-1a over the seed. Deterministic and stable across JS engines (kept in
 * unsigned 32-bit range via `>>> 0`), so a poster regenerated on iOS, Android,
 * web, or in the Node QA script picks the same family and colours every time.
 */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The unconstrained palette pick, kept because it is the published helper and
 * is what `posterPalette` is indexed by elsewhere. `buildPosterLayout` does NOT
 * use it — see `paletteForFamily` in the registry, which draws from the subset a
 * family can actually carry.
 */
export function paletteForSeed(seed: string): PosterPalette {
  return posterPalette[hashSeed(seed) % posterPalette.length];
}

// ─── Date / venue lines ──────────────────────────────────────────────────────
/**
 * "SAT 30 MAY · 18:00–23:00" — the poster's own date format. Deliberately not
 * reusing src/utils/date.ts: those formats are tuned for a 13pt card label, and
 * this is 40px display metadata on a poster.
 */
export function formatPosterDateLine(startsAt: string, endsAt?: string | null): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return '';

  const weekday = start.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
  const day = start.toLocaleDateString('en-GB', { day: 'numeric' });
  const month = start.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
  const time = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  let timePart = time;
  if (endsAt) {
    const end = new Date(endsAt);
    if (!Number.isNaN(end.getTime())) {
      timePart = `${time}–${end.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
  }
  return `${weekday} ${day} ${month} · ${timePart}`;
}

/**
 * The date split into oversized display parts, for the families that set the
 * date as a graphic element rather than a caption — `spine` runs "22" at 260px
 * up the right field, `classic` fills its whole upper block with it.
 *
 * Returns null for an unparseable start, so a family can drop the block instead
 * of painting "NaN".
 */
export interface PosterDateParts {
  /** "12" — day of month, no leading zero. */
  day: string;
  /** "SEPT" */
  month: string;
  /** "SAT" */
  weekday: string;
  /** "22:00" */
  time: string;
  /** "2026" */
  year: string;
}

export function posterDateParts(startsAt: string): PosterDateParts | null {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  return {
    day: start.toLocaleDateString('en-GB', { day: 'numeric' }),
    month: start.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
    weekday: start.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase(),
    time: start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    year: String(start.getFullYear()),
  };
}

/** Venue line: prefer the named venue, fall back to the address, else Berlin. */
export function formatPosterVenueLine(
  locationName?: string | null,
  address?: string | null
): string {
  const name = locationName?.trim();
  if (name) return name;
  const addr = address?.trim();
  if (addr) return addr;
  return 'Berlin';
}

// ─── Layout vocabulary ───────────────────────────────────────────────────────
/**
 * The primitives a renderer must be able to draw. This is the whole vocabulary:
 * opaque rects, one optionally-placed image, and text runs that may be rotated
 * and may be anchored from either end.
 *
 * `rotate` and `anchor` are the ONLY additions the family work needed, and they
 * were added once, to both renderers. Everything a family does — a Swiss two-
 * block, a vertical spine, a panel floating on a full-bleed photograph — is
 * expressed by choosing different numbers for these same fields. That is the
 * point of the registry: a fifth family is a new file, not a renderer change.
 */
export interface TextRun {
  text: string;
  x: number;
  /** Baseline y, not box top — SVG `<text y>` semantics. */
  y: number;
  fontSize: number;
  role: FontRole;
  fill: string;
  opacity: number;
  letterSpacing: number;
  /**
   * Degrees clockwise about (x, y). -90 runs the text upward, which is how the
   * `spine` family sets a title up the left edge. Omitted means 0.
   */
  rotate?: number;
  /** SVG text-anchor. Omitted means 'start'. */
  anchor?: 'start' | 'middle' | 'end';
}

export interface RectShape {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

export interface PosterLayout {
  width: number;
  height: number;
  palette: PosterPalette;
  /** Which family solved this poster. Additive — nothing existing reads it. */
  family: string;
  /** Full-bleed opaque background. Always first, always the whole canvas. */
  background: RectShape;
  /** Where the photo goes when there is one. Any rect, not just the top strip. */
  photo: { rect: RectShape; dataUri: string } | null;
  /**
   * The solid block the type sits on, painted over the photo. Families use this
   * differently — `classic` a bottom band, `block` the upper colour block,
   * `panel` the inset panel — but it is always drawn after the photo and before
   * the accents, so a family that wants type on flat colour puts it here.
   */
  band: RectShape;
  /** Everything else geometric, drawn over the band in order. */
  accents: RectShape[];
  texts: TextRun[];
  /** True if the title had to be shortened — surfaced so the UI can say so. */
  titleTruncated: boolean;
}

/**
 * Axis-aligned bounding box of a text run, accounting for anchor and rotation.
 *
 * Exists because "does this run fit on the canvas?" stopped being
 * `x + width <= POSTER_WIDTH` the moment a family could rotate type. The spine
 * family's title has an x near the left edge and a width of 1300px running
 * UPWARD; the naive check calls that an overflow and is wrong. The rotated-
 * bounds test in poster-template.test.ts is the only thing standing between a
 * new family and type running silently off the edge, so it measures what is
 * actually painted.
 *
 * Only the right angles are handled exactly (0 / ±90 / 180); anything else
 * falls back to the rotated corner hull, which is correct but looser.
 */
export function textRunBounds(t: TextRun): { x: number; y: number; width: number; height: number } {
  const w = estimateTextWidth(t.text, t.fontSize, t.role);
  // Cap height above the baseline, plus a descender below it. Approximate, and
  // deliberately generous on the ascent side.
  const ascent = t.fontSize * 0.78;
  const descent = t.fontSize * 0.22;

  const anchor = t.anchor ?? 'start';
  const x0 = anchor === 'end' ? -w : anchor === 'middle' ? -w / 2 : 0;
  // Corners of the unrotated box, relative to the run's (x, y) anchor point.
  const corners: [number, number][] = [
    [x0, -ascent],
    [x0 + w, -ascent],
    [x0 + w, descent],
    [x0, descent],
  ];

  const rad = ((t.rotate ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [cx, cy] of corners) {
    const rx = t.x + cx * cos - cy * sin;
    const ry = t.y + cx * sin + cy * cos;
    minX = Math.min(minX, rx);
    maxX = Math.max(maxX, rx);
    minY = Math.min(minY, ry);
    maxY = Math.max(maxY, ry);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ─── What a family is ────────────────────────────────────────────────────────

export interface PosterInput {
  title: string;
  startsAt: string;
  endsAt?: string | null;
  locationName?: string | null;
  address?: string | null;
  /**
   * Optional photo, as a `data:image/...;base64,…` URI. A remote URL will NOT
   * work: on web the layout is rasterised by drawing the SVG into a canvas, and
   * browsers refuse to load external resources referenced from an SVG-as-image
   * (and would taint the canvas even if they did). Data URI or nothing.
   */
  photoDataUri?: string | null;
  /**
   * The event's categories, straight off the create form. The FIRST one the
   * registry recognises picks the family shortlist — a club night and an
   * exhibition should not reach for the same geometry. Unknown or absent falls
   * back to the full set of families.
   */
  categories?: readonly string[] | null;
  /**
   * Shuffle counter. 0 (or absent) is the event's canonical poster and is what
   * regenerating the same event must always produce. Each increment steps to
   * the next family/palette combination. Held by the caller, never persisted —
   * whatever the user shuffled to is captured as a PNG, and the PNG is the
   * artefact.
   */
  variant?: number;
}

/** Everything a family gets handed. Pre-resolved so no family re-derives it. */
export interface FamilyContext {
  input: PosterInput;
  palette: PosterPalette;
  hasPhoto: boolean;
  photoDataUri: string | null;
  dateLine: string;
  dateParts: PosterDateParts | null;
  venueLine: string;
}

/** What a family returns — the layout minus the fields the registry fills in. */
export type FamilyResult = Omit<PosterLayout, 'width' | 'height' | 'palette' | 'family'>;

export interface PosterFamily {
  id: string;
  /** Human label, for the QA contact sheet and any future picker UI. */
  label: string;
  /** Palette ids this family is allowed to use. See poster-palette.ts. */
  palettes: readonly string[];
  build(ctx: FamilyContext): FamilyResult;
}
