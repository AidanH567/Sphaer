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
import {
  matchBerlinBorough,
  matchBerlinNeighborhood,
  ORTSTEIL_TO_BEZIRK,
  type BerlinBorough,
  type BerlinNeighborhood,
} from '@/constants/berlinNeighborhoods';

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
  /** Berlin Bezirk (borough) — broader than neighbourhood. Filled even
   *  when neighbourhood is null (e.g. Google only resolved that point to
   *  "Friedrichshain-Kreuzberg" without a specific sub-area). */
  borough: string | null;
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

    const { ortsteil, bezirk } = extractBerlinLocation(json.addressComponents ?? []);
    return {
      place_id: json.id ?? placeId,
      formatted_address: formatted,
      name: venueName,
      lat: loc.latitude,
      lng: loc.longitude,
      neighbourhood: ortsteil,
      borough: bezirk,
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

/**
 * Pulls Berlin Ortsteil + Bezirk from Google's address_components.
 *
 * Why both passes:
 *   - `sublocality_level_1` and `neighborhood` are Google's tags for the
 *     finer Ortsteil ("Kreuzberg"). When present, we try to match against
 *     our canonical 26-item list.
 *   - `sublocality` (without _level_1) is usually the Bezirk
 *     ("Friedrichshain-Kreuzberg"). `administrative_area_level_2` also
 *     sometimes carries the Bezirk depending on the address.
 *
 * If we got an Ortsteil but Google didn't tag a Bezirk separately, we
 * fill it via the static ORTSTEIL_TO_BEZIRK map so callers always have
 * the broader level too.
 */
function extractBerlinLocation(
  components: AddressComponentNew[]
): { ortsteil: BerlinNeighborhood | null; bezirk: BerlinBorough | null } {
  let ortsteil: BerlinNeighborhood | null = null;
  let bezirk: BerlinBorough | null = null;

  for (const c of components) {
    if (!ortsteil && (c.types.includes('sublocality_level_1') || c.types.includes('neighborhood'))) {
      ortsteil = matchBerlinNeighborhood(c.longText);
    }
    if (!bezirk && (c.types.includes('sublocality') || c.types.includes('administrative_area_level_2'))) {
      // `sublocality` covers both Ortsteil and Bezirk granularities in
      // Google's data; matchBerlinBorough only returns a hit on the
      // canonical 12 Bezirk names, so it's safe to call here.
      bezirk = matchBerlinBorough(c.longText);
    }
  }

  // Backfill: if we resolved an Ortsteil but Google didn't surface a
  // Bezirk component, derive it from our static map.
  if (ortsteil && !bezirk) {
    bezirk = ORTSTEIL_TO_BEZIRK[ortsteil];
  }

  return { ortsteil, bezirk };
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
