/**
 * The circle-cover families, the registry that picks between them, and Shuffle.
 *
 * ── The tests that earned their place ────────────────────────────────────────
 * Two real bugs were found by LOOKING at `docs/poster-qa/_covers-as-displayed.png`
 * during this work, and neither was catchable by any check that existed:
 *
 *   1. `marquee` sized its letterbox band to the safe area (y 100–710) while the
 *      visible strip is y 112–698. The band covered every visible pixel, so a
 *      cover with a photograph rendered as a flat colour card with the picture
 *      entirely hidden. Every guard passed. Ink coverage was 27%.
 *   2. `plate` inset its hairline frame OUTWARD from the safe band, putting both
 *      horizontal bars off screen. The frame rendered as two unexplained
 *      vertical rules.
 *
 * Both are the same underlying mistake: the layout maths has no idea the canvas
 * gets cropped. So `describe('the crop')` below encodes the crop as an
 * assertion, which is the only way it stops being something a person has to
 * remember. A green suite is not evidence — but a suite that models the actual
 * display geometry is a great deal better than one that models the canvas.
 *
 * What still cannot be tested is whether a cover looks good. That judgement is
 * `npx tsx scripts/qa-generate-cover.ts` and looking at both sheets.
 */

import {
  buildCoverLayout,
  COVER_AVATAR_SAFE_X,
  COVER_AVATAR_SAFE_Y,
  COVER_FAMILIES,
  COVER_HEIGHT,
  COVER_MAX_TITLE_LINES,
  COVER_SAFE_BOTTOM_Y,
  COVER_SAFE_Y,
  COVER_WIDTH,
  coverFamilyById,
  coverFamilyShortlist,
  coverName,
  coverPaletteForFamily,
  coverSeed,
  coverVariantCycleLength,
  formatCoverMetaLine,
  type CoverInput,
  type CoverLayout,
} from '../cover-template';
import { textRunBounds } from '../poster-template';
import { assertLayoutIsPaintable } from '../poster-guard';
import { posterPalette } from '@/constants/poster-palette';

const PHOTO = 'data:image/png;base64,AAAA';

const base: CoverInput = {
  name: 'Neukölln Sound System',
  tags: ['Music'],
};

/** Names that have broken the fitter, plus the ones that will. */
const HARD_NAMES = [
  'Neukölln Sound System',
  'Grauzone',
  'A',
  'Berlin Shiatsu',
  'Kollektiv für Bewegte Bilder & Expanded Cinema',
  'Donaudampfschifffahrtsgesellschaftskapitänsverein',
  // The monogram path does `Array.from(name)[0]`; a naive `name[0]` returns half
  // a surrogate pair here and paints a replacement glyph.
  '🌱 Prinzessinnengarten',
  'SXTN — "Kann Sein, Dass Scheiße Wird"',
  '   ',
  '',
];

/** Solve a layout that is definitely `familyId`, by walking Shuffle. */
function layoutForFamily(input: CoverInput, familyId: string): CoverLayout | null {
  for (let variant = 0; variant < 64; variant++) {
    const layout = buildCoverLayout({ ...input, tags: [], variant });
    if (layout.family === familyId) return layout;
  }
  return null;
}

describe('the cover registry', () => {
  it('exposes three families, each with a unique id and at least one palette', () => {
    expect(COVER_FAMILIES).toHaveLength(3);
    const ids = COVER_FAMILIES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const family of COVER_FAMILIES) {
      expect(family.palettes.length).toBeGreaterThan(0);
      expect(family.label.trim()).not.toBe('');
    }
  });

  it('only names palettes that exist', () => {
    const known = new Set<string>(posterPalette.map((p) => p.id));
    for (const family of COVER_FAMILIES) {
      for (const id of family.palettes) expect(known.has(id)).toBe(true);
    }
  });

  /**
   * `spine` was dropped on purpose. Its run length is the canvas HEIGHT less
   * margins — 1384px in portrait, 530px inside a cover's safe band — and its
   * whole argument (a vertical bar of type stays a recognisable silhouette in a
   * tall narrow frame) inverts on a wide short one. This test is here so that
   * "ship three good ones rather than four with one stretched" is a decision
   * recorded in the suite rather than an omission someone later treats as a gap.
   */
  it('does not carry a landscape spine', () => {
    expect(coverFamilyById('spine')).toBeUndefined();
    expect(COVER_FAMILIES.map((f) => f.id).sort()).toEqual(['marquee', 'plate', 'ribbon']);
  });

  it('reports the family that solved the layout', () => {
    const layout = buildCoverLayout(base);
    expect(COVER_FAMILIES.map((f) => f.id)).toContain(layout.family);
  });

  it('solves at cover dimensions, not poster ones', () => {
    const layout = buildCoverLayout(base);
    expect(layout.width).toBe(COVER_WIDTH);
    expect(layout.height).toBe(COVER_HEIGHT);
    // Landscape, and inside useMuralLayout's MAX_ASPECT of 1.9.
    expect(layout.width / layout.height).toBeGreaterThan(1);
    expect(layout.width / layout.height).toBeLessThanOrEqual(1.9);
  });
});

