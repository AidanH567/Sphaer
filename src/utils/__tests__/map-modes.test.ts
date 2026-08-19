import {
  selectMapPins,
  filterVenues,
  countEventsPerVenue,
  resolveEventVenueId,
  indexVenuesBySlug,
  emptyMapMessage,
} from '../map-modes';
import type { EventWithRelations } from '@/types/event.types';
import type { VenueWithMeta } from '@/types/venue.types';

/**
 * The three map modes, driven with fixtures taken from the REAL production
 * data (read-only, 2026-08-18): Privatclub Berlin and Il Kino are the two
 * venues the aggregator actually writes (51 and 43 events respectively),
 * Tresor and SO36 are human-posted, and Tempelhofer Feld is a real event
 * location that is deliberately NOT a venue.
 *
 * Each test asserts what the mode RETURNS, not that it ran.
 */

function evt(over: Partial<EventWithRelations> & { id: string }): EventWithRelations {
  return {
    title: `Event ${over.id}`,
    location_name: over.location_name ?? null,
    lat: over.lat ?? null,
    lng: over.lng ?? null,
    creator_id: 'user-1',
    creator: null,
    circle: null,
    ...over,
  } as EventWithRelations;
}

function venue(over: Partial<VenueWithMeta> & { id: string; name: string; slug: string }): VenueWithMeta {
  return {
    address: null,
    lat: null,
    lng: null,
    borough: null,
    neighbourhood: null,
    description: null,
    image_url: null,
    website_url: null,
    created_by: null,
    created_at: '2026-08-18T00:00:00Z',
    updated_at: '2026-08-18T00:00:00Z',
    ...over,
  } as VenueWithMeta;
}

// --- Real coordinates, straight out of production -------------------------
const PRIVATCLUB = venue({
  id: 'v-privatclub',
  name: 'Privatclub Berlin',
  slug: 'privatclub',
  address: 'Skalitzer Straße 85-86, 10997, Berlin',
  lat: 52.5013,
  lng: 13.429,
  borough: 'Friedrichshain-Kreuzberg',
});
const IL_KINO = venue({
  id: 'v-ilkino',
  name: 'Il Kino',
  slug: 'il kino',
  address: 'Nansenstraße 22, 12047 Berlin',
  lat: 52.489,
  lng: 13.4319,
  borough: 'Neukölln',
});
const TRESOR = venue({
  id: 'v-tresor',
  name: 'Tresor',
  slug: 'tresor',
  address: 'Köpenicker Str. 70, 10179 Berlin',
  lat: 52.5111,
  lng: 13.4179,
  borough: 'Mitte',
});
/** Real production venue with NO coordinates — 22 of 70 look like this. */
const KRAFTWERK = venue({ id: 'v-kraftwerk', name: 'Kraftwerk Berlin', slug: 'kraftwerk' });

const ALL_VENUES = [PRIVATCLUB, IL_KINO, TRESOR, KRAFTWERK];

// Imported rows: venue_id is NULL (the aggregator never sets it) and the
// only link is location_name.
const IMPORTED_PRIVATCLUB = evt({
  id: 'e-imp-1',
  title: 'Konzert im Privatclub',
  location_name: 'Privatclub Berlin',
  lat: 52.5013,
  lng: 13.429,
  source: 'tina:jsonld',
});
const IMPORTED_ILKINO = evt({
  id: 'e-imp-2',
  title: 'Spätvorstellung',
  location_name: 'Il Kino',
  lat: 52.489,
  lng: 13.4319,
  source: 'tina:jsonld',
});
// Human row that HAS been backfilled — carries the FK.
const HUMAN_TRESOR = evt({
  id: 'e-tresor',
  title: 'Tresor night',
  location_name: 'Tresor',
  lat: 52.5111,
  lng: 13.4179,
  venue_id: 'v-tresor',
} as Partial<EventWithRelations> & { id: string });
// A real event that is legitimately not at a venue, and never will be.
const PARK = evt({
  id: 'e-park',
  title: 'Picnic',
  location_name: 'Tempelhofer Feld',
  lat: 52.4736,
  lng: 13.4017,
});
// A real event with no coordinates — must be dropped from every mode.
const NO_COORDS = evt({ id: 'e-nocoords', title: 'Somewhere', location_name: 'silent green' });

const ALL_EVENTS = [IMPORTED_PRIVATCLUB, IMPORTED_ILKINO, HUMAN_TRESOR, PARK, NO_COORDS];

