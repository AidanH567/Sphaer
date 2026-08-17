/**
 * The Sphaer poster template — ONE template, auto-filled from an event.
 *
 * This module is pure. It takes the fields an event already has (title, start
 * time, venue, optionally an embedded photo) and returns a fully resolved
 * `PosterLayout`: every rect, every baseline, every font size, already solved.
 * It draws nothing. Two renderers consume the layout:
 *
 *   * `src/components/events/GeneratedPosterCanvas.tsx` — react-native-svg,
 *     what the user actually generates on device.
 *   * `posterLayoutToSvgString()` below — an SVG document, which `sharp` can
 *     rasterise in Node. That is what `scripts/qa-generate-poster.ts` uses to
 *     produce a real PNG we can look at and measure without a device.
 *
 * Two renderers over one solved layout is a deliberate trade: it means the
 * layout maths — the part that can actually be wrong — is testable in Jest and
 * verifiable pixel-by-pixel in Node, instead of only being observable by
 * squinting at a phone. The cost is that the two renderers must agree; they
 * are kept adjacent and both drive off the same `PosterLayout` fields, and
 * neither is allowed to compute a coordinate of its own.
 *
 * ── Why the layout is solved rather than flowed ──────────────────────────────
 * SVG has no text layout engine: no wrapping, no shrink-to-fit, no ellipsis.
 * Everything below (`wrapText`, `fitTitle`, `truncateToWidth`) exists because
 * an SVG `<text>` will happily run a 60-character title straight off the edge
 * of the canvas and report no error. Width is *estimated* from an average
 * character advance per font role rather than measured, because neither
 * renderer can measure text before it draws. The advances are tuned
 * conservatively (slightly wide), so the failure mode is a title that breaks
 * one word early — not one that overflows the poster.
 */

// Straight from the token module rather than through `@/constants/theme`,
// which imports `react-native` — this file has to be importable by
// scripts/qa-generate-poster.ts under plain Node. theme.ts re-exports these
// same tokens for every component that needs them.
import { posterPalette, type PosterPalette } from '@/constants/poster-palette';

// ─── Canvas ──────────────────────────────────────────────────────────────────
// 1080 × 1528 ≈ 0.707, the ISO/A-series ratio. Matches FALLBACK_ASPECT in
// useMuralLayout, so a generated poster slots into the wall at its assumed
// ratio and never forces a row to re-justify around it.
export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1528;

/** Side margin. Everything typographic lives inside this gutter. */
const MARGIN = 72;
/** Type column width. */
const COLUMN = POSTER_WIDTH - MARGIN * 2;

/**
 * Where the solid type band starts. Above it is either the photo (when the
 * event has one) or bare background with the accent marks; below it is always
 * flat, opaque colour, so the type never sits on an unpredictable photo.
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

/** Vertical room the title block may occupy. */
const TITLE_BOX_HEIGHT = TITLE_MAX_BOTTOM - TITLE_TOP;

export const MAX_TITLE_LINES = 3;
/** Tried largest-first; the first size whose wrap fits the box wins. */
const TITLE_SIZE_LADDER = [104, 88, 76, 64, 54] as const;
const TITLE_LINE_HEIGHT_RATIO = 1.06;
/** Baseline offset within a line box — roughly the cap-height of the serif. */
const TITLE_ASCENT_RATIO = 0.78;

/**
 * The accent mark drawn in the upper field when the event has no photo.
 * Bars descend and narrow, ending well clear of BAND_TOP so the staircase and
 * the type band never touch.
 */
const MARK_BAR_HEIGHT = 26;
const MARK_BARS = [
  { y: 232, widthRatio: 1 },
  { y: 396, widthRatio: 0.72 },
  { y: 560, widthRatio: 0.44 },
  { y: 724, widthRatio: 0.22 },
] as const;

const DATE_SIZE = 40;
const VENUE_SIZE = 34;
const WORDMARK_SIZE = 26;

// ─── Text metrics ────────────────────────────────────────────────────────────
/**
 * Average character advance in em, per font role. Measured by eye against the
 * seed posters and rounded UP: overestimating advance wraps a word early,
 * underestimating it runs text off the canvas. Only one of those is recoverable.
 */
