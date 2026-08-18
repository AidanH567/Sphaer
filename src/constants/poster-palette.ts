/**
 * Poster palettes — design tokens for the auto-generated event poster
 * (src/utils/poster-template.ts).
 *
 * Deliberately OUTSIDE the app-chrome palette in theme.ts: the Mural is a
 * street poster wall, and a wall of Neutral/* greys is not one. These echo the
 * hand-authored seed posters in scripts/seed-assets/posters/ — Berlin
 * risograph / Das Plakat territory — so a generated poster sits next to a
 * designed one without announcing which is which.
 *
 * `bg` is always fully opaque — that is load-bearing, not decorative. The
 * blank-poster failure that put 8 holes in the Mural was a fully transparent
 * image; a poster whose first drawn element is an opaque full-bleed rect
 * cannot reproduce it. `assertLayoutIsPaintable` enforces the `#RRGGBB` form.
 *
 * ── Why every pair carries an `id`, and why families filter on it ────────────
 * A palette is not universally good. `bg` on `accent` is the ink pairing the
 * `block` and `classic` families set large type in, so a pair whose bg and
 * accent are close in value (ink/orange) is illegible there while being fine on
 * `panel`, which only ever sets fg on bg. Before the families existed there was
 * one composition and every pair worked in it; now each family declares the
 * subset it can actually carry, and the pick is made from that subset.
 *
 * This is also half the fix for the collision Aidan saw — four sample posters
 * landing on two palettes. The other half is that the palette hash is SALTED
 * separately from the family hash (see `paletteForFamily`), so two events that
 * collide on colour almost never also collide on geometry. Two independent
 * events CAN still draw the same pair: the pick has to stay a pure function of
 * the event, so there is no global "what did the last poster use" to consult.
 * What changed is that a colour collision no longer means a lookalike poster.
 *
 * ── Why this is its own file and not a block in theme.ts ─────────────────────
 * It WAS a block in theme.ts, and that made the whole poster pipeline
 * unrunnable outside a React Native bundler: theme.ts imports `Platform` from
 * `react-native`, whose entry point is Flow-typed source that esbuild (and so
 * `tsx`) refuses to parse. That put `scripts/qa-generate-poster.ts` — the only
 * thing that can actually LOOK at a rendered poster and measure its pixels —
 * behind an import it could never satisfy.
 */

export const posterPalette = [
  { id: 'acid', bg: '#0A0A0A', fg: '#39FF14', accent: '#F5D547' }, // black / acid green
  { id: 'signal', bg: '#C9382E', fg: '#FFFFFF', accent: '#F5D547' }, // signal red / white
  { id: 'bone', bg: '#F2EBE0', fg: '#2B2A27', accent: '#C04A30' }, // bone / chocolate
  { id: 'navy', bg: '#0E1F3A', fg: '#F3E9D2', accent: '#EB46B0' }, // navy / cream
  { id: 'yellow', bg: '#F5D547', fg: '#1A1A1A', accent: '#C9382E' }, // yellow / ink
  { id: 'aubergine', bg: '#180A2A', fg: '#FFFFFF', accent: '#EB46B0' }, // aubergine / white
  { id: 'teal', bg: '#0F2A2E', fg: '#F3EFE5', accent: '#7AE07A' }, // deep teal / cream
  { id: 'orange', bg: '#F26B3A', fg: '#1A1A1A', accent: '#F8F1E4' }, // orange / ink
  // Added with the families. The first three compositions all set type at
  // 130–150px, which wants flatter, calmer grounds than the club palettes above.
  { id: 'blush', bg: '#F2B8C6', fg: '#1F4B44', accent: '#1F4B44' }, // blush / pine (berlin-shiatsu)
  { id: 'paper', bg: '#E8E4DC', fg: '#141414', accent: '#2F5BEA' }, // paper / klein blue
  { id: 'ink', bg: '#141414', fg: '#F2EBE0', accent: '#F26B3A' }, // ink / bone / orange
] as const;

export type PosterPalette = (typeof posterPalette)[number];
export type PosterPaletteId = PosterPalette['id'];

/** Look a pair up by id. Returns undefined for an id that is not in the list. */
export function posterPaletteById(id: string): PosterPalette | undefined {
  return posterPalette.find((p) => p.id === id);
}