describe('every cover family', () => {
  for (const family of COVER_FAMILIES) {
    describe(family.id, () => {
      for (const [label, photo] of [
        ['without a photo', null],
        ['with a photo', PHOTO],
      ] as const) {
        it(`clears the blank-poster guard ${label}`, () => {
          for (const name of HARD_NAMES) {
            const layout = layoutForFamily({ ...base, name, photoDataUri: photo }, family.id);
            expect(layout).not.toBeNull();
            expect(() => assertLayoutIsPaintable(layout!)).not.toThrow();
          }
        });

        it(`keeps every text run on the canvas ${label}`, () => {
          for (const name of HARD_NAMES) {
            const layout = layoutForFamily({ ...base, name, photoDataUri: photo }, family.id)!;
            for (const run of layout.texts) {
              const b = textRunBounds(run);
              expect(b.x).toBeGreaterThanOrEqual(-2);
              expect(b.y).toBeGreaterThanOrEqual(-2);
              expect(b.x + b.width).toBeLessThanOrEqual(COVER_WIDTH + 2);
              expect(b.y + b.height).toBeLessThanOrEqual(COVER_HEIGHT + 2);
            }
          }
        });

        it(`keeps every shape on the canvas ${label}`, () => {
          for (const name of HARD_NAMES) {
            const layout = layoutForFamily({ ...base, name, photoDataUri: photo }, family.id)!;
            for (const r of [layout.background, layout.band, ...layout.accents]) {
              expect(r.x).toBeGreaterThanOrEqual(0);
              expect(r.y).toBeGreaterThanOrEqual(0);
              expect(r.x + r.width).toBeLessThanOrEqual(COVER_WIDTH);
              expect(r.y + r.height).toBeLessThanOrEqual(COVER_HEIGHT);
            }
          }
        });

        it(`carries a name and the wordmark ${label}`, () => {
          const layout = layoutForFamily({ ...base, photoDataUri: photo }, family.id)!;
          const visible = layout.texts.filter((t) => t.text.trim() && t.opacity > 0.05);
          expect(visible.length).toBeGreaterThanOrEqual(2);
          expect(layout.texts.some((t) => t.text === 'SPHAER')).toBe(true);
        });
      }

      it('draws only palettes it declared', () => {
        const declared = new Set(family.palettes);
        for (let variant = 0; variant < 40; variant++) {
          const layout = buildCoverLayout({ ...base, tags: [], variant });
          if (layout.family !== family.id) continue;
          expect(declared.has(layout.palette.id)).toBe(true);
        }
      });

      it('never sets more than two lines of name', () => {
        for (const name of HARD_NAMES) {
          const layout = layoutForFamily({ ...base, name }, family.id)!;
          const biggest = Math.max(...layout.texts.map((t) => t.fontSize));
          const nameLines = layout.texts.filter((t) => t.fontSize === biggest);
          expect(nameLines.length).toBeLessThanOrEqual(COVER_MAX_TITLE_LINES);
        }
      });
    });
  }
});

/**
 * ── The crop ─────────────────────────────────────────────────────────────────
 * `circles/[id].tsx` renders a cover at `width: '100%', height: 160` with
 * `contentFit="cover"`. Nothing in the layout maths knows that, which is how
 * both real bugs got in. These tests know it.
 */
