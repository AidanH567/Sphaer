/**
 * The cover canvas — the landscape sibling of the poster canvas.
 *
 * A circle with no `cover_url` is as blank as an event with no poster, and the
 * generator that fixes the second can fix the first. What it cannot do is fix
 * it by changing the viewBox: a banner is not a small poster, and the three
 * numbers below are the reason.
 *
 * This module is the cover's measuring tape and vocabulary. It owns no
 * composition — the families in `src/utils/cover-families/` do — and it
 * deliberately re-exports nothing from `poster-metrics`, which stays the
 * portrait address. It imports the shared FITTERS from there (wrapping,
 * truncation, hashing are aspect-agnostic) and adds only what the aspect needs.
 *
 * Dependency-free for the same reason `poster-metrics` is: the QA script has to
 * import the whole pipeline under plain Node, and anything reaching
 * `react-native` is Flow-typed source esbuild refuses to parse.
 *
 * ── Why 1440 × 810 ───────────────────────────────────────────────────────────
 * 16:9, matching what the circle create/edit screens already crop to
 * (`aspect: [16, 9]` in both pickers) and already preview at
 * (`aspectRatio: 16 / 9`). A generated cover therefore previews identically to
 * a picked photo, and neither screen needs a special case.
 *
 * It also sits inside `useMuralLayout`'s `MAX_ASPECT` of 1.9. Circles are NOT
 * on the Mural today — that is worth saying plainly rather than implying — but
 * a 2.5:1 banner would be clamped if they ever arrive, and 1.78 will not be.
 *
 * ── The crop, which is the whole design constraint ───────────────────────────
 * `app/(tabs)/circles/[id].tsx` renders the cover at `width: '100%',
 * height: 160` with `contentFit="cover"`. That is not 16:9. It is:
 *
 *     393pt iPhone → 393/160 ≈ 2.46:1
 *     430pt Pro Max → 430/160 ≈ 2.69:1
 *
 * A 16:9 source in a 2.46:1 box fills on width and overflows on height, so the
 * visible fraction is 1.778/2.46 = 0.724 — 27.6% of the canvas is cropped, half
 * off each edge. At 2.69:1 it is 33.9%. In canvas pixels that is 112px per edge
 * on the narrow phone and 137px on the wide one.
 *
 * So `COVER_SAFE_TOP/BOTTOM` is 140: everything load-bearing lives in
 * y ∈ [140, 670], and the outer bands are for ground colour only. A family that
 * puts its wordmark at `height - 60`, the way every poster family does, puts it
 * outside the frame on a Pro Max.
 *
 * ── The avatar, which is the other one ───────────────────────────────────────
 * The same screen hangs a 90pt avatar over the banner at `left: 16, bottom:
 * -45`, so the bottom-left corner is permanently occluded. Mapped onto the
 * canvas that is roughly x < 400, y > 530 — a hole no portrait family has to
 * think about, and the reason none of the three compositions below anchors
 * anything to bottom-left, which is exactly where a poster would put it.
 */

import { posterPalette, type PosterPalette } from '@/constants/poster-palette';
import type { FamilyResult, PosterLayout } from '@/utils/poster-metrics';

// ─── Canvas ──────────────────────────────────────────────────────────────────

/** 1440 × 810 = 16:9. See the module note for why this ratio and not 2.5:1. */
export const COVER_WIDTH = 1440;
export const COVER_HEIGHT = 810;

/** Side margin. Wider than the poster's 72 — a long line needs a longer rest. */
export const COVER_MARGIN = 80;

/**
 * Vertical crop taken off EACH edge by the circle detail screen at its widest.
 * Derived, not chosen: 137px at 2.69:1, rounded up to 140.
 */
export const COVER_SAFE_TOP = 140;
export const COVER_SAFE_BOTTOM = 140;

/** Top and bottom of the band that is actually on screen on every phone. */
export const COVER_SAFE_Y = COVER_SAFE_TOP;
export const COVER_SAFE_BOTTOM_Y = COVER_HEIGHT - COVER_SAFE_BOTTOM;
export const COVER_SAFE_HEIGHT = COVER_SAFE_BOTTOM_Y - COVER_SAFE_Y;