const NONE: ReadonlySet<string> = new Set();

describe('activities mode', () => {
  it('returns one event pin per mappable event and nothing else', () => {
    const pins = selectMapPins('activities', {
      events: ALL_EVENTS,
      venues: ALL_VENUES,
      savedVenueIds: NONE,
      savedEventIds: NONE,
    });

    expect(pins).toHaveLength(4);
    expect(pins.every((p) => p.kind === 'event')).toBe(true);
    expect(pins.map((p) => p.id).sort()).toEqual(
      ['e-imp-1', 'e-imp-2', 'e-park', 'e-tresor'].sort(),
    );
    // The coordinate-less event is gone.
    expect(pins.map((p) => p.id)).not.toContain('e-nocoords');
  });

  it('ignores venues entirely — this is the behaviour the map had before', () => {
    const pins = selectMapPins('activities', {
      events: [IMPORTED_PRIVATCLUB],
      venues: ALL_VENUES,
      savedVenueIds: new Set(['v-tresor', 'v-privatclub']),
      savedEventIds: NONE,
    });
    expect(pins).toHaveLength(1);
    expect(pins[0]).toMatchObject({ kind: 'event', id: 'e-imp-1', lat: 52.5013, lng: 13.429 });
  });
});

describe('venues mode', () => {
  it('returns one pin per mappable venue, never an event pin', () => {
    const pins = selectMapPins('venues', {
      events: ALL_EVENTS,
      venues: ALL_VENUES,
      savedVenueIds: NONE,
      savedEventIds: NONE,
    });

    expect(pins.every((p) => p.kind === 'venue')).toBe(true);
    // Kraftwerk has no coordinates, so 3 of the 4 venues are mappable.
    expect(pins).toHaveLength(3);
    expect(pins.map((p) => p.id).sort()).toEqual(['v-ilkino', 'v-privatclub', 'v-tresor']);
  });

  it('counts the filtered events at each venue, matching imports by name and humans by FK', () => {
    const pins = selectMapPins('venues', {
      events: ALL_EVENTS,
      venues: ALL_VENUES,
      savedVenueIds: NONE,
      savedEventIds: NONE,
    });
    const counts = Object.fromEntries(
      pins.map((p) => [p.id, p.kind === 'venue' ? p.venue.event_count : -1]),
    );

    // Imported rows carry venue_id NULL — matched through the slug fallback.
    expect(counts['v-privatclub']).toBe(1);
    expect(counts['v-ilkino']).toBe(1);
    // Backfilled row matched by the FK.
    expect(counts['v-tresor']).toBe(1);
  });

  it('reflects the feed filter: narrowing events changes the counts, not the pins', () => {
    const pins = selectMapPins('venues', {
      events: [IMPORTED_PRIVATCLUB], // as if a search narrowed the feed
      venues: ALL_VENUES,
      savedVenueIds: NONE,
      savedEventIds: NONE,
    });

    // Every mappable venue is still on the map — a place does not vanish
    // because nothing is on there tonight.
    expect(pins).toHaveLength(3);
    const byId = Object.fromEntries(
      pins.map((p) => [p.id, p.kind === 'venue' ? p.venue.event_count : -1]),
    );
    expect(byId['v-privatclub']).toBe(1);
    expect(byId['v-ilkino']).toBe(0);
    expect(byId['v-tresor']).toBe(0);
  });

  it('marks which venues the user has hearted', () => {
    const pins = selectMapPins('venues', {
      events: ALL_EVENTS,
      venues: ALL_VENUES,
      savedVenueIds: new Set(['v-tresor']),
      savedEventIds: NONE,
    });
    const saved = pins.filter((p) => p.kind === 'venue' && p.venue.is_saved);
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe('v-tresor');
  });
});

