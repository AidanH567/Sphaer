/**
 * The poster family registry — which composition an event gets, and in which
 * colours.
 *
 * Adding a family is: write the file, import it, put it in `POSTER_FAMILIES`,
 * and give it a slot in `CATEGORY_FAMILIES`. Nothing else changes — not the
 * on-device renderer, not the Node SVG renderer, not the guard, not the hook.
 * That is the property the whole refactor exists to buy.
 *
 * ── Selection: category first, then hash ─────────────────────────────────────
 * A club night and an exhibition should not reach for the same geometry, so the
 * event's first recognised category picks a SHORTLIST of families rather than a
 * single one, and the hash picks within it. Shortlists, not single families,
 * because mapping Music → spine would mean every gig poster in Berlin shares
 * one composition, which is the original complaint with extra steps.
 *
 * ── Determinism ──────────────────────────────────────────────────────────────
 * Everything below is a pure function of (title, startsAt, categories, variant).
 * The same event regenerates to the same poster on iOS, Android, web and in the
 * Node QA script, forever — which matters because the poster is captured to a
 * PNG and uploaded, and a user who regenerates expects what they saw.
 *
 * ── The palette collision ────────────────────────────────────────────────────
 * Aidan saw four sample posters land on two palettes. Two things were wrong and
 * one thing is unfixable:
 *
 *   * The palette hash was the SAME hash that picks everything else, so a
 *     collision was total. It is now salted separately — two events that draw
 *     the same pair will still almost always draw different geometry.
 *   * Every palette was available to the one composition. Families now declare
 *     the subset they can carry, so the pair is chosen from a set that suits
 *     the poster instead of from all eleven.
 *   * What cannot be fixed: two independent events CAN still draw the same
 *     pair. The pick has to stay a pure function of the event — there is no
 *     global "what did the last poster use" to consult without breaking
 *     determinism. With 11 pairs and 4 samples a repeat is simply likely. The
 *     goal was never zero collisions; it was that a colour repeat stops
 *     producing a lookalike poster, and shortlisted geometry does that.
 */

import { posterPalette, posterPaletteById, type PosterPalette } from '@/constants/poster-palette';
import { hashSeed, type PosterFamily, type PosterInput } from '@/utils/poster-metrics';
import { blockFamily } from './block';
import { classicFamily } from './classic';
import { panelFamily } from './panel';
import { spineFamily } from './spine';

export const POSTER_FAMILIES: readonly PosterFamily[] = [
  classicFamily,
  blockFamily,
  spineFamily,
  panelFamily,
];

export type PosterFamilyId = (typeof POSTER_FAMILIES)[number]['id'];

const BY_ID = new Map(POSTER_FAMILIES.map((f) => [f.id, f]));

export function posterFamilyById(id: string): PosterFamily | undefined {
  return BY_ID.get(id);
}

/**
 * Category → family shortlist. Keys are the strings in
 * `src/constants/categories.ts`, matched case-insensitively.
 *
 * The pairings are about what the composition says, not about taxonomy:
 * `spine` is loud and vertical so it goes to gigs and film festivals, `block`
 * is calm and structured so it goes to workshops and bodywork (refined-play,
 * the reference for it, IS a workshop poster), `panel` goes wherever the event
 * most likely brought a photograph, and `classic` holds the talks and meetups
 * where the title genuinely is the poster.
 */
