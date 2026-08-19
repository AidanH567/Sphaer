/**
 * What each of the map's three viewing options actually puts on the map.
 *
 * Pure, so it can be driven with fixtures and asserted on directly — the
 * map screen itself is a react-native-maps tree that tests can only poke
 * at through rendered output. Everything that decides WHICH pins appear
 * lives here; map.tsx only decides how they look.
 *
 * The filtering of events by the feed lens (search / neighbourhood /
 * categories / chips) happens BEFORE this — selectMapPins takes the
 * already-filtered set, exactly as map.tsx already computes it today.
 */

import type { EventWithRelations } from '@/types/event.types';
import type { MapMode, VenueWithMeta } from '@/types/venue.types';
import { venueSlug } from '@/utils/venue-slug';

export type MapPin =
  | {
      kind: 'event';
      /** Stable React key. Prefixed so an event and a venue can never collide. */
      key: string;
      id: string;
      lat: number;
      lng: number;
      event: EventWithRelations;
    }
  | {
      kind: 'venue';
      key: string;
      id: string;
      lat: number;
      lng: number;
      venue: VenueWithMeta;
    };

export interface MapPinInput {
  /** Events already narrowed by the feed's filters. */
  events: EventWithRelations[];
  /** Venues already narrowed by filterVenues, below. */
  venues: VenueWithMeta[];
  /** Venue ids this user has hearted. */
  savedVenueIds: ReadonlySet<string>;
  /** Event ids this user has bookmarked (the pre-existing saved_events). */
  savedEventIds: ReadonlySet<string>;
}

/** An event with usable coordinates. Narrows lat/lng from `number | null`. */
function hasCoords<T extends { lat: number | null; lng: number | null }>(
  row: T,
): row is T & { lat: number; lng: number } {
  return row.lat !== null && row.lng !== null;
}

/**
 * Which venue does this event sit at?
 *
 * `venue_id` is authoritative — it is the resolved FK. But the backfill has
 * not run yet and imported rows arrive with venue_id NULL forever, so we
 * fall back to matching `location_name` through the same slug normaliser
 * the database uses. That fallback is what makes venue mode useful on day
 * one, before a single row has been backfilled; it costs one slug per
 * event and is only ever consulted when the FK is absent.
 */
export function resolveEventVenueId(
  event: EventWithRelations & { venue_id?: string | null },
  venuesBySlug: ReadonlyMap<string, VenueWithMeta>,
): string | null {
  if (event.venue_id) return event.venue_id;
  const slug = venueSlug(event.location_name);
  if (slug === null) return null;
  return venuesBySlug.get(slug)?.id ?? null;
}

/** Index venues by slug once, so the fallback above is O(1) per event. */
export function indexVenuesBySlug(
  venues: readonly VenueWithMeta[],
): Map<string, VenueWithMeta> {
  const bySlug = new Map<string, VenueWithMeta>();
  for (const venue of venues) {
    if (venue.slug) bySlug.set(venue.slug, venue);
  }
  return bySlug;
}

/**
 * How many of the filtered events are on at each venue.
 * Returned as a plain Map so venue mode can label a pin "3 on".
 */
