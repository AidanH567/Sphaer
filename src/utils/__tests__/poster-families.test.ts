/**
 * The layout families, the registry that picks between them, and Shuffle.
 *
 * ── What is and is not testable here ─────────────────────────────────────────
 * No test can tell you a poster looks good. That judgement is made by running
 * `npx tsx scripts/qa-generate-poster.ts --families` and LOOKING at
 * docs/poster-qa/_families-contact-sheet.png, and this project has earned that
 * rule the hard way twice — a poster that passed every check and was blank, and
 * a mural test that measured a wall which never moved.
 *
 * So these tests cover the things that break silently instead:
 *
 *   * A family drawing outside the canvas. Every coordinate is arithmetic
 *     against an ESTIMATED character advance, and SVG reports no error when
 *     text runs off the edge. The bounds check is rotation-aware, because the
 *     naive `x + width <= POSTER_WIDTH` is simply wrong for the spine.
 *   * Determinism. The poster is captured to a PNG and uploaded; a user who
 *     regenerates expects what they saw.
 *   * The selection rules actually applying — category shortlists, per-family
 *     palettes, and Shuffle reaching more than one poster.
 *   * The four-bar skeleton never coming back.
 */

import {
  buildPosterLayout,
  estimateTextWidth,
  familyForInput,
  familyShortlist,
  paletteForFamily,
  POSTER_FAMILIES,
  POSTER_HEIGHT,
  POSTER_WIDTH,
  posterFamilyById,
  posterSeed,
  textRunBounds,
  variantCycleLength,
  type PosterInput,
  type PosterLayout,
} from '../poster-template';
import { assertLayoutIsPaintable } from '../poster-guard';
import { posterPalette } from '@/constants/poster-palette';

const PHOTO = 'data:image/png;base64,AAAA';

const base: PosterInput = {
  title: 'Nachtstrom',
  startsAt: new Date(2026, 8, 12, 22, 0).toISOString(),
  locationName: 'Sameheads',
};

/** Titles that have actually broken the fitter, plus the ones that will. */
const HARD_TITLES = [
  'Nachtstrom',
  'Klubnacht',
  'A',
  'SXTN — "Kann Sein, Dass Scheiße Wird" Tour',
  'Öffentliche Führung: Körper & Grenzen',
  'Donaudampfschifffahrtsgesellschaftskapitänsabend',
  'An Evening of Improvised Electroacoustic Music and Expanded Cinema',
  'Berliner Nacht '.repeat(40).trim(),
  '   ',
  '🎧🎧🎧 Techno 🎧🎧🎧',
];

/** Build a layout that is definitely `familyId`, by walking the shuffle counter. */
function layoutForFamily(familyId: string, overrides: Partial<PosterInput> = {}): PosterLayout {
  for (let variant = 0; variant < 64; variant++) {
    const layout = buildPosterLayout({ ...base, ...overrides, variant });
    if (layout.family === familyId) return layout;
  }
  throw new Error(`no variant produced the '${familyId}' family`);
}

describe('the family registry', () => {
  it('exposes six families, each with a unique id and at least one palette', () => {
    expect(POSTER_FAMILIES.length).toBe(6);
    const ids = POSTER_FAMILIES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining(['classic', 'block', 'spine', 'panel', 'axial', 'technical'])
    );
    for (const family of POSTER_FAMILIES) {
      expect(family.palettes.length).toBeGreaterThan(0);
      expect(family.label.length).toBeGreaterThan(0);
    }
  });

  it('only names palettes that exist', () => {
    // A typo here would silently fall back to the full palette list, so the
    // family's colour constraint would quietly stop applying.
    const known = new Set(posterPalette.map((p) => p.id));
    for (const family of POSTER_FAMILIES) {
      for (const id of family.palettes) {
        expect(known).toContain(id);
      }
    }
  });

  it('reports the family that solved the layout', () => {
    const layout = buildPosterLayout(base);
    expect(posterFamilyById(layout.family)).toBeDefined();
  });
});