const CATEGORY_FAMILIES: Record<string, readonly string[]> = {
  // ── Lara's vocabulary (2026-08-18) ──
  art: ['panel', 'block'],
  film: ['panel', 'spine'],
  music: ['spine', 'panel'],
  wellbeing: ['block', 'panel'],
  'performing arts': ['spine', 'panel'],
  craft: ['block', 'panel'],
  'design, illustration, animation': ['panel', 'block'],
  photography: ['panel', 'classic'],
  festivals: ['spine', 'block'],
  'street art': ['panel', 'spine'],
  fashion: ['panel', 'spine'],
  exhibitions: ['panel', 'block'],
  academic: ['classic', 'block'],
  tech: ['classic', 'block'],
  tattoo: ['panel', 'block'],
  gaming: ['block', 'spine'],
  'jam session': ['spine', 'panel'],
  spiritual: ['block', 'classic'],
  talk: ['classic', 'spine'],
  workshops: ['block', 'classic'],
  'social movements': ['spine', 'classic'],
  coaching: ['block', 'classic'],
  learning: ['classic', 'block'],
  'meet ups': ['classic', 'panel'],
  'food & drinks': ['panel', 'block'],
  markets: ['panel', 'classic'],
  'pop-ups': ['block', 'spine'],
  literature: ['classic', 'spine'],
  language: ['classic', 'block'],
  sports: ['spine', 'block'],
  outdoors: ['panel', 'spine'],
  volunteering: ['classic', 'block'],
  neighbourhood: ['classic', 'panel'],
  'family & kids': ['block', 'panel'],
  clubbing: ['spine', 'block'],
  'queer life': ['spine', 'panel'],

  // ── Retired names, kept on purpose ──
  // `events.categories` is unvalidated `text[]`, so an old value survives in
  // the database until the rename migration is applied — and posters are
  // regenerated on demand, so dropping these keys would send those events to
  // the full family set and change their composition for no reason.
  //
  // Every key here mirrors the shortlist of the name it maps to in
  // `LEGACY_CATEGORY_ALIASES`, which buys one invariant worth having: applying
  // the migration cannot change a single poster. `poster-families.test.ts`
  // asserts it holds for every alias.
  //
  // Two keys therefore moved to honour that: `therapy` (was `block, classic`)
  // now follows Wellbeing, and `concert` (was `spine, block`) now follows
  // Music. A regenerated poster for those events — 1 and 9 rows in production
  // — can land on a different composition than it would have yesterday. That
  // is a one-time cost paid here rather than an unexplained shift later.
  workshop: ['block', 'classic'],
  wellness: ['block', 'panel'],
  therapy: ['block', 'panel'],
  coach: ['block', 'classic'],
  education: ['classic', 'block'],
  meet: ['classic', 'panel'],
  concert: ['spine', 'panel'],
  job: ['classic', 'block'],
  service: ['classic', 'block'],
  // Aggregator-written values that were never in `EVENT_CATEGORIES`.
  community: ['classic', 'panel'],
  technology: ['classic', 'block'],
  nightlife: ['spine', 'block'],
  dance: ['spine', 'panel'],
  exhibition: ['panel', 'block'],
};

const ALL_IDS = POSTER_FAMILIES.map((f) => f.id);

/**
 * The shortlist for an event's categories — the first entry that is recognised
 * wins. An event with no categories, or only unrecognised ones, gets the full
 * set rather than a default family, so it still varies across the wall.
 */
export function familyShortlist(categories?: readonly string[] | null): readonly string[] {
  if (categories) {
    for (const raw of categories) {
      const key = raw?.trim().toLowerCase();
      if (key && CATEGORY_FAMILIES[key]) return CATEGORY_FAMILIES[key];
    }
  }
  return ALL_IDS;
}

/** The seed every deterministic choice is made from. */
export function posterSeed(input: PosterInput): string {
  return `${input.title}|${input.startsAt}`;
}

/**
 * Pick the family. `variant` steps through the shortlist — that is what the
 * Shuffle button on the create screen increments.
 */
export function familyForInput(input: PosterInput): PosterFamily {
  const shortlist = familyShortlist(input.categories);
  const variant = Math.max(0, Math.trunc(input.variant ?? 0));
  const index = (hashSeed(posterSeed(input)) + variant) % shortlist.length;
  return posterFamilyById(shortlist[index]) ?? classicFamily;
}

/**
 * Pick the palette from the subset this family can carry.
 *
 * Salted with the family id as well as a literal, so that (a) it is independent
 * of the family choice rather than derived from the same number, and (b)
 * shuffling to a new family also moves the colour, instead of recolouring the
 * same geometry and looking like nothing happened.
 */
export function paletteForFamily(
  seed: string,
  family: PosterFamily,
  variant = 0
): PosterPalette {
  const allowed = family.palettes
    .map((id) => posterPaletteById(id))
    .filter((p): p is PosterPalette => !!p);
  // A family that named only unknown ids would otherwise divide by zero. Falling
  // back to the full list keeps a typo from producing an unrenderable poster.
  const pool = allowed.length > 0 ? allowed : posterPalette.slice();
  const step = Math.max(0, Math.trunc(variant));
  const index = (hashSeed(`${seed}#palette#${family.id}`) + step) % pool.length;
  return pool[index];
}

/**
 * How many distinct posters Shuffle can reach for this event before it repeats.
 * The create screen does not need it, but it is what the shuffle test asserts
 * against and it documents the real variety on offer.
 */
export function variantCycleLength(input: PosterInput): number {
  const shortlist = familyShortlist(input.categories);
  const sizes = shortlist.map((id) => posterFamilyById(id)?.palettes.length ?? 1);
  return sizes.reduce((acc, n) => lcm(acc, n), shortlist.length);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}
