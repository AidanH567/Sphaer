/**
 * Real photographs for the poster QA renders, cut out of the seed posters.
 *
 * The photo-bearing families cannot be judged on a synthetic gradient — the
 * whole question about `panel` is whether type stays readable on a plate
 * floating over a real image, and about `block` whether a photograph sits
 * convincingly in a hard-edged Swiss block. A noise field answers neither.
 *
 * There are no standalone photographs in this repo, but there ARE ten
 * hand-authored posters in scripts/seed-assets/posters/, and several of them
 * are built around real photographs. So the crops below lift those photographs
 * back out: a basketball shot from refined-play, portraits from earthbodies and
 * lines-borders-bodies, and the halftone figure from nigerian-film-festival.
 *
 * Derived at QA time rather than committed as new binaries — the seed posters
 * are already in the repo, and a crop of a file that is already tracked is not
 * worth another megabyte of git history. Fractions rather than pixels because
 * the seed posters are not all the same size.
 *
 * These feed the QA renderer ONLY. Nothing in the app imports this file.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';

const SEED_DIR = path.resolve(__dirname, 'seed-assets', 'posters');

interface Crop {
  /** Seed poster filename. */
  file: string;
  /** What the crop actually shows, for the QA log. */
  label: string;
  /** Region as fractions of the source, [left, top, right, bottom]. */
  box: [number, number, number, number];
}

/**
 * Ordered so that consecutive QA fixtures get visibly different photographs —
 * a contact sheet where every tile carries the same portrait proves much less
 * about the compositions than one where they differ.
 *
 * ── The boxes are tight for a reason ─────────────────────────────────────────
 * The first pass used generous crops and several of them caught the SOURCE
 * poster's own typography: "EN/CH … RK" and "FUTURE BUILT TOGETHER" from
 * women-in-network came through onto four QA tiles, where they read as the
 * generator having painted broken text. Every box below is pulled inside the
 * source's type — and inside refined-play's hairline border, which was showing
 * up as a stray blue line down the edge of a generated poster.
 *
 * If a crop is ever widened, look at the seed poster first and check what type
 * is in the region.
 */
export const QA_PHOTO_CROPS: readonly Crop[] = [
  {
    file: 'refined-play.png',
    // Inside the poster's blue hairline border on the right and bottom.
    label: 'basketball / sky',
    box: [0.5, 0.52, 0.975, 0.935],
  },
  {
    file: 'earthbodies.png',
    // The ochre plate and the head; the pink title sits above y=0.20.
    label: 'portrait on ochre',
    box: [0.25, 0.25, 0.75, 0.73],
  },
  {
    file: 'women-in-network.png',
    // Head and shoulders only — "WOMEN/IN TECH" is at y≈0.47–0.65 on the left
    // and the meta block at y≈0.62–0.73 on the right.
    label: 'figure on white',
    box: [0.32, 0.16, 0.7, 0.62],
  },
  {
    file: 'nigerian-film-festival.png',
    // Below the "NIGERIAN FILM FESTIVAL" masthead and inside the vertical type.
    label: 'halftone figure',
    box: [0.24, 0.33, 0.78, 0.84],
  },
  {
    file: 'lines-borders-bodies.png',
    // The leftmost portrait, below its "01 Leila Haroun" caption at y≈0.355.
    label: 'portrait, monochrome',
    box: [0.025, 0.378, 0.31, 0.61],
  },
  {
    file: 'sensory-drift.png',
    // Between the top type block (ends y≈0.23) and the bottom one (starts y≈0.82).
    label: 'collage / iridescent',
    box: [0.14, 0.28, 0.86, 0.79],
  },
];

/**
 * Crop, resize to cover `width`×`height`, and inline as a JPEG data URI — the
 * only form `buildPosterLayout` accepts.
 *
 * Normalised to JPEG because librsvg (Node) and react-native-svg (device) both
 * handle it, and it keeps the embedded payload small enough that the SVG
 * document stays parseable.
 */
export async function photoDataUri(
  crop: Crop,
  width: number,
  height: number
): Promise<string> {
  const file = path.join(SEED_DIR, crop.file);
  if (!fs.existsSync(file)) {
    throw new Error(`seed poster missing: ${file}`);
  }
  const image = sharp(file);
  const meta = await image.metadata();
  const sw = meta.width ?? 0;
  const sh = meta.height ?? 0;
  const [l, t, r, b] = crop.box;

  const left = Math.round(l * sw);
  const top = Math.round(t * sh);
  const cw = Math.max(1, Math.round((r - l) * sw));
  const ch = Math.max(1, Math.round((b - t) * sh));

  const jpeg = await image
    .extract({ left, top, width: Math.min(cw, sw - left), height: Math.min(ch, sh - top) })
    .resize(width, height, { fit: 'cover' })
    .jpeg({ quality: 82 })
    .toBuffer();

  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}
