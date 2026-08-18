/**
 * The Sphaer circle-cover generator — THREE landscape families, auto-filled
 * from a circle.
 *
 * The front door, exactly as `poster-template.ts` is for portrait posters, and
 * built to the same rule: this module is pure, it draws nothing, and it returns
 * a fully solved layout that two different renderers consume.
 *
 * ── What this reuses, which is nearly everything ─────────────────────────────
 * A solved cover IS a `PosterLayout`. It carries its own `width` and `height`,
 * and every consumer already reads those rather than the `POSTER_WIDTH` /
 * `POSTER_HEIGHT` constants:
 *
 *   * `posterLayoutToSvgString()` builds its viewBox from `layout.width/height`.
 *   * `assertLayoutIsPaintable()` checks the background against
 *     `layout.width/height`.
 *   * `assertPngIsPlausible(bytes, w, h)` already takes the dimensions as
 *     arguments.
 *   * `GeneratedPosterCanvas` sizes itself from the layout it is handed.
 *
 * So the renderer, the blank-poster guard and the capture hook needed NO
 * family-specific changes and no aspect-specific branches to support a second
 * aspect ratio. That was the design constraint, and it held. `buildPosterLayout`
 * is untouched — this sits alongside it rather than growing a mode flag.
 *
 * What is genuinely new lives in two places and nowhere else:
 * `src/utils/cover-metrics.ts` (the canvas, the crop-derived safe band, the
 * avatar exclusion) and `src/utils/cover-families/` (the three compositions).
 */

import type { PosterPalette } from '@/constants/poster-palette';
import {
  COVER_HEIGHT,
  COVER_WIDTH,
  coverName,
  coverSeed,
  formatCoverMetaLine,
  type CoverContext,
  type CoverInput,
  type CoverLayout,
} from '@/utils/cover-metrics';
import {
  coverFamilyForInput,
  coverFamilyShortlist,
  coverPaletteForFamily,
} from '@/utils/cover-families';

// Re-exported so `@/utils/cover-template` is the one address consumers import
// from, mirroring how `poster-template` fronts the portrait pipeline.
export {
  COVER_AVATAR_SAFE_X,
  COVER_AVATAR_SAFE_Y,
  COVER_COLUMN,
  COVER_HEIGHT,
  COVER_MARGIN,
  COVER_MAX_TITLE_LINES,
  COVER_SAFE_BOTTOM,
  COVER_SAFE_BOTTOM_Y,
  COVER_SAFE_HEIGHT,
  COVER_SAFE_TOP,
  COVER_SAFE_Y,
  COVER_WIDTH,
  coverName,
  coverSeed,
  formatCoverMetaLine,
  isUnderAvatar,
} from '@/utils/cover-metrics';
export type {
  CoverContext,
  CoverFamily,
  CoverInput,
  CoverLayout,
} from '@/utils/cover-metrics';
export {
  COVER_FAMILIES,
  coverFamilyById,
  coverFamilyForInput,
  coverFamilyShortlist,
  coverPaletteForFamily,
  coverVariantCycleLength,
} from '@/utils/cover-families';

/**
 * The fallback meta line when a circle has no tags.
 *
 * A poster always has a date to set under its title; a circle has nothing
 * guaranteed but its name. Rather than leave the kicker slot empty — which made
 * every untagged cover look like a cover with a missing field — untagged
 * circles get the word that is actually true of all of them.
 */
export const COVER_META_FALLBACK = 'A SPHAER CIRCLE';

/**
 * Solve the whole cover. Every number a renderer needs comes out of here.
 *
 * Holds the same two invariants `assertLayoutIsPaintable` enforces on posters,
 * because it is the same guard:
 *   1. `background` covers the full canvas with an opaque colour.
 *   2. `texts` always contains at least the name and the wordmark.
 */
export function buildCoverLayout(input: CoverInput): CoverLayout {
  const family = coverFamilyForInput(input);

  // ── Why the palette steps on a DIVIDED variant ─────────────────────────────
  // Both the family and the palette used to step on the raw variant, and that
  // silently made most palettes unreachable. The family is picked by
  // `variant % shortlist.length`, so a given family only comes up on variants
  // congruent to one value mod that length — 0, 3, 6, 9 … for a three-family
  // shortlist. Feeding those same numbers to the palette pick means the palette
  // index also strides by three, so a family with nine palettes cycles through
  // exactly three of them and the other six can never be shuffled to.
  //
  // Dividing instead of passing through gives "how many times has this family
  // come round", which advances by one each time the family reappears, so
  // Shuffle reaches every family × palette combination.
  //
  // Worth knowing: `poster-families` has the same latent property — its own
  // palette test walks `paletteForFamily` directly rather than going through
  // `buildPosterLayout`, so it never saw it. Left alone here deliberately;
  // changing portrait palette selection would repaint existing event posters,
  // which are captured to PNGs users have already seen.
  const shortlistLength = coverFamilyShortlist(input.tags).length;
  const variant = Math.max(0, Math.trunc(input.variant ?? 0));
  const paletteStep = Math.floor(variant / shortlistLength);

  const palette: PosterPalette = coverPaletteForFamily(coverSeed(input), family, paletteStep);

  const tagLine = formatCoverMetaLine(input.tags);

  const ctx: CoverContext = {
    input,
    palette,
    hasPhoto: !!input.photoDataUri,
    photoDataUri: input.photoDataUri ?? null,
    name: coverName(input.name),
    metaLine: tagLine || COVER_META_FALLBACK,
    hasTags: !!tagLine,
  };

  const solved = family.build(ctx);

  return {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    palette,
    family: family.id,
    ...solved,
  };
}