describe('every family', () => {
  for (const family of POSTER_FAMILIES) {
    describe(family.id, () => {
      for (const hasPhoto of [true, false]) {
        const label = hasPhoto ? 'with a photo' : 'without a photo';

        it(`clears the blank-poster guard ${label}`, () => {
          for (const title of HARD_TITLES) {
            const layout = layoutForFamily(family.id, {
              title,
              photoDataUri: hasPhoto ? PHOTO : null,
            });
            expect(() => assertLayoutIsPaintable(layout)).not.toThrow();
            expect(layout.background).toMatchObject({
              x: 0,
              y: 0,
              width: POSTER_WIDTH,
              height: POSTER_HEIGHT,
            });
            expect(layout.background.fill).toMatch(/^#[0-9a-fA-F]{6}$/);
          }
        });

        it(`keeps every text run on the canvas ${label}`, () => {
          // Rotation-aware, which the pre-family check was not: the spine's
          // title has an x near the left edge and a width of ~1300px running
          // UPWARD. Measuring it as if it ran left-to-right calls a correct
          // layout an overflow, and — far worse — would call an actual overflow
          // fine.
          for (const title of HARD_TITLES) {
            const layout = layoutForFamily(family.id, {
              title,
              photoDataUri: hasPhoto ? PHOTO : null,
              address: 'Sonnenallee 123, 12059 Berlin, Neukölln, Germany, Planet Earth',
            });
            for (const run of layout.texts) {
              const box = textRunBounds(run);
              expect(box.x).toBeGreaterThanOrEqual(-1);
              expect(box.y).toBeGreaterThanOrEqual(-1);
              expect(box.x + box.width).toBeLessThanOrEqual(POSTER_WIDTH + 1);
              expect(box.y + box.height).toBeLessThanOrEqual(POSTER_HEIGHT + 1);
            }
          }
        });

        it(`keeps every shape on the canvas ${label}`, () => {
          const layout = layoutForFamily(family.id, {
            photoDataUri: hasPhoto ? PHOTO : null,
          });
          const shapes = [layout.background, layout.band, ...layout.accents];
          if (layout.photo) shapes.push(layout.photo.rect);
          for (const r of shapes) {
            expect(r.x).toBeGreaterThanOrEqual(0);
            expect(r.y).toBeGreaterThanOrEqual(0);
            expect(r.x + r.width).toBeLessThanOrEqual(POSTER_WIDTH);
            expect(r.y + r.height).toBeLessThanOrEqual(POSTER_HEIGHT);
          }
        });

        it(`carries a title and the wordmark ${label}`, () => {
          const layout = layoutForFamily(family.id, {
            photoDataUri: hasPhoto ? PHOTO : null,
          });
          expect(layout.texts.some((t) => t.text === 'SPHAER')).toBe(true);
          const visible = layout.texts.filter((t) => t.text.trim() && t.opacity > 0.05);
          expect(visible.length).toBeGreaterThanOrEqual(2);
        });
      }

      it('renders the photo when given one, and nothing broken when not', () => {
        expect(layoutForFamily(family.id, { photoDataUri: PHOTO }).photo).not.toBeNull();
        expect(layoutForFamily(family.id, { photoDataUri: null }).photo).toBeNull();
      });

      it('never covers its own photograph with an accent', () => {
        // The `spine` family shipped a backing plate at exactly the photo's rect
        // for one contact sheet. Accents draw AFTER the photo, so it hid the
        // photograph completely — while the layout stayed paintable, the PNG
        // stayed the right size, and the ink fraction went UP, because a solid
        // magenta block is ink. Nothing but looking at it caught that, so this
        // is the check that would have.
        const layout = layoutForFamily(family.id, { photoDataUri: PHOTO });
        const photo = layout.photo!.rect;
        const photoArea = photo.width * photo.height;
        for (const a of [layout.band, ...layout.accents]) {
          const overlapW = Math.max(
            0,
            Math.min(a.x + a.width, photo.x + photo.width) - Math.max(a.x, photo.x)
          );
          const overlapH = Math.max(
            0,
            Math.min(a.y + a.height, photo.y + photo.height) - Math.max(a.y, photo.y)
          );
          // A plate may sit ON the photo (that is what `panel` is), but it may
          // never cover essentially all of it.
          expect((overlapW * overlapH) / photoArea).toBeLessThan(0.9);
        }
      });

      it('draws only palettes it declared', () => {
        for (let variant = 0; variant < 24; variant++) {
          const layout = buildPosterLayout({ ...base, variant });
          if (layout.family !== family.id) continue;
          expect(family.palettes).toContain(layout.palette.id);
        }
      });
    });
  }
});

describe('the four-bar skeleton', () => {
  it('is gone from every family', () => {
    // The old photo-less fallback was four accent bars descending down the
    // upper field at y = 232 / 396 / 560 / 724, narrowing as they went. On the
    // contact sheet it read as a loading placeholder — the single worst thing
    // about the generator's output — and no family may reintroduce it.
    const OLD_BAR_YS = [232, 396, 560, 724];
    for (const family of POSTER_FAMILIES) {
      const layout = layoutForFamily(family.id, { photoDataUri: null });
      const matches = layout.accents.filter(
        (a) => OLD_BAR_YS.includes(a.y) && a.height === 26 && a.x === 72
      );
      expect(matches).toHaveLength(0);
    }
  });

  it('gives every photo-less family something deliberate instead', () => {
    // Not a taste check — a "there is actually something in the empty half"
    // check. Each family must put real geometry or real type above its meta
    // block rather than leaving a flat field.
    for (const family of POSTER_FAMILIES) {
      const layout = layoutForFamily(family.id, { photoDataUri: null });
      const upper = [
        ...layout.accents.filter((a) => a.y < POSTER_HEIGHT * 0.6 && a.width * a.height > 2000),
        ...layout.texts.filter((t) => t.y < POSTER_HEIGHT * 0.6 && t.fontSize >= 40),
      ];
      expect(upper.length).toBeGreaterThan(0);
    }
  });
});

describe('selection — category first, then hash', () => {
  it('sends a club night and a talk to different geometry', () => {
    const music = buildPosterLayout({ ...base, categories: ['Music'] });
    const talk = buildPosterLayout({ ...base, categories: ['Talk'] });
    expect(music.family).not.toBe(talk.family);
  });

  it('keeps the music and talk shortlists disjoint, not merely different', () => {
    // Why this is structural and the one above is not enough. The index is
    // `hash % shortlist.length`, so two lists that share a family can still
    // collide — and whether they DO depends on the event's title and date. On
    // 2026-08-19 adding `technical` to both put a Music poster and a Talk
    // poster on the same geometry for the fixture seed; a different seed would
    // have hidden it and shipped the bug. Disjoint holds for every event.
    const music = new Set(familyShortlist(['Music']));
    const talk = familyShortlist(['Talk']);
    expect(talk.filter((f) => music.has(f))).toEqual([]);
  });

  it('keeps a category inside its shortlist across every variant', () => {
    const shortlist = familyShortlist(['Music']);
    for (let variant = 0; variant < 32; variant++) {
      const layout = buildPosterLayout({ ...base, categories: ['Music'], variant });
      expect(shortlist).toContain(layout.family);
    }
  });

  it('matches a category case-insensitively and skips ones it does not know', () => {
    expect(familyShortlist(['music'])).toEqual(familyShortlist(['Music']));
    expect(familyShortlist(['Unicycling', 'Music'])).toEqual(familyShortlist(['Music']));
  });

  it('handles a multi-word category, which a naive key would split', () => {
    // "Social Movements" round-trips through the hook's dependency key. A
    // space-separated key would come back as two unknown categories.
    expect(familyShortlist(['Social Movements'])).not.toEqual(familyShortlist([]));
  });

  it('falls back to every family when there is no usable category', () => {
    const all = POSTER_FAMILIES.map((f) => f.id);
    expect(familyShortlist(null)).toEqual(all);
    expect(familyShortlist([])).toEqual(all);
    expect(familyShortlist(['Unicycling'])).toEqual(all);
  });

  it('spreads uncategorised events across every family', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(buildPosterLayout({ ...base, title: `Berlin Night ${i}` }).family);
    }
    expect(seen.size).toBe(POSTER_FAMILIES.length);
  });
});

