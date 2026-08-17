/**
 * Build-time poster dimension manifest for the seeded demo posters.
 *
 * WHY THIS EXISTS: the Mural needs each poster's aspect ratio to lay the wall
 * out, and the `events` table has no poster_width / poster_height columns.
 * Without a manifest, useMuralDimensions falls back to `Image.getSize()` — one
 * network fetch per poster, ALL of which must complete before the wall can
 * paint, and then every image is fetched a second time to actually display it.
 * With ~50 seeded events that was a cold, blocking round-trip for the whole set
 * on every visit to the Mural, which is most of why it "felt slow".
 *
 * Keys are the Storage object path (bucket-relative) so a URL match is a cheap
 * `endsWith` and survives a project / CDN host change. Values are
 * [width, height] in pixels, measured from the source assets:
 *   - figma-seed/*  — captured at import time by scripts/import-figma-posters.ts
 *     (the same numbers embedded in src/data/mockEvents.ts).
 *   - lara-2026/*   — measured from the committed PNGs in
 *     scripts/seed-assets/posters/.
 *
 * Posters NOT listed here (user uploads) still resolve at runtime via
 * Image.getSize(); the Mural does not block on them.
 *
 * KEEPING IT CURRENT: when a poster is added to scripts/seed-assets/posters/ (or
 * a new figma-seed poster is imported), add its [width, height] here too.
 * Otherwise the wall silently falls back to a network measure for it.
 */
const SEED_POSTER_SIZES: Record<string, readonly [number, number]> = {
  'figma-seed/evt-bitterend.webp': [817, 1113],
  'figma-seed/evt-blues.webp': [864, 1223],
  'figma-seed/evt-ceramic.webp': [1760, 2406],
  'figma-seed/evt-coding.webp': [1003, 1024],
  'figma-seed/evt-collection.webp': [621, 876],
  'figma-seed/evt-cooking.webp': [2528, 1686],
  'figma-seed/evt-dance.webp': [1728, 2442],
  'figma-seed/evt-das-programm.webp': [800, 1133],
  'figma-seed/evt-eurorack.webp': [1024, 576],
  'figma-seed/evt-film2.webp': [495, 700],
  'figma-seed/evt-fleamarket.webp': [800, 1133],
  'figma-seed/evt-foreign.webp': [936, 1326],
  'figma-seed/evt-funkhaus-late.webp': [800, 1133],
  'figma-seed/evt-jassmom.webp': [420, 298],
  'figma-seed/evt-jobfair.webp': [842, 1264],
  'figma-seed/evt-leaving.webp': [735, 922],
  'figma-seed/evt-margiana.webp': [895, 1325],
  'figma-seed/evt-modular.webp': [1074, 1521],
  'figma-seed/evt-openmic.webp': [800, 1133],
  'figma-seed/evt-orchestra.webp': [951, 1258],
  'figma-seed/evt-painting.webp': [896, 1192],
  'figma-seed/evt-photo.webp': [725, 1024],
  'figma-seed/evt-pictoplasma.webp': [800, 992],
  'figma-seed/evt-plakat.webp': [800, 1133],
  'figma-seed/evt-poetry.webp': [729, 1024],
  'figma-seed/evt-riso-print.webp': [800, 1133],
  'figma-seed/evt-rough-trade.webp': [800, 1133],
  'figma-seed/evt-soundbath.webp': [1728, 2444],
  'figma-seed/evt-startup.webp': [800, 1133],
  'figma-seed/evt-sxtn.webp': [584, 828],
  'figma-seed/evt-tarkovsky.webp': [1024, 749],
  'figma-seed/evt-techno.webp': [572, 1024],
  'figma-seed/evt-toundra.webp': [900, 1224],
  'figma-seed/evt-tresor-4floor.webp': [800, 1133],
  'figma-seed/evt-typecraft.webp': [1024, 1024],
  'figma-seed/evt-void-volume.webp': [800, 1133],
  'figma-seed/evt-who-owns.webp': [800, 1133],
  'figma-seed/evt-yoga.webp': [1024, 683],
  'figma-seed/evt-zinefair.webp': [800, 1133],
  'lara-2026/afro-cuban-summer.png': [797, 1024],
  'lara-2026/berlin-shiatsu.png': [748, 1024],
  'lara-2026/civic-ai-berlin.png': [748, 1024],
  'lara-2026/earthbodies.png': [797, 1024],
  'lara-2026/fuego-libre.png': [726, 1024],
  'lara-2026/lines-borders-bodies.png': [586, 1024],
  'lara-2026/nigerian-film-festival.png': [683, 1024],
  'lara-2026/refined-play.png': [683, 1024],
  'lara-2026/sensory-drift.png': [797, 1024],
  'lara-2026/women-in-network.png': [797, 1024],
};

/**
 * Look up a poster's intrinsic size from the manifest. Returns undefined for
 * anything not seeded (user uploads), which the caller measures at runtime.
 */
export function getSeedPosterSize(
  url: string
): { width: number; height: number } | undefined {
  // Strip a query string (uploads carry a `?v=` cache-buster) before matching.
  const clean = url.split('?')[0];
  for (const key of Object.keys(SEED_POSTER_SIZES)) {
    if (clean.endsWith(key)) {
      const [width, height] = SEED_POSTER_SIZES[key];
      return { width, height };
    }
  }
  return undefined;
}

/** Every manifest key, for tests and tooling. */
export const SEED_POSTER_KEYS = Object.keys(SEED_POSTER_SIZES);
