/**
 * Wrappers around the Google Places (legacy v3) Autocomplete + Details
 * REST APIs. Used by AddressAutocompleteInput to power typeahead address
 * search on Create Activity.
 *
 * Uses the same EXPO_PUBLIC_GOOGLE_MAPS_API_KEY that Maps + Geocoding
 * already consume. Places API is a *separate* product enablement:
 *   Google Cloud → APIs & Services → Library → search "Places API"
 *   → Enable.  (If you see REQUEST_DENIED on the first autocomplete
 *    call, that's the missing enable.)
 *
 * Berlin viewport-biased so partial inputs like "Okerstraße" surface
 * the Neukölln street before similarly-named places elsewhere.
 *
 * Fail-soft: every function returns null / [] on any error so the
 * caller (autocomplete UI) degrades gracefully — no crashing dropdowns.
 */

import { config } from '@/constants/config';
import { matchBerlinNeighborhood } from '@/constants/berlinNeighborhoods';

export interface PlaceSuggestion {
  place_id: string;
  /** Bold-highlighted name part (e.g. "Okerstraße 14"). */
  main_text: string;
  /** Rest of the address (e.g. "12049 Berlin, Germany"). */
  secondary_text: string;
}

export interface PlaceDetails {
  place_id: string;
  /** Google's canonical formatted address. */
  formatted_address: string;
  /** Name of the place if it has one (e.g. "Berghain"). Useful for
   *  filling `location_name`. */
  name: string | null;
  lat: number;
  lng: number;
  /** Best Berlin Ortsteil match from our 26-neighborhood list, or null
   *  if the API result didn't yield anything mappable. */
  neighbourhood: string | null;
}

const BERLIN_BIAS_LOCATION = '52.52,13.405';
const BERLIN_BIAS_RADIUS = 20000; // metres

// ─── Autocomplete (typeahead) ────────────────────────────────────────────────

/**
 * Live address suggestions for a partial query. Caller is responsible
 * for debouncing input changes — typically 250–300ms.
 *
 * Returns up to 5 suggestions, biased to Berlin / Germany. Caller renders
 * `main_text` + `secondary_text` and uses `place_id` to fetch full
 * details on tap (see getPlaceDetails).
 */
export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  const key = config.googleMapsApiKey;
  if (!key) {
    console.warn('[places] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY missing — cannot search.');
    return [];
  }
  const q = query.trim();
  if (q.length < 2) return [];

  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
    `?input=${encodeURIComponent(q)}` +
    `&types=geocode` +
    `&components=country:de` +
    `&location=${BERLIN_BIAS_LOCATION}` +
    `&radius=${BERLIN_BIAS_RADIUS}` +
    `&language=en` +
    `&key=${key}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[places] autocomplete HTTP ${res.status}`);
      return [];
    }
    const json = (await res.json()) as AutocompleteResponse;

    if (json.status === 'ZERO_RESULTS') return [];

    if (json.status !== 'OK') {
      const errMsg = (json as { error_message?: string }).error_message;
      console.warn(`[places] autocomplete status ${json.status}`, errMsg ?? '');
      return [];
    }

    return (json.predictions ?? []).slice(0, 5).map((p) => ({
      place_id: p.place_id,
      main_text: p.structured_formatting?.main_text ?? p.description,
      secondary_text: p.structured_formatting?.secondary_text ?? '',
    }));
  } catch (e) {
    console.warn('[places] autocomplete fetch failed', e);
    return [];
  }
}

// ─── Place Details ───────────────────────────────────────────────────────────

/**
 * Fetch the full details for a place_id chosen from suggestions. Returns
 * lat/lng + formatted_address + a normalised Berlin neighbourhood.
 *
 * Neighbourhood extraction tries the Google address_components in order:
 *   sublocality_level_1 → neighborhood → political → administrative_area_level_3
 * Then runs the candidate through matchBerlinNeighborhood() to canonicalise
 * to our 26-name list (handles "Berlin Kreuzberg" → "Kreuzberg", etc.).
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const key = config.googleMapsApiKey;
  if (!key) {
    console.warn('[places] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY missing — cannot fetch details.');
    return null;
  }

  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=formatted_address,geometry,address_components,name` +
    `&language=en` +
    `&key=${key}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[places] details HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as DetailsResponse;

    if (json.status !== 'OK' || !json.result) {
      const errMsg = (json as { error_message?: string }).error_message;
      console.warn(`[places] details status ${json.status}`, errMsg ?? '');
      return null;
    }

    const r = json.result;
    const loc = r.geometry?.location;
    if (!loc) return null;

    const neighbourhood = extractNeighbourhood(r.address_components ?? []);

    return {
      place_id: placeId,
      formatted_address: r.formatted_address ?? '',
      // Only treat `name` as a venue name if it isn't just the street
      // (Google echoes the address as the name for plain street results).
      name: r.name && !r.formatted_address?.startsWith(r.name) ? r.name : null,
      lat: loc.lat,
      lng: loc.lng,
      neighbourhood,
    };
  } catch (e) {
    console.warn('[places] details fetch failed', e);
    return null;
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

/**
 * Walk Google's address_components looking for the most specific Berlin
 * Ortsteil. Tries the most-specific component types first, then runs
 * each candidate through our canonicalisation map.
 */
function extractNeighbourhood(components: AddressComponent[]): string | null {
  const candidateTypes = [
    'sublocality_level_1',
    'sublocality',
    'neighborhood',
    'political',
    'administrative_area_level_3',
  ];

  for (const t of candidateTypes) {
    const match = components.find((c) => c.types.includes(t));
    if (!match) continue;
    const canonical = matchBerlinNeighborhood(match.long_name);
    if (canonical) return canonical;
  }
  return null;
}

interface AutocompleteResponse {
  status:
    | 'OK'
    | 'ZERO_RESULTS'
    | 'OVER_QUERY_LIMIT'
    | 'REQUEST_DENIED'
    | 'INVALID_REQUEST'
    | 'UNKNOWN_ERROR';
  predictions?: Array<{
    place_id: string;
    description: string;
    structured_formatting?: {
      main_text: string;
      secondary_text: string;
    };
  }>;
}

interface DetailsResponse {
  status:
    | 'OK'
    | 'ZERO_RESULTS'
    | 'NOT_FOUND'
    | 'OVER_QUERY_LIMIT'
    | 'REQUEST_DENIED'
    | 'INVALID_REQUEST'
    | 'UNKNOWN_ERROR';
  result?: {
    formatted_address?: string;
    name?: string;
    geometry?: { location: { lat: number; lng: number } };
    address_components?: AddressComponent[];
  };
}
