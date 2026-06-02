/**
 * Thin wrapper around the Google Geocoding REST API.
 *
 * Uses the same `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` that the Maps SDK +
 * web tiles consume. Geocoding API is a *separate* product from Maps
 * JS / Maps SDK and must be enabled in the same Google Cloud project:
 *   Google Cloud Console → APIs & Services → Library →
 *     search "Geocoding API" → Enable.
 *
 * Fail-soft: returns `null` on any failure (API disabled, rate limit,
 * no result, network error). Callers degrade gracefully — Create
 * Activity still saves the event with `lat: null, lng: null` if
 * geocoding can't resolve, the event just doesn't appear on the map.
 */

import { config } from '@/constants/config';

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** The geocoder's canonical formatted address. Useful for storing back. */
  formatted_address: string;
}

/**
 * Geocode a free-text address (e.g. "Maybachufer 31, Berlin") into
 * latitude / longitude. Berlin is biased via `bounds` so partial inputs
 * like "Kreuzberg" resolve to Berlin's neighbourhood rather than a
 * similarly-named place elsewhere.
 */
export async function geocodeAddress(
  address: string
): Promise<GeocodeResult | null> {
  const key = config.googleMapsApiKey;
  if (!key) {
    console.warn('[geocoding] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY missing — cannot geocode.');
    return null;
  }
  const query = address.trim();
  if (query.length === 0) return null;

  // Loose viewport bias to Berlin (NE + SW corners). The geocoder still
  // returns results outside, but prefers ones inside.
  const berlinBias = 'bounds=52.338%2C13.088%7C52.675%2C13.761';

  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?address=${encodeURIComponent(query)}` +
    `&${berlinBias}` +
    `&region=de` +
    `&key=${key}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[geocoding] HTTP ${res.status} for "${query}"`);
      return null;
    }
    const json = (await res.json()) as GeocodeApiResponse;

    // ZERO_RESULTS is a valid (non-error) outcome — caller treats as null
    if (json.status === 'ZERO_RESULTS') return null;

    // OVER_QUERY_LIMIT / REQUEST_DENIED / INVALID_REQUEST: warn + null
    if (json.status !== 'OK') {
      const errMsg = (json as { error_message?: string }).error_message;
      console.warn(
        `[geocoding] Google API status ${json.status} for "${query}"`,
        errMsg ?? '',
      );
      return null;
    }

    const first = json.results?.[0];
    if (!first) return null;

    return {
      lat: first.geometry.location.lat,
      lng: first.geometry.location.lng,
      formatted_address: first.formatted_address,
    };
  } catch (e) {
    console.warn(`[geocoding] fetch failed for "${query}"`, e);
    return null;
  }
}

interface GeocodeApiResponse {
  status:
    | 'OK'
    | 'ZERO_RESULTS'
    | 'OVER_DAILY_LIMIT'
    | 'OVER_QUERY_LIMIT'
    | 'REQUEST_DENIED'
    | 'INVALID_REQUEST'
    | 'UNKNOWN_ERROR';
  results: Array<{
    formatted_address: string;
    geometry: {
      location: { lat: number; lng: number };
    };
    address_components?: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
  }>;
}

/**
 * Reverse-geocode coordinates into a Berlin Ortsteil (neighbourhood) name
 * like "Kreuzberg" or "Mitte". Used by the location-onboarding flow to
 * pre-filter the feed.
 *
 * Strategy: Google's reverse geocoding returns multiple address-component
 * granularities. For Berlin neighbourhoods we want the finest political
 * subdivision below the city itself — usually `sublocality_level_1`
 * (e.g. "Kreuzberg" inside the borough "Friedrichshain-Kreuzberg"). We
 * fall back through `sublocality` then `neighborhood` for places Google
 * tags differently. Returns null on any failure or if no neighbourhood
 * component is found.
 */
export async function reverseGeocodeNeighbourhood(
  lat: number,
  lng: number
): Promise<string | null> {
  const key = config.googleMapsApiKey;
  if (!key) {
    console.warn('[geocoding] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY missing — cannot reverse geocode.');
    return null;
  }

  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?latlng=${lat},${lng}` +
    `&result_type=sublocality_level_1|sublocality|neighborhood` +
    `&language=en` +
    `&key=${key}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[geocoding] reverse HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as GeocodeApiResponse;

    if (json.status === 'ZERO_RESULTS') return null;
    if (json.status !== 'OK') {
      const errMsg = (json as { error_message?: string }).error_message;
      console.warn(`[geocoding] reverse API status ${json.status}`, errMsg ?? '');
      return null;
    }

    // Preference order: sublocality_level_1 > sublocality > neighborhood.
    // Google sometimes returns multiple candidates; we pick the first
    // matching the tightest preferred type.
    const preferOrder = ['sublocality_level_1', 'sublocality', 'neighborhood'];
    for (const preferred of preferOrder) {
      for (const result of json.results) {
        const component = result.address_components?.find((c) =>
          c.types.includes(preferred)
        );
        if (component?.long_name) return component.long_name;
      }
    }
    return null;
  } catch (e) {
    console.warn('[geocoding] reverse fetch failed', e);
    return null;
  }
}