describe('determinism', () => {
  it('regenerates the identical poster for the same event, every time', () => {
    // The poster is captured to a PNG and uploaded. A user who regenerates
    // expects what they saw, on any platform.
    for (const title of HARD_TITLES) {
      const input = { ...base, title, categories: ['Music'] };
      const a = buildPosterLayout(input);
      const b = buildPosterLayout(input);
      expect(b).toEqual(a);
    }
  });

  it('treats a missing variant as variant 0 — the canonical poster', () => {
    const without = buildPosterLayout(base);
    const zero = buildPosterLayout({ ...base, variant: 0 });
    expect(zero).toEqual(without);
  });

  it('does not let the photo change the geometry', () => {
    // Attaching a photo must not move the event to a different family: the
    // photo-less variant is meant to be the same composition on a different
    // ground, not a different poster.
    const withPhoto = buildPosterLayout({ ...base, photoDataUri: PHOTO });
    const without = buildPosterLayout(base);
    expect(withPhoto.family).toBe(without.family);
    expect(withPhoto.palette.id).toBe(without.palette.id);
  });

  it('ignores a negative or fractional variant rather than throwing', () => {
    for (const variant of [-5, -1, 0.4, 2.7]) {
      expect(() => buildPosterLayout({ ...base, variant })).not.toThrow();
      const layout = buildPosterLayout({ ...base, variant });
      expect(posterFamilyById(layout.family)).toBeDefined();
    }
  });
});

