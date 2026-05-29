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