describe('favourites mode ("my city")', () => {
  it('returns only what the user saved — hearted venues and bookmarked events', () => {
    const pins = selectMapPins('favourites', {
      events: ALL_EVENTS,
      venues: ALL_VENUES,
      savedVenueIds: new Set(['v-ilkino']),
      savedEventIds: new Set(['e-park']),
    });

    expect(pins.map((p) => p.key).sort()).toEqual(['event:e-park', 'venue:v-ilkino']);
  });

  it('is empty when nothing is saved, even with a full city loaded', () => {
    const pins = selectMapPins('favourites', {
      events: ALL_EVENTS,
      venues: ALL_VENUES,
      savedVenueIds: NONE,
      savedEventIds: NONE,
    });
    expect(pins).toEqual([]);
  });

  it('does not stack a saved event on top of the saved venue it happens at', () => {
    // Both the venue and an event there are saved. Two pins at identical
    // coordinates would read as a rendering bug; the venue pin wins.
    const pins = selectMapPins('favourites', {
      events: [IMPORTED_PRIVATCLUB],
      venues: ALL_VENUES,
      savedVenueIds: new Set(['v-privatclub']),
      savedEventIds: new Set(['e-imp-1']),
    });

    expect(pins).toHaveLength(1);
    expect(pins[0]).toMatchObject({ kind: 'venue', id: 'v-privatclub' });
  });

  it('keeps a saved event whose venue is NOT saved', () => {
    const pins = selectMapPins('favourites', {
      events: [IMPORTED_PRIVATCLUB, PARK],
      venues: ALL_VENUES,
      savedVenueIds: new Set(['v-tresor']),
      savedEventIds: new Set(['e-imp-1', 'e-park']),
    });

    expect(pins.map((p) => p.key).sort()).toEqual([
      'event:e-imp-1',
      'event:e-park',
      'venue:v-tresor',
    ]);
  });

  it('drops saved things that cannot be placed on a map', () => {
    const pins = selectMapPins('favourites', {
      events: [NO_COORDS],
      venues: [KRAFTWERK],
      savedVenueIds: new Set(['v-kraftwerk']),
      savedEventIds: new Set(['e-nocoords']),
    });
    expect(pins).toEqual([]);
  });
});

describe('event → venue resolution', () => {
  const bySlug = indexVenuesBySlug(ALL_VENUES);

  it('prefers the FK when the row has been backfilled', () => {
    expect(resolveEventVenueId(HUMAN_TRESOR, bySlug)).toBe('v-tresor');
  });

  it('falls back to the slug for imported rows, which never carry a FK', () => {
    expect(resolveEventVenueId(IMPORTED_PRIVATCLUB, bySlug)).toBe('v-privatclub');
  });

  it('matches a feed spelling variant to the same venue', () => {
    // The exact case the brief warned about: the feed drops "Berlin".
    const variant = evt({ id: 'e-var', location_name: 'Privatclub', lat: 52.5, lng: 13.4 });
    expect(resolveEventVenueId(variant, bySlug)).toBe('v-privatclub');
  });

  it('returns null for an event that is not at any known venue', () => {
    expect(resolveEventVenueId(PARK, bySlug)).toBeNull();
    expect(resolveEventVenueId(evt({ id: 'x', location_name: null }), bySlug)).toBeNull();
  });

  it('counts multiple events at one venue', () => {
    const many = [
      IMPORTED_PRIVATCLUB,
      evt({ id: 'e2', location_name: 'Privatclub', lat: 52.5, lng: 13.4 }),
      evt({ id: 'e3', location_name: 'PRIVATCLUB BERLIN', lat: 52.5, lng: 13.4 }),
    ];
    expect(countEventsPerVenue(many, ALL_VENUES).get('v-privatclub')).toBe(3);
  });
});

describe('filterVenues', () => {
  it('matches the search text against name, address and description', () => {
    expect(filterVenues(ALL_VENUES, { search: 'tresor' }).map((v) => v.id)).toEqual(['v-tresor']);
    expect(filterVenues(ALL_VENUES, { search: 'Nansenstraße' }).map((v) => v.id)).toEqual([
      'v-ilkino',
    ]);
  });

  it('narrows by neighbourhood using the structured borough first', () => {
    expect(filterVenues(ALL_VENUES, { neighborhood: 'Neukölln' }).map((v) => v.id)).toEqual([
      'v-ilkino',
    ]);
  });

  it('ignores category and time chips — a building is not "on tonight"', () => {
    // filterVenues only accepts search + neighborhood, so leaving a
    // category selected cannot empty the venues map.
    expect(filterVenues(ALL_VENUES, {})).toHaveLength(4);
    expect(filterVenues(ALL_VENUES, { search: '', neighborhood: null })).toHaveLength(4);
  });
});

describe('empty state copy', () => {
  it('says something different, and mode-appropriate, for each mode', () => {
    const titles = (['activities', 'venues', 'favourites'] as const).map(
      (m) => emptyMapMessage(m).title,
    );
    expect(new Set(titles).size).toBe(3);
    expect(emptyMapMessage('favourites').body).toMatch(/heart/i);
  });
});
