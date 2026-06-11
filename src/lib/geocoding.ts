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
import {
  matchBerlinBorough,
  matchBerlinNeighborhood,
  ORTSTEIL_TO_BEZIRK,
  type BerlinBorough,
  type BerlinNeighborhood,
} from '@/constants/berlinNeighborhoods';

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
    // Diagnostic only — callers fail soft (event saves without coords).
    if (__DEV__) {
      console.warn('[geocoding] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY missing — cannot geocode.');
    }
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
      if (__DEV__) console.warn(`[geocoding] HTTP ${res.status} for "${query}"`);
      return null;
    }
    const json = (await res.json()) as GeocodeApiResponse;

    // ZERO_RESULTS is a valid (non-error) outcome — caller treats as null
    if (json.status === 'ZERO_RESULTS') return null;

    // OVER_QUERY_LIMIT / REQUEST_DENIED / INVALID_REQUEST: warn + null
    if (json.status !== 'OK') {
      if (__DEV__) {
        const errMsg = (json as { error_message?: string }).error_message;
        console.warn(
          `[geocoding] Google API status ${json.status} for "${query}"`,
          errMsg ?? '',
        );
      }
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
    if (__DEV__) console.warn(`[geocoding] fetch failed for "${query}"`, e);
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
  results: {
    formatted_address: string;
    geometry: {
      location: { lat: number; lng: number };
    };
    address_components?: {
      long_name: string;
      short_name: string;
      types: string[];
    }[];
  }[];
}

export interface ReverseGeocodeResult {
  /** Berlin Ortsteil (Kreuzberg, Mitte, ...) — only set when Google
   *  resolved that fine-grained level for these coords. */
  neighbourhood: BerlinNeighborhood | null;
  /** Berlin Bezirk (Friedrichshain-Kreuzberg, ...) — set whenever we can
   *  determine the borough, either directly from a Google component or
   *  derived from a resolved Ortsteil via ORTSTEIL_TO_BEZIRK. */
  borough: BerlinBorough | null;
}

/**
 * Reverse-geocode coordinates into Berlin Ortsteil + Bezirk. Used by the
 * location-onboarding flow to pre-filter the feed.
 *
 * Strategy: Google's reverse geocoding returns multiple address-component
 * granularities. We harvest both the Ortsteil tags
 * (`sublocality_level_1`, `neighborhood`) and the broader Bezirk tags
 * (`sublocality`, `administrative_area_level_2`). When only the Ortsteil
 * resolves we backfill the Bezirk via the static lookup; when only the
 * Bezirk resolves we leave neighbourhood null (don't pretend we know more
 * than Google told us). Returns both null on failure.
 */
export async function reverseGeocodeBerlinLocation(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult> {
  const empty: ReverseGeocodeResult = { neighbourhood: null, borough: null };

  const key = config.googleMapsApiKey;
  if (!key) {
    if (__DEV__) {
      console.warn('[geocoding] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY missing — cannot reverse geocode.');
    }
    return empty;
  }

  // We deliberately don't pass result_type — that filter forces a single
  // type and we want every level Google has for these coords so we can
  // pull both Ortsteil and Bezirk from the same response.
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?latlng=${lat},${lng}` +
    `&language=en` +
    `&key=${key}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (__DEV__) console.warn(`[geocoding] reverse HTTP ${res.status}`);
      return empty;
    }
    const json = (await res.json()) as GeocodeApiResponse;

    if (json.status === 'ZERO_RESULTS') return empty;
    if (json.status !== 'OK') {
      if (__DEV__) {
        const errMsg = (json as { error_message?: string }).error_message;
        console.warn(`[geocoding] reverse API status ${json.status}`, errMsg ?? '');
      }
      return empty;
    }

    let neighbourhood: BerlinNeighborhood | null = null;
    let borough: BerlinBorough | null = null;

    // Scan every result + every component until we've filled both levels.
    // Different results sometimes carry different granularities for the
    // same point (e.g. street-level result vs locality-level result).
    for (const result of json.results) {
      for (const c of result.address_components ?? []) {
        if (
          !neighbourhood &&
          (c.types.includes('sublocality_level_1') || c.types.includes('neighborhood'))
        ) {
          neighbourhood = matchBerlinNeighborhood(c.long_name);
        }
        if (
          !borough &&
          (c.types.includes('sublocality') || c.types.includes('administrative_area_level_2'))
        ) {
          borough = matchBerlinBorough(c.long_name);
        }
      }
      if (neighbourhood && borough) break;
    }

    // Derive Bezirk from Ortsteil if Google didn't tag the broader level.
    if (neighbourhood && !borough) {
      borough = ORTSTEIL_TO_BEZIRK[neighbourhood];
    }

    return { neighbourhood, borough };
  } catch (e) {
    if (__DEV__) console.warn('[geocoding] reverse fetch failed', e);
    return empty;
  }
}