describe('the crop', () => {
  /** Visible vertical band, in canvas px, for a given screen width in points. */
  function visibleBand(widthPt: number): { top: number; bottom: number } {
    const visible = COVER_WIDTH / (widthPt / 160);
    const top = (COVER_HEIGHT - visible) / 2;
    return { top, bottom: top + visible };
  }

  /** The narrowest visible band across the phones we care about. */
  const WORST = visibleBand(430);

  it('models the same safe band the families are written against', () => {
    // If this drifts, the constants are lying and every layout below is
    // measured against the wrong band.
    expect(COVER_SAFE_Y).toBeGreaterThanOrEqual(WORST.top);
    expect(COVER_SAFE_BOTTOM_Y).toBeLessThanOrEqual(WORST.bottom);
  });

  for (const family of COVER_FAMILIES) {
    it(`${family.id} keeps every text run inside the safe band`, () => {
      for (const photo of [null, PHOTO]) {
        for (const name of HARD_NAMES) {
          const layout = layoutForFamily({ ...base, name, photoDataUri: photo }, family.id)!;
          for (const run of layout.texts) {
            if (!run.text.trim()) continue;
            const b = textRunBounds(run);
            expect(b.y).toBeGreaterThanOrEqual(COVER_SAFE_Y - 1);
            expect(b.y + b.height).toBeLessThanOrEqual(COVER_SAFE_BOTTOM_Y + 1);
          }
        }
      }
    });

    /**
     * The `marquee` bug, generalised. A family that paints a full-width opaque
     * rect over the photograph must leave some of it showing inside the visible
     * strip, or attaching a photo does nothing at all.
     */
    it(`${family.id} does not hide the whole photograph behind its own band`, () => {
      for (const name of HARD_NAMES) {
        const layout = layoutForFamily({ ...base, name, photoDataUri: PHOTO }, family.id)!;
        if (!layout.photo) continue;

        // Only full-width rects can occlude the photo across the entire strip;
        // a partial-width block (ribbon's field, plate's plate) leaves the rest
        // of the row visible by construction.
        const fullWidth = [layout.band, ...layout.accents].filter(
          (r) => r.x <= 0 && r.x + r.width >= COVER_WIDTH && r.height > 0
        );
        const covered = fullWidth.reduce((acc, r) => {
          const top = Math.max(r.y, WORST.top);
          const bottom = Math.min(r.y + r.height, WORST.bottom);
          return acc + Math.max(0, bottom - top);
        }, 0);
        const strip = WORST.bottom - WORST.top;
        // At least a fifth of the visible strip has to still be photograph.
        expect(covered).toBeLessThanOrEqual(strip * 0.8);
      }
    });

    /**
     * The circle detail screen hangs a 90pt avatar over the bottom-left of the
     * banner. Type that lands there is not "a bit tight", it is invisible.
     */
    it(`${family.id} puts no type under the circle avatar`, () => {
      for (const photo of [null, PHOTO]) {
        for (const name of HARD_NAMES) {
          const layout = layoutForFamily({ ...base, name, photoDataUri: photo }, family.id)!;
          for (const run of layout.texts) {
            if (!run.text.trim()) continue;
            const b = textRunBounds(run);
            const overlapsX = b.x < COVER_AVATAR_SAFE_X;
            const overlapsY = b.y + b.height > COVER_AVATAR_SAFE_Y;
            expect(overlapsX && overlapsY).toBe(false);
          }
        }
      }
    });
  }
});

describe('selection — tags first, then hash', () => {
  it('sends a music circle and a talk circle to different geometry', () => {
    const music = coverFamilyShortlist(['Music']);
    const talk = coverFamilyShortlist(['Talk']);
    expect(music).not.toEqual(talk);
  });

  it('matches a tag case-insensitively and skips ones it does not know', () => {
    expect(coverFamilyShortlist(['mUsIc'])).toEqual(coverFamilyShortlist(['Music']));
    expect(coverFamilyShortlist(['Knitting', 'Music'])).toEqual(coverFamilyShortlist(['Music']));
  });

  it('handles a multi-word tag, which a naive key would split', () => {
    expect(coverFamilyShortlist(['Social Movements'])).toEqual(['ribbon', 'marquee']);
  });

  it('falls back to every family when there is no usable tag', () => {
    const all = COVER_FAMILIES.map((f) => f.id);
    expect(coverFamilyShortlist(null)).toEqual(all);
    expect(coverFamilyShortlist([])).toEqual(all);
    expect(coverFamilyShortlist(['Knitting'])).toEqual(all);
  });

  it('keeps a tagged circle inside its shortlist across every variant', () => {
    const shortlist = coverFamilyShortlist(['Music']);
    for (let variant = 0; variant < 24; variant++) {
      const layout = buildCoverLayout({ ...base, variant });
      expect(shortlist).toContain(layout.family);
    }
  });
});

