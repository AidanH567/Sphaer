/**
 * The cover family registry — which composition a circle gets, and in which
 * colours. The landscape twin of `poster-families/index.ts`, and deliberately
 * a SEPARATE registry rather than a flag on the poster one.
 *
 * ── Why separate, and why only three ─────────────────────────────────────────
 * The four poster families were designed for a 1080 × 1528 portrait canvas.
 * Three of them can be genuinely re-thought for a 1440 × 810 banner. One cannot,
 * and shipping four with one stretched would be worse than shipping three:
 *
 *   `classic` → `marquee`   photo-above/band-below cannot survive 530 usable
 *                           pixels of height, so its SKELETON was dropped and
 *                           its typography kept, on a centred axis.
 *   `block`   → `ribbon`    the horizontal two-block turns ninety degrees into
 *                           a vertical split, which is the natural banner form.
 *   `panel`   → `plate`     adapts almost directly; the plate moves off centre
 *                           to clear the circle avatar.
 *   `spine`   → DROPPED.    See below.
 *
 * ── Why `spine` is not here ──────────────────────────────────────────────────
 * `spine` sets the title vertically up the left edge, and its run length is
 * `POSTER_HEIGHT - MARGIN * 2` = 1384px, which is what lets it set type at
 * 156px. On a cover the vertical run is 810 - 160 = 650px, and inside the crop
 * only 530. Its ladder bottoms out at 62px, and at 62px roughly seventeen
 * characters fit in a column — so a real circle name would need two or three
 * columns, eating 400px of a 1440px canvas to say something nobody can read at
 * 160pt display height.
 *
 * The deeper objection is that the ARGUMENT for spine inverts. It earns its
 * place on the Mural because at ~120px wide a vertical bar of type is still a
 * recognisable silhouette where horizontal type is mush. That is a claim about
 * a TALL, NARROW frame. On a wide, short one the silhouette argument runs the
 * other way, and the only way to make spine work would be to rotate the title
 * back to horizontal — at which point it is not spine, it is `marquee` with
 * extra steps.
 *
 * ── Determinism ──────────────────────────────────────────────────────────────
 * Everything below is a pure function of (name, tags, variant), exactly as on
 * the poster side, so a circle regenerates the same cover on every platform.
 */

import { posterPalette, posterPaletteById, type PosterPalette } from '@/constants/poster-palette';
import { hashSeed } from '@/utils/poster-metrics';
import { coverSeed, type CoverFamily, type CoverInput } from '@/utils/cover-metrics';
import { marqueeFamily } from './marquee';
import { plateFamily } from './plate';
import { ribbonFamily } from './ribbon';

export const COVER_FAMILIES: readonly CoverFamily[] = [marqueeFamily, ribbonFamily, plateFamily];

const BY_ID = new Map(COVER_FAMILIES.map((f) => [f.id, f]));

export function coverFamilyById(id: string): CoverFamily | undefined {
  return BY_ID.get(id);
}

/**
 * Tag → family shortlist. Keys are the strings in `src/constants/categories.ts`,
 * matched case-insensitively — circles tag themselves from `EVENT_CATEGORIES`,
 * the same vocabulary events use, which is why no schema change was needed to
 * make this work.
 *
 * The pairings follow the poster registry's logic: `ribbon` is structural and
 * loud so it takes the music and film circles, `plate` goes where a circle most
 * likely brought a photograph, `marquee` holds the ones where the name genuinely
 * is the whole identity.
 */
const TAG_FAMILIES: Record<string, readonly string[]> = {
  music: ['ribbon', 'plate'],
  concert: ['ribbon', 'marquee'],
  film: ['plate', 'ribbon'],
  photography: ['plate', 'marquee'],
  art: ['plate', 'marquee'],
  design: ['ribbon', 'marquee'],
  architecture: ['ribbon', 'plate'],
  fashion: ['plate', 'ribbon'],
  dance: ['plate', 'ribbon'],
  theater: ['marquee', 'plate'],
  literature: ['marquee', 'ribbon'],
  food: ['plate', 'ribbon'],
  tech: ['marquee', 'ribbon'],
  activism: ['ribbon', 'marquee'],
  community: ['marquee', 'plate'],
  workshop: ['ribbon', 'marquee'],
  wellness: ['marquee', 'plate'],
  therapy: ['marquee', 'ribbon'],
  coach: ['marquee', 'ribbon'],
  talk: ['marquee', 'ribbon'],
  education: ['marquee', 'ribbon'],
  meet: ['marquee', 'plate'],
  job: ['marquee', 'ribbon'],
  service: ['marquee', 'ribbon'],
  'social movements': ['ribbon', 'marquee'],
};

const ALL_IDS = COVER_FAMILIES.map((f) => f.id);

/** The shortlist for a circle's tags — first recognised tag wins. */
export function coverFamilyShortlist(tags?: readonly string[] | null): readonly string[] {
  if (tags) {
    for (const raw of tags) {
      const key = raw?.trim().toLowerCase();
      if (key && TAG_FAMILIES[key]) return TAG_FAMILIES[key];
    }
  }
  return ALL_IDS;
}

/** Pick the family. `variant` steps through the shortlist — that is Shuffle. */
export function coverFamilyForInput(input: CoverInput): CoverFamily {
  const shortlist = coverFamilyShortlist(input.tags);
  const variant = Math.max(0, Math.trunc(input.variant ?? 0));
  const index = (hashSeed(coverSeed(input)) + variant) % shortlist.length;
  return coverFamilyById(shortlist[index]) ?? marqueeFamily;
}

/**
 * Pick the palette from the subset this family can carry. Salted separately
 * from the family hash for the reason given on the poster side: so shuffling to
 * a new family also moves the colour instead of recolouring the same geometry
 * and looking like nothing happened.
 */
export function coverPaletteForFamily(
  seed: string,
  family: CoverFamily,
  variant = 0
): PosterPalette {
  const allowed = family.palettes
    .map((id) => posterPaletteById(id))
    .filter((p): p is PosterPalette => !!p);
  const pool = allowed.length > 0 ? allowed : posterPalette.slice();
  const step = Math.max(0, Math.trunc(variant));
  const index = (hashSeed(`${seed}#cover#${family.id}`) + step) % pool.length;
  return pool[index];
}

/**
 * How many distinct covers Shuffle reaches before it repeats.
 *
 * The family advances every variant and each family's palette advances once
 * per full pass through the shortlist (see the note in `buildCoverLayout`), so
 * the cycle is the shortlist length times the LCM of the palette counts — not
 * the LCM of everything together, which is what it was before the palette step
 * was decoupled and which over-reported by claiming combinations Shuffle could
 * not actually reach.
 */
export function coverVariantCycleLength(input: CoverInput): number {
  const shortlist = coverFamilyShortlist(input.tags);
  const sizes = shortlist.map((id) => coverFamilyById(id)?.palettes.length ?? 1);
  return shortlist.length * sizes.reduce((acc, n) => lcm(acc, n), 1);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}
