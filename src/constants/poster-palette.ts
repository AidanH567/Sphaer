/**
 * Poster palettes — design tokens for the auto-generated event poster
 * (src/utils/poster-template.ts).
 *
 * Deliberately OUTSIDE the app-chrome palette in theme.ts: the Mural is a
 * street poster wall, and a wall of Neutral/* greys is not one. These echo the
 * hand-authored seed posters in scripts/generate-svg-posters.ts — Berlin
 * risograph / Das Plakat territory — so a generated poster sits next to a
 * designed one without announcing which is which.
 *
 * One pair is chosen deterministically per event (hash of title + start time),
 * so the same event always regenerates to the same poster and the wall gets
 * variety without asking the user to pick anything.
 *
 * `bg` is always fully opaque — that is load-bearing, not decorative. The
 * blank-poster failure that put 8 holes in the Mural was a fully transparent
 * image; a poster whose first drawn element is an opaque full-bleed rect
 * cannot reproduce it. `assertLayoutIsPaintable` enforces the `#RRGGBB` form.
 *
 * ── Why this is its own file and not a block in theme.ts ─────────────────────
 * It WAS a block in theme.ts, and that made the whole poster pipeline
 * unrunnable outside a React Native bundler: theme.ts imports `Platform` from
 * `react-native`, whose entry point is Flow-typed source that esbuild (and so
 * `tsx`) refuses to parse. That put `scripts/qa-generate-poster.ts` — the only
 * thing that can actually LOOK at a rendered poster and measure its pixels —
 * behind an import it could never satisfy.
 *
 * Splitting the tokens into a dependency-free module fixes that without
 * weakening the rule: these are still design tokens under src/constants/, and
 * theme.ts re-exports them, so `@/constants/theme` remains the address every
 * component uses. Only the Node-side pipeline reaches in here directly.
 */

export const posterPalette = [
  { bg: '#0A0A0A', fg: '#39FF14', accent: '#F5D547' }, // black / acid green
  { bg: '#C9382E', fg: '#FFFFFF', accent: '#F5D547' }, // signal red / white
  { bg: '#F2EBE0', fg: '#2B2A27', accent: '#C04A30' }, // bone / chocolate
  { bg: '#0E1F3A', fg: '#F3E9D2', accent: '#EB46B0' }, // navy / cream
  { bg: '#F5D547', fg: '#1A1A1A', accent: '#C9382E' }, // yellow / ink
  { bg: '#180A2A', fg: '#FFFFFF', accent: '#EB46B0' }, // aubergine / white
  { bg: '#0F2A2E', fg: '#F3EFE5', accent: '#7AE07A' }, // deep teal / cream
  { bg: '#F26B3A', fg: '#1A1A1A', accent: '#F8F1E4' }, // orange / ink
] as const;

export type PosterPalette = (typeof posterPalette)[number];