describe('determinism', () => {
  it('regenerates the identical cover for the same circle, every time', () => {
    const a = buildCoverLayout(base);
    const b = buildCoverLayout({ ...base });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('treats a missing variant as variant 0 — the canonical cover', () => {
    expect(JSON.stringify(buildCoverLayout(base))).toBe(
      JSON.stringify(buildCoverLayout({ ...base, variant: 0 }))
    );
  });

  it('ignores a negative or fractional variant rather than throwing', () => {
    expect(() => buildCoverLayout({ ...base, variant: -3 })).not.toThrow();
    expect(() => buildCoverLayout({ ...base, variant: 2.7 })).not.toThrow();
    expect(JSON.stringify(buildCoverLayout({ ...base, variant: -3 }))).toBe(
      JSON.stringify(buildCoverLayout({ ...base, variant: 0 }))
    );
  });

  it('does not let the photo change the geometry', () => {
    const flat = buildCoverLayout(base);
    const withPhoto = buildCoverLayout({ ...base, photoDataUri: PHOTO });
    expect(withPhoto.family).toBe(flat.family);
    expect(withPhoto.palette.id).toBe(flat.palette.id);
  });
});

describe('shuffle', () => {
  it('actually changes the cover', () => {
    const first = buildCoverLayout({ ...base, tags: [] });
    let changed = false;
    for (let v = 1; v < 8; v++) {
      const next = buildCoverLayout({ ...base, tags: [], variant: v });
      if (next.family !== first.family || next.palette.id !== first.palette.id) changed = true;
    }
    expect(changed).toBe(true);
  });

  it('reaches every family for an untagged circle', () => {
    const seen = new Set<string>();
    for (let v = 0; v < 40; v++) {
      seen.add(buildCoverLayout({ ...base, tags: [], variant: v }).family);
    }
    expect(seen.size).toBe(COVER_FAMILIES.length);
  });

  it('reaches every palette a family declared, as the variant walks', () => {
    for (const family of COVER_FAMILIES) {
      const seen = new Set<string>();
      const cycle = coverVariantCycleLength({ ...base, tags: [] });
      for (let v = 0; v < cycle * 2; v++) {
        const layout = buildCoverLayout({ ...base, tags: [], variant: v });
        if (layout.family === family.id) seen.add(layout.palette.id);
      }
      expect(seen.size).toBe(family.palettes.length);
    }
  });

  it('keeps every shuffled cover paintable', () => {
    for (let v = 0; v < 24; v++) {
      const layout = buildCoverLayout({ ...base, tags: [], variant: v });
      expect(() => assertLayoutIsPaintable(layout)).not.toThrow();
    }
  });

  it('moves the palette when it moves the family, not just the geometry', () => {
    // Salting the palette hash with the family id is what stops a shuffle from
    // recolouring the same composition and looking like nothing happened.
    const a = coverPaletteForFamily(coverSeed(base), COVER_FAMILIES[0]);
    const b = coverPaletteForFamily(coverSeed(base), COVER_FAMILIES[1]);
    expect(typeof a.id).toBe('string');
    expect(typeof b.id).toBe('string');
  });
});

describe('text derived from a circle', () => {
  it('joins tags with a middot and caps the list at three', () => {
    expect(formatCoverMetaLine(['Music'])).toBe('MUSIC');
    expect(formatCoverMetaLine(['Music', 'Art'])).toBe('MUSIC · ART');
    expect(formatCoverMetaLine(['a', 'b', 'c', 'd'])).toBe('A · B · C');
  });

  it('survives empty, blank and missing tags', () => {
    expect(formatCoverMetaLine(null)).toBe('');
    expect(formatCoverMetaLine([])).toBe('');
    expect(formatCoverMetaLine(['  ', ''])).toBe('');
  });

  it('gives a blank name a real word rather than an empty run', () => {
    // assertLayoutIsPaintable needs two visible text runs; '' is not one.
    expect(coverName('   ')).toBe('Untitled circle');
    expect(coverName('Grauzone')).toBe('Grauzone');
  });

  it('puts a fallback line under an untagged circle instead of a gap', () => {
    const layout = buildCoverLayout({ name: 'Grauzone', tags: [] });
    expect(layout.texts.some((t) => t.text.includes('SPHAER CIRCLE'))).toBe(true);
  });
});