const ADVANCE: Record<FontRole, number> = {
  display: 0.5, // Martina Plantijn / Georgia, regular
  uiBold: 0.56, // SF Pro / Helvetica, 700 — wider than the serif
  ui: 0.52, // SF Pro / Helvetica, 400
};

export type FontRole = 'display' | 'uiBold' | 'ui';

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

/**
 * Pick the largest ladder size whose wrap fits both the line budget and the
 * vertical box. If even the smallest size overflows, clip to MAX_TITLE_LINES
 * and ellipsise the last line — a poster with a shortened title beats a poster
 * with a title running through the date.
 */
export function fitTitle(
  title: string,
  boxWidth = COLUMN,
  boxHeight = TITLE_BOX_HEIGHT
): FittedTitle {
  const text = title.trim() || 'Untitled';

  for (const fontSize of TITLE_SIZE_LADDER) {
    const lineHeight = fontSize * TITLE_LINE_HEIGHT_RATIO;
    const lines = wrapText(text, maxCharsForWidth(boxWidth, fontSize, 'display'));
    if (lines.length <= MAX_TITLE_LINES && lines.length * lineHeight <= boxHeight) {
      return { lines, fontSize, lineHeight, truncated: false };
    }
  }

  const fontSize = TITLE_SIZE_LADDER[TITLE_SIZE_LADDER.length - 1];
  const lineHeight = fontSize * TITLE_LINE_HEIGHT_RATIO;
  const all = wrapText(text, maxCharsForWidth(boxWidth, fontSize, 'display'));
  const maxLines = Math.max(1, Math.min(MAX_TITLE_LINES, Math.floor(boxHeight / lineHeight)));
  if (all.length <= maxLines) {
    return { lines: all, fontSize, lineHeight, truncated: false };
  }
  const lines = all.slice(0, maxLines);
  const last = lines[lines.length - 1];
  lines[lines.length - 1] = `${last.replace(/\s+\S*$/, '').trimEnd() || last}…`;
  return { lines, fontSize, lineHeight, truncated: true };
}

// ─── Palette selection ───────────────────────────────────────────────────────
/**
 * FNV-1a over the seed. Deterministic and stable across JS engines (kept in
 * unsigned 32-bit range via `>>> 0`), so a poster regenerated on iOS, Android,
 * web, or in the Node QA script picks the same colours every time.
 */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function paletteForSeed(seed: string): PosterPalette {
  return posterPalette[hashSeed(seed) % posterPalette.length];
}

// ─── Date / time line ────────────────────────────────────────────────────────
/**
 * "SAT 30 MAY · 18:00–23:00" — the poster's own date format. Deliberately not
 * reusing src/utils/date.ts: those formats are tuned for a 13pt card label,
 * and this is 40px display metadata on a poster. Uppercase en-GB so it reads
 * as poster typography rather than UI chrome.
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

// ─── Layout ──────────────────────────────────────────────────────────────────

export interface PosterInput {
  title: string;
  startsAt: string;
  endsAt?: string | null;
  locationName?: string | null;
  address?: string | null;
  /**
   * Optional full-bleed photo, as a `data:image/...;base64,…` URI. A remote
   * URL will NOT work: on web the layout is rasterised by drawing the SVG into
   * a canvas, and browsers refuse to load external resources referenced from
   * an SVG-as-image (and would taint the canvas even if they did). Data URI or
   * nothing.
   */
  photoDataUri?: string | null;
}

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
  /** Full-bleed opaque background. Always first, always the whole canvas. */
  background: RectShape;
  /** Where the photo goes when there is one. */
  photo: { rect: RectShape; dataUri: string } | null;
  /** Solid band the type sits on, painted over the photo. */
  band: RectShape;
  /** Accent marks — the rule above the title, plus the upper block when there is no photo. */
  accents: RectShape[];
  texts: TextRun[];
  /** True if the title had to be shortened — surfaced so the UI can say so. */
  titleTruncated: boolean;
}

/**
 * Solve the whole poster. Every number a renderer needs comes out of here.
 *
 * Invariants two tests hold this to, because they are what stops the blank-
 * poster failure from ever being generated in the first place:
 *   1. `background` covers the full canvas with an opaque colour.
 *   2. `texts` always contains at least the title and the wordmark.
 */