/** Type column, inside both margins. */
export const COVER_COLUMN = COVER_WIDTH - COVER_MARGIN * 2;

/**
 * The bottom-left block the overlapping 90pt avatar covers. Nothing readable
 * may be placed left of X and below Y at the same time.
 */
export const COVER_AVATAR_SAFE_X = 400;
export const COVER_AVATAR_SAFE_Y = 530;

/**
 * Two, not three. The safe band is 530px tall and has to carry a name, a meta
 * line and a wordmark; a third title line at any legible size pushes the meta
 * into the cropped zone. A portrait poster has 1528px and can afford three.
 */
export const COVER_MAX_TITLE_LINES = 2;

/** True when (x, y) falls in the corner the circle avatar sits over. */
export function isUnderAvatar(x: number, y: number): boolean {
  return x < COVER_AVATAR_SAFE_X && y > COVER_AVATAR_SAFE_Y;
}

// ─── What a cover is made from ───────────────────────────────────────────────

/**
 * A circle, reduced to what a cover can be solved from.
 *
 * Everything here already exists on the `circles` row — `name`, `description`,
 * `tags`. No schema change, and none is needed: `tags` is drawn from
 * `EVENT_CATEGORIES`, the same vocabulary the poster families already map to
 * compositions, so a circle tagged Music reaches the same shortlist logic an
 * event tagged Music does.
 */
export interface CoverInput {
  /** The circle's name. The one field guaranteed to exist. */
  name: string;
  /** `circles.description` — used as a subtitle when it is short enough. */
  description?: string | null;
  /** `circles.tags` — picks the family shortlist and the palette subset. */
  tags?: readonly string[] | null;
  /**
   * Optional photo as a `data:image/...;base64,…` URI. A remote URL will not
   * work, for the same reason it does not on posters — see `PosterInput`.
   */
  photoDataUri?: string | null;
  /** Shuffle counter. 0 is the circle's canonical cover. */
  variant?: number;
}

/** Everything a cover family gets handed, pre-resolved. */
export interface CoverContext {
  input: CoverInput;
  palette: PosterPalette;
  hasPhoto: boolean;
  photoDataUri: string | null;
  /** The name, trimmed, never empty. */
  name: string;
  /**
   * The small line under the name. A circle has no date, which is the single
   * biggest difference from a poster: every portrait family leans on an
   * oversized day/month as its graphic anchor, and there is nothing to put
   * there. This is the tag list, or a fallback.
   */
  metaLine: string;
  /** True when the meta line came from real tags rather than the fallback. */
  hasTags: boolean;
}

export interface CoverFamily {
  id: string;
  /** Human label, for the QA contact sheet. */
  label: string;
  /** Palette ids this family can carry. */
  palettes: readonly string[];
  build(ctx: CoverContext): FamilyResult;
}

/** A solved cover is a `PosterLayout` at cover dimensions — same vocabulary. */
export type CoverLayout = PosterLayout;

// ─── Text derived from a circle ──────────────────────────────────────────────

/**
 * "MUSIC · ART" — the tags, uppercased, joined with a middot.
 *
 * Capped at three because the meta line is set at display weight and a circle
 * may legitimately carry a dozen tags; the fourth onward would truncate mid-word
 * and read as damage rather than as a list.
 */
export function formatCoverMetaLine(tags?: readonly string[] | null): string {
  const clean = (tags ?? [])
    .map((t) => t?.trim())
    .filter((t): t is string => !!t)
    .slice(0, 3)
    .map((t) => t.toUpperCase());
  return clean.join(' · ');
}

/**
 * The name, trimmed, with a fallback that is a real word rather than an error.
 * A blank name still has to produce a paintable cover — `assertLayoutIsPaintable`
 * requires two visible text runs, and "" is not one.
 */
export function coverName(name: string): string {
  return name.trim() || 'Untitled circle';
}

/** The seed every deterministic choice is made from. */
export function coverSeed(input: CoverInput): string {
  return `${coverName(input.name)}|${(input.tags ?? []).join(',')}`;
}

/** The unconstrained palette pick — kept for parity with the poster side. */
export function coverPaletteForSeed(seed: string, hash: (s: string) => number): PosterPalette {
  return posterPalette[hash(seed) % posterPalette.length];
}