export function countEventsPerVenue(
  events: readonly (EventWithRelations & { venue_id?: string | null })[],
  venues: readonly VenueWithMeta[],
): Map<string, number> {
  const bySlug = indexVenuesBySlug(venues);
  const counts = new Map<string, number>();
  for (const event of events) {
    const venueId = resolveEventVenueId(event, bySlug);
    if (venueId === null) continue;
    counts.set(venueId, (counts.get(venueId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Narrow venues by the parts of the feed lens that mean anything for a
 * place: the search text, and the neighbourhood.
 *
 * Category chips and the time chips (tonight / this weekend) are properties
 * of an EVENT, not of a building — a venue is not "free" or "on tonight" —
 * so they are deliberately ignored here rather than silently emptying the
 * map when someone leaves a category selected and switches mode.
 */
export function filterVenues(
  venues: readonly VenueWithMeta[],
  lens: { search?: string; neighborhood?: string | null },
): VenueWithMeta[] {
  const q = (lens.search ?? '').trim().toLowerCase();
  const hood = (lens.neighborhood ?? '').trim().toLowerCase();

  return venues.filter((venue) => {
    if (q.length > 0) {
      const haystack = [venue.name, venue.address ?? '', venue.description ?? '']
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (hood.length > 0) {
      const structured = [venue.borough ?? '', venue.neighbourhood ?? '']
        .join(' ')
        .toLowerCase();
      const loose = `${venue.address ?? ''} ${venue.name}`.toLowerCase();
      if (!structured.includes(hood) && !loose.includes(hood)) return false;
    }
    return true;
  });
}

/**
 * The whole point of the file: given a mode, return exactly the pins to draw.
 *
 * Pins without coordinates are dropped in every mode — the same rule the map
 * has always applied to events (they still appear in the feed). Today that
 * silently removes 22 of the 70 venues the backfill would create; see
 * docs/venues-backfill.md.
 */
export function selectMapPins(mode: MapMode, input: MapPinInput): MapPin[] {
  const { events, venues, savedVenueIds, savedEventIds } = input;

  if (mode === 'activities') {
    // Unchanged behaviour: every filtered event that can be placed.
    return events.filter(hasCoords).map((event) => ({
      kind: 'event' as const,
      key: `event:${event.id}`,
      id: event.id,
      lat: event.lat,
      lng: event.lng,
      event,
    }));
  }

  if (mode === 'venues') {
    const counts = countEventsPerVenue(events, venues);
    return venues.filter(hasCoords).map((venue) => ({
      kind: 'venue' as const,
      key: `venue:${venue.id}`,
      id: venue.id,
      lat: venue.lat,
      lng: venue.lng,
      venue: {
        ...venue,
        is_saved: savedVenueIds.has(venue.id),
        event_count: counts.get(venue.id) ?? 0,
      },
    }));
  }

  // favourites — "my city". Hearted venues AND bookmarked events.
  const savedVenues = venues.filter((v) => savedVenueIds.has(v.id));
  const venuePins: MapPin[] = savedVenues.filter(hasCoords).map((venue) => ({
    kind: 'venue' as const,
    key: `venue:${venue.id}`,
    id: venue.id,
    lat: venue.lat,
    lng: venue.lng,
    venue: { ...venue, is_saved: true },
  }));

  // A saved event at an already-hearted venue would stack a second pin on
  // the identical coordinates and read as a rendering bug. The venue pin
  // wins — it is the more permanent thing, and tapping it leads to the
  // event anyway.
  const bySlug = indexVenuesBySlug(savedVenues);
  const coveredVenueIds = new Set(savedVenues.map((v) => v.id));

  const eventPins: MapPin[] = events
    .filter((event) => savedEventIds.has(event.id))
    .filter(hasCoords)
    .filter((event) => {
      const venueId = resolveEventVenueId(event, bySlug);
      return venueId === null || !coveredVenueIds.has(venueId);
    })
    .map((event) => ({
      kind: 'event' as const,
      key: `event:${event.id}`,
      id: event.id,
      lat: event.lat,
      lng: event.lng,
      event,
    }));

  return [...venuePins, ...eventPins];
}

/** Copy for the empty state, per mode. Kept next to the selection logic so
 *  a new mode cannot be added without deciding what its empty map says. */
export function emptyMapMessage(mode: MapMode): { title: string; body: string } {
  switch (mode) {
    case 'activities':
      return {
        title: 'Nothing on the map',
        body: 'No activities match your filters right now.',
      };
    case 'venues':
      return {
        title: 'No venues yet',
        body: 'Venues appear here as places get added to Sphaer.',
      };
    case 'favourites':
      return {
        title: 'Your city is empty',
        body: 'Heart a venue or save an activity and it shows up here.',
      };
  }
}