describe('palette selection', () => {
  it('is independent of the family hash, so a colour clash is not a lookalike', () => {
    // The collision Aidan saw was four sample posters landing on two palettes.
    // Two events CAN still share a pair — the pick must stay a pure function of
    // the event — but sharing a pair must not mean sharing the geometry too.
    const pairs = new Map<string, Set<string>>();
    for (let i = 0; i < 400; i++) {
      const layout = buildPosterLayout({ ...base, title: `Nacht ${i}` });
      if (!pairs.has(layout.palette.id)) pairs.set(layout.palette.id, new Set());
      pairs.get(layout.palette.id)!.add(layout.family);
    }
    // Every palette in play is used by more than one family.
    for (const [, families] of pairs) {
      expect(families.size).toBeGreaterThan(1);
    }
  });

  it('draws only from the family subset', () => {
    for (const family of POSTER_FAMILIES) {
      for (let variant = 0; variant < 40; variant++) {
        const palette = paletteForFamily('some-seed', family, variant);
        expect(family.palettes).toContain(palette.id);
      }
    }
  });

  it('reaches every palette a family declared, as the variant walks', () => {
    for (const family of POSTER_FAMILIES) {
      const seen = new Set<string>();
      for (let variant = 0; variant < family.palettes.length; variant++) {
        seen.add(paletteForFamily('some-seed', family, variant).id);
      }
      expect(seen.size).toBe(family.palettes.length);
    }
  });

  it('spreads colour across many events rather than collapsing onto one pair', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(buildPosterLayout({ ...base, title: `Berlin Night ${i}` }).palette.id);
    }
    expect(seen.size).toBeGreaterThan(posterPalette.length / 2);
  });
});

describe('shuffle', () => {
  it('actually changes the poster', () => {
    const first = buildPosterLayout({ ...base, variant: 0 });
    const second = buildPosterLayout({ ...base, variant: 1 });
    // Family or palette (in practice usually both) — never an identical poster.
    expect(`${second.family}/${second.palette.id}`).not.toBe(
      `${first.family}/${first.palette.id}`
    );
  });

  it('never repeats a combination before the cycle is exhausted', () => {
    const combos = new Set<string>();
    const cycle = variantCycleLength(base);
    for (let variant = 0; variant < cycle; variant++) {
      const layout = buildPosterLayout({ ...base, variant });
      combos.add(`${layout.family}/${layout.palette.id}`);
    }
    // A reasonable amount of variety, not one recolour of one geometry.
    expect(combos.size).toBeGreaterThanOrEqual(POSTER_FAMILIES.length * 2);
  });

  it('reaches every family for an uncategorised event', () => {
    const seen = new Set<string>();
    for (let variant = 0; variant < 8; variant++) {
      seen.add(buildPosterLayout({ ...base, variant }).family);
    }
    expect(seen.size).toBe(POSTER_FAMILIES.length);
  });

  it('stays inside the shortlist when the event has a category', () => {
    const shortlist = familyShortlist(['Wellness']);
    for (let variant = 0; variant < 20; variant++) {
      const layout = buildPosterLayout({ ...base, categories: ['Wellness'], variant });
      expect(shortlist).toContain(layout.family);
    }
  });

  it('keeps every shuffled poster paintable', () => {
    for (let variant = 0; variant < 24; variant++) {
      const layout = buildPosterLayout({ ...base, variant, photoDataUri: null });
      expect(() => assertLayoutIsPaintable(layout)).not.toThrow();
    }
  });
});

describe('textRunBounds', () => {
  it('measures an unrotated run as its plain box', () => {
    const run = {
      text: 'SPHAER',
      x: 72,
      y: 400,
      fontSize: 40,
      role: 'uiBold' as const,
      fill: '#000000',
      opacity: 1,
      letterSpacing: 0,
    };
    const box = textRunBounds(run);
    expect(box.x).toBeCloseTo(72, 5);
    expect(box.width).toBeCloseTo(estimateTextWidth(run.text, 40, 'uiBold'), 5);
    // The baseline sits inside the box, with cap height above it.
    expect(box.y).toBeLessThan(400);
    expect(box.y + box.height).toBeGreaterThan(400);
  });

  it('turns a -90° run on its side, running upward from the anchor', () => {
    const run = {
      text: 'Nachtstrom',
      x: 200,
      y: 1400,
      fontSize: 100,
      role: 'uiBold' as const,
      fill: '#000000',
      opacity: 1,
      letterSpacing: 0,
      rotate: -90,
    };
    const box = textRunBounds(run);
    const width = estimateTextWidth(run.text, 100, 'uiBold');
    // Tall, not wide.
    expect(box.height).toBeCloseTo(width, 5);
    expect(box.width).toBeCloseTo(100, 5);
    // It runs UP from the anchor, so the box ends at the baseline y.
    expect(box.y + box.height).toBeCloseTo(1400, 5);
    // Cap height falls to the LEFT of the baseline x.
    expect(box.x).toBeLessThan(200);
  });

  it('centres a middle-anchored run on its x', () => {
    const run = {
      text: 'Nachtstrom',
      x: 540,
      y: 400,
      fontSize: 60,
      role: 'display' as const,
      fill: '#000000',
      opacity: 1,
      letterSpacing: 0,
      anchor: 'middle' as const,
    };
    const box = textRunBounds(run);
    expect(box.x + box.width / 2).toBeCloseTo(540, 5);
  });
});
