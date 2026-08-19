import { venueSlug, sameVenue } from '../venue-slug';

/**
 * venueSlug() is the client mirror of SQL `public.venue_slug()`
 * (20260818000000_venues_and_favourites.sql). This file is the contract
 * between them: every case below was run against the REAL production
 * database read-only on 2026-08-18 and the SQL produced the same string.
 * If you change one implementation and this file goes red, the two have
 * drifted and the unique index will start disagreeing with the app.
 *
 * The venue names are all real rows from production's events.location_name.
 */
describe('venueSlug', () => {
  it('lowercases, trims and collapses punctuation', () => {
    expect(venueSlug('  Trauma Bar und Kino ')).toBe('trauma bar und kino');
    expect(venueSlug('Birgit & Bier')).toBe('birgit bier');
    expect(venueSlug('betahaus | Kreuzberg')).toBe('betahaus kreuzberg');
    // "Berlin" in the MIDDLE is part of the name and is kept — only a
    // leading or trailing one is noise.
    expect(venueSlug('Funkhaus Berlin (Studio 4)')).toBe('funkhaus berlin studio 4');
  });

  it('expands German umlauts the way they are typed in ASCII, not by dropping them', () => {
    // The decisive case. Production already contains "Arena Neukoelln",
    // hand-typed with "oe" — so the ASCII a feed or a human writes is the
    // EXPANSION, and ü→u would fail to match it.
    expect(venueSlug('Kühlhaus Berlin')).toBe('kuehlhaus');
    expect(venueSlug('Kuehlhaus Berlin')).toBe('kuehlhaus');
    expect(venueSlug('Kühlhaus Berlin')).toBe(venueSlug('Kuehlhaus Berlin'));

    expect(venueSlug('Säälchen')).toBe('saeaelchen');
    expect(venueSlug('Berghain Säule')).toBe('berghain saeule');
    expect(venueSlug('Arena Neukölln')).toBe(venueSlug('Arena Neukoelln'));
  });

  it('folds the remaining Latin-1 accents', () => {
    expect(venueSlug('Factory Berlin Görlitzer Park')).toBe('factory berlin goerlitzer park');
    expect(venueSlug('Café Lichtblick')).toBe('cafe lichtblick');
  });

  it('treats a trailing or leading "Berlin" as noise', () => {
    // The exact variant the brief warned about: feeds publish both forms.
    expect(venueSlug('Privatclub Berlin')).toBe('privatclub');
    expect(venueSlug('Privatclub')).toBe('privatclub');
    expect(sameVenue('Privatclub Berlin', 'Privatclub')).toBe(true);

    expect(venueSlug('Berlin Philharmonie')).toBe('philharmonie');
    expect(venueSlug('Station Berlin')).toBe('station');
  });

  it('does NOT merge names that only share a first word', () => {
    // These are the families a human has to rule on — the normaliser must
    // not quietly decide for them. See docs/venues-backfill.md.
    expect(sameVenue('Kraftwerk Berlin', 'Kraftwerk Mitte')).toBe(false);
    expect(sameVenue('Kraftwerk Berlin', 'Kraftwerk Halle')).toBe(false);
    expect(sameVenue('Babylon Berlin', 'Babylon Kino')).toBe(false);
    expect(sameVenue('silent green', 'silent green Kulturquartier')).toBe(false);
    expect(sameVenue('Arena Halle', 'Arena Neukoelln')).toBe(false);
    // ...and genuinely different places that merely look similar stay apart.
    expect(sameVenue('Factory Berlin Mitte', 'Factory Berlin Görlitzer Park')).toBe(false);
    expect(sameVenue('Studio Eins', 'Studio Orbit')).toBe(false);
  });

  it('merges pure case and whitespace variants — the one merge in production today', () => {
    expect(sameVenue('Test', 'TEst')).toBe(true);
    expect(venueSlug('Test')).toBe('test');
  });

  it('returns null when nothing identifying survives', () => {
    expect(venueSlug(null)).toBeNull();
    expect(venueSlug(undefined)).toBeNull();
    expect(venueSlug('')).toBeNull();
    expect(venueSlug('   ')).toBeNull();
    expect(venueSlug('!!! ---')).toBeNull();
    // "Berlin" on its own survives: the strip only removes it as a leading
    // or trailing WORD alongside something else, so a venue actually named
    // "Berlin" keeps its identity rather than becoming NULL.
    expect(venueSlug('Berlin')).toBe('berlin');
  });

  it('sameVenue is false when either side has no identity', () => {
    expect(sameVenue(null, null)).toBe(false);
    expect(sameVenue('Tresor', null)).toBe(false);
    expect(sameVenue('', '')).toBe(false);
  });
});
