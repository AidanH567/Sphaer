/**
 * Wrappers around the **Google Places API (New)** — the v1 endpoints at
 * places.googleapis.com. The new API supports CORS for browser requests,
 * which the legacy maps.googleapis.com endpoints do not, so this works
 * uniformly on web + native via the same fetch implementation.
 *
 * IMPORTANT — different product from the legacy Places API:
 *   Google Cloud → APIs & Services → Library → search "Places API (New)"
 *     → Enable.
 *   The legacy "Places API" (no "New") will not work here.
 *
 * Auth: passed in the X-Goog-Api-Key header rather than as a query param.
 *
 * Berlin-biased so partial queries like "Okerstraße" surface the Neukölln
 * street before similarly-named places elsewhere.
 *
 * Fail-soft: every function returns null / [] on any error so the
 * autocomplete UI degrades gracefully.
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
   *  filling `location_name`. Null when the result is a plain address. */
  name: string | null;
  lat: number;
  lng: number;
  /** Best Berlin Ortsteil match from our 26-neighborhood list, or null. */
  neighbourhood: string | null;
}

const BERLIN_CENTER = { latitude: 52.52, longitude: 13.405 };
const BERLIN_RADIUS = 20000; // metres

// ─── Autocomplete (typeahead) ────────────────────────────────────────────────

/**
 * Live address suggestions for a partial query. Caller debounces input
 * changes (~280ms is standard).
 *
 * Uses POST + JSON body — the New API doesn't accept query-string params
 * for autocomplete. CORS-safe from web.
 */
export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  const key = config.googleMapsApiKey;
  if (!key) {
    console.warn('[places] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY missing — cannot search.');
    return [];
  }
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
      },
      body: JSON.stringify({
        input: q,
        languageCode: 'en',
        includedRegionCodes: ['de'],
        locationBias: {
          circle: {
            center: BERLIN_CENTER,
            radius: BERLIN_RADIUS,
          },
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.warn(`[places] autocomplete HTTP ${res.status}`, errBody.slice(0, 200));
      return [];
    }

    const json = (await res.json()) as AutocompleteResponse;
    const suggestions = json.suggestions ?? [];

    return suggestions.slice(0, 5).map((s) => {
      const p = s.placePrediction;
      return {
        place_id: p.placeId,
        main_text: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
        secondary_text: p.structuredFormat?.secondaryText?.text ?? '',
      };
    });
  } catch (e) {
    console.warn('[places] autocomplete fetch failed', e);
    return [];
  }
}

// ─── Place Details ───────────────────────────────────────────────────────────

/**
 * Fetch full details for a placeId chosen from suggestions. Uses GET +
 * X-Goog-FieldMask to control billing — only request the fields we
 * actually need.
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const key = config.googleMapsApiKey;
  if (!key) {
    console.warn('[places] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY missing — cannot fetch details.');
    return null;
  }

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': key,
          // FieldMask is mandatory — these are the fields we actually use.
          'X-Goog-FieldMask':
            'id,formattedAddress,location,addressComponents,displayName',
        },
      },
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.warn(`[places] details HTTP ${res.status}`, errBody.slice(0, 200));
      return null;
    }

    const json = (await res.json()) as DetailsResponse;
    const loc = json.location;
    if (!loc) return null;

    const formatted = json.formattedAddress ?? '';
    const displayName = json.displayName?.text ?? null;
    // Strip "name" when Google just echoes the address (plain street results).
    const venueName = displayName && !formatted.startsWith(displayName) ? displayName : null;

    return {
      place_id: json.id ?? placeId,
      formatted_address: formatted,
      name: venueName,
      lat: loc.latitude,
      lng: loc.longitude,
      neighbourhood: extractNeighbourhood(json.addressComponents ?? []),
    };
  } catch (e) {
    console.warn('[places] details fetch failed', e);
    return null;
  }
}

// ─── Internal ────────────────────────────────────────────────────────────────

interface AddressComponentNew {
  longText: string;
  shortText: string;
  types: string[];
}

function extractNeighbourhood(components: AddressComponentNew[]): string | null {
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
    const canonical = matchBerlinNeighborhood(match.longText);
    if (canonical) return canonical;
  }
  return null;
}

interface AutocompleteResponse {
  suggestions?: Array<{
    placePrediction: {
      placeId: string;
      text?: { text: string };
      structuredFormat?: {
        mainText?: { text: string };
        secondaryText?: { text: string };
      };
    };
  }>;
}

interface DetailsResponse {
  id?: string;
  formattedAddress?: string;
  displayName?: { text: string; languageCode?: string };
  location?: { latitude: number; longitude: number };
  addressComponents?: AddressComponentNew[];
}
