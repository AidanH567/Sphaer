/**
 * The "main" Berlin neighbourhoods used by the location filter on the
 * Explore page. Order roughly matches official Bezirk + central Ortsteil
 * order — central inner-ring first, then outer rings.
 *
 * For v1 the filter does a simple case-insensitive substring match
 * against an event's `address` / `location_name` — no geospatial joins,
 * no Bezirk lookup. Good enough until a real Places autocomplete lands.
 */
export const BERLIN_NEIGHBORHOODS = [
  'Mitte',
  'Tiergarten',
  'Hansaviertel',
  'Kreuzberg',
  'Friedrichshain',
  'Neukölln',
  'Prenzlauer Berg',
  'Wedding',
  'Charlottenburg',
  'Schöneberg',
  'Moabit',
  'Gesundbrunnen',
  'Pankow',
  'Weißensee',
  'Lichtenberg',
  'Rummelsburg',
  'Treptow',
  'Köpenick',
  'Wilmersdorf',
  'Steglitz',
  'Zehlendorf',
  'Tempelhof',
  'Reinickendorf',
  'Spandau',
  'Marzahn',
  'Hellersdorf',
] as const;

export type BerlinNeighborhood = (typeof BERLIN_NEIGHBORHOODS)[number];

/**
 * Normalise a free-text neighbourhood candidate (typically from Google's
 * `address_components`) to one of our 26 canonical names — or null if
 * we can't map it.
 *
 * Handles common Google quirks:
 *   "Berlin Kreuzberg" → "Kreuzberg"
 *   "Prenzlauer Berg, Pankow" → "Prenzlauer Berg"
 *   case differences, trailing whitespace, etc.
 */
export function matchBerlinNeighborhood(input: string | null | undefined): BerlinNeighborhood | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  if (normalized.length === 0) return null;

  // Direct: try each canonical name as a substring of the input
  for (const n of BERLIN_NEIGHBORHOODS) {
    if (normalized.includes(n.toLowerCase())) return n;
  }
  return null;
}