export function buildPosterLayout(input: PosterInput): PosterLayout {
  const palette = paletteForSeed(`${input.title}|${input.startsAt}`);
  const { bg, fg, accent } = palette;

  const hasPhoto = !!input.photoDataUri;
  const title = fitTitle(input.title);

  const background: RectShape = {
    x: 0,
    y: 0,
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    fill: bg,
  };

  const photo = input.photoDataUri
    ? {
        rect: { x: 0, y: 0, width: POSTER_WIDTH, height: BAND_TOP, fill: bg },
        dataUri: input.photoDataUri,
      }
    : null;

  const band: RectShape = {
    x: 0,
    y: BAND_TOP,
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT - BAND_TOP,
    fill: bg,
  };

  const accents: RectShape[] = [
    { x: MARGIN, y: RULE_Y, width: RULE_WIDTH, height: RULE_HEIGHT, fill: accent },
  ];
  if (!hasPhoto) {
    // No photo means the top 56% would otherwise be an empty field of colour.
    // A descending staircase of bars turns that into deliberate composition
    // rather than dead space — and gives the eye something at mural thumbnail
    // size, where the title is barely legible anyway.
    //
    // Two bars clustered at the top was the first attempt and it looked wrong:
    // it left ~600px of nothing between them and the type band, so the poster
    // read as an accident rather than a layout. The bars are spread down the
    // field instead, narrowing as they go, so the weight leads the eye into
    // the title. Deterministic — no per-event variation, because template
    // choice is explicitly out of scope for v1.
    MARK_BARS.forEach(({ y, widthRatio }) => {
      accents.push({
        x: MARGIN,
        y,
        width: Math.round(COLUMN * widthRatio),
        height: MARK_BAR_HEIGHT,
        fill: accent,
      });
    });
  }

  const texts: TextRun[] = [];

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

  const dateLine = formatPosterDateLine(input.startsAt, input.endsAt);
  if (dateLine) {
    texts.push({
      text: truncateToWidth(dateLine, DATE_SIZE, 'uiBold', COLUMN),
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
    text: truncateToWidth(
      formatPosterVenueLine(input.locationName, input.address),
      VENUE_SIZE,
      'ui',
      COLUMN
    ),
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

  return {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    palette,
    background,
    photo,
    band,
    accents,
    texts,
    titleTruncated: title.truncated,
  };
}

// ─── SVG document renderer (Node / QA only) ──────────────────────────────────

/** Font stacks for the string renderer. Must exist on a plain machine. */
const SVG_FONT_STACK: Record<FontRole, { family: string; weight: number }> = {
  display: { family: "Georgia, 'Times New Roman', serif", weight: 400 },
  uiBold: { family: 'Helvetica, Arial, sans-serif', weight: 700 },
  ui: { family: 'Helvetica, Arial, sans-serif', weight: 400 },
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rectToSvg(r: RectShape): string {
  return `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${r.fill}"/>`;
}

/**
 * Render a solved layout as a standalone SVG document. Used by
 * `scripts/qa-generate-poster.ts` (sharp → PNG) and by the layout tests. The
 * on-device renderer is the react-native-svg component, not this.
 */
export function posterLayoutToSvgString(layout: PosterLayout): string {
  const parts: string[] = [];
  parts.push(rectToSvg(layout.background));
  if (layout.photo) {
    const { rect, dataUri } = layout.photo;
    parts.push(
      `<image x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" ` +
        `preserveAspectRatio="xMidYMid slice" href="${dataUri}"/>`
    );
  }
  parts.push(rectToSvg(layout.band));
  for (const a of layout.accents) parts.push(rectToSvg(a));
  for (const t of layout.texts) {
    const font = SVG_FONT_STACK[t.role];
    parts.push(
      `<text x="${t.x}" y="${t.y}" font-family="${font.family}" font-weight="${font.weight}" ` +
        `font-size="${t.fontSize}" fill="${t.fill}" opacity="${t.opacity}" ` +
        `letter-spacing="${t.letterSpacing}" xml:space="preserve">${escapeXml(t.text)}</text>`
    );
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}">\n` +
    parts.join('\n') +
    `\n</svg>`
  );
}
