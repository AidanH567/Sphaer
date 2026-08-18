import {
  DEFAULT_FILTER_CATEGORIES,
  EVENT_CATEGORIES,
  LEGACY_CATEGORY_ALIASES,
} from '@/constants/categories';
import { familyShortlist } from '@/utils/poster-families';
import { coverFamilyShortlist } from '@/utils/cover-families';

/** The fourteen categories that shipped before Lara's sheet (2026-08-18). */
const OLD_FOURTEEN = [
  'Art',
  'Film',
  'Music',
  'Service',
  'Workshop',
  'Social Movements',
  'Coach',
  'Wellness',
  'Job',
  'Talk',
  'Meet',
  'Education',
  'Therapy',
  'Concert',
];

describe('EVENT_CATEGORIES', () => {
  it("is Lara's list, in her order and her wording", () => {
    // Written out rather than derived, on purpose: this is the one place that
    // states what the vocabulary is supposed to be, so an accidental edit to
    // the constant fails here instead of shipping.
    expect([...EVENT_CATEGORIES]).toEqual([
      'Art',
      'Film',
      'Music',
      'Wellbeing',
      'Performing Arts',
      'Craft',
      'Design, Illustration, Animation',
      'Photography',
      'Festivals',
      'Street Art',
      'Fashion',
      'Exhibitions',
      'Academic',
      'Tech',
      'Tattoo',
      'Gaming',
      'Jam Session',
      'Spiritual',
      'Talk',
      'Workshops',
      'Social movements',
      'Coaching',
      'Learning',
      'Meet Ups',
      'Food & Drinks',
      'Markets',
      'Pop-ups',
      'Literature',
      'Language',
      'Sports',
      'Outdoors',
      'Volunteering',
      'Neighbourhood',
      'Family & Kids',
      'Clubbing',
      'Queer life',
    ]);
  });

  it('has no duplicates', () => {
    expect(new Set(EVENT_CATEGORIES).size).toBe(EVENT_CATEGORIES.length);
  });

  it('no longer offers the two Lara asked to remove', () => {
    for (const gone of ['Service', 'Job', 'Jobs']) {
      expect(EVENT_CATEGORIES).not.toContain(gone);
    }
  });
});

describe('DEFAULT_FILTER_CATEGORIES', () => {
  it('is a strict subset of the full list', () => {
    for (const cat of DEFAULT_FILTER_CATEGORIES) {
      expect(EVENT_CATEGORIES).toContain(cat);
    }
    expect(DEFAULT_FILTER_CATEGORIES.length).toBeLessThan(EVENT_CATEGORIES.length);
  });

  it('keeps the full list’s order, so a chip never moves when the row expands', () => {
    const inFullOrder = EVENT_CATEGORIES.filter((c) =>
      DEFAULT_FILTER_CATEGORIES.includes(c),
    );
    expect([...DEFAULT_FILTER_CATEGORIES]).toEqual(inFullOrder);
  });

  it('stays short enough to be a row rather than a wall', () => {
    // The old row was 14 chips and nobody complained about its length; the
    // point of "More categories" is that adding 22 categories does not make
    // the default row any longer than what already shipped.
    expect(DEFAULT_FILTER_CATEGORIES.length).toBeLessThanOrEqual(OLD_FOURTEEN.length);
  });
});

describe('LEGACY_CATEGORY_ALIASES', () => {
  it('accounts for every one of the old fourteen', () => {
    for (const old of OLD_FOURTEEN) {
      const survived = (EVENT_CATEGORIES as readonly string[]).includes(old);
      const renamed = Object.prototype.hasOwnProperty.call(LEGACY_CATEGORY_ALIASES, old);
      // Either the name is still in the vocabulary, or it says where it went.
      // Never neither — that is how a category goes quietly missing.
      expect(survived || renamed).toBe(true);
      expect(survived && renamed).toBe(false);
    }
  });

  it('only maps names that are genuinely gone, and only onto names that exist', () => {
    for (const [old, next] of Object.entries(LEGACY_CATEGORY_ALIASES)) {
      expect(EVENT_CATEGORIES).not.toContain(old);
      if (next !== null) expect(EVENT_CATEGORIES).toContain(next);
    }
  });

  it('drops exactly the two Lara asked to remove and nothing else', () => {
    const dropped = Object.entries(LEGACY_CATEGORY_ALIASES)
      .filter(([, next]) => next === null)
      .map(([old]) => old);
    expect(dropped.sort()).toEqual(['Job', 'Service']);
  });
});

describe('legacy category data keeps working', () => {
  // `events.categories` is `text[]` with no CHECK constraint, so retired names
  // sit in production rows until the rename migration is applied by hand.
  // Nothing may start behaving differently in the meantime.

  it.each(OLD_FOURTEEN)('%s still resolves to a real poster shortlist', (old) => {
    // A shortlist of 2 means the category was recognised. The fallback for an
    // unknown category is all four families, which is what "the poster engine
    // stopped understanding this event" looks like.
    expect(familyShortlist([old])).toHaveLength(2);
  });

  it.each(OLD_FOURTEEN)('%s still resolves to a real cover shortlist', (old) => {
    expect(coverFamilyShortlist([old])).toHaveLength(2);
  });

  it('every current category resolves to a real poster shortlist too', () => {
    for (const cat of EVENT_CATEGORIES) {
      expect(familyShortlist([cat])).toHaveLength(2);
      expect(coverFamilyShortlist([cat])).toHaveLength(2);
    }
  });

  it('applying the rename migration cannot change a poster or a cover', () => {
    // The invariant the retired keys in poster-families/cover-families exist
    // to buy: a row rewritten from `Wellness` to `Wellbeing` must land on the
    // same composition it had before, or applying a data migration silently
    // redesigns 63 posters.
    for (const [old, next] of Object.entries(LEGACY_CATEGORY_ALIASES)) {
      if (next === null) continue;
      expect(familyShortlist([old])).toEqual(familyShortlist([next]));
      expect(coverFamilyShortlist([old])).toEqual(coverFamilyShortlist([next]));
    }
  });
});
