/**
 * Berlin's official two-level location hierarchy:
 *
 *   Bezirk (borough)     12 administrative districts — what Google often
 *                        returns when it doesn't have a more specific tag
 *                        (e.g. "Friedrichshain-Kreuzberg")
 *   Ortsteil             ~96 named sub-areas; we curate a 26-item subset
 *                        that covers the central / culturally relevant
 *                        ones (e.g. "Kreuzberg", "Prenzlauer Berg")
 *
 * Events store BOTH levels: `events.borough` is required-where-known,
 * `events.neighbourhood` is set only when Google resolved that level.
 * The Explore filter accepts either — comparison logic in feed/index.tsx
 * + map screens uses the maps below to decide a Bezirk-level filter
 * matches every event in any of its constituent Ortsteils.
 *
 * Keep the SQL in 20260601300000_events_borough.sql and ORTSTEIL_TO_BEZIRK
 * here in lock-step — they're the two halves of the same lookup.
 */

// ── Boroughs (Bezirke) — the 12 administrative districts ─────────────────────

export const BERLIN_BOROUGHS = [
  'Mitte',
  'Friedrichshain-Kreuzberg',
  'Pankow',
  'Charlottenburg-Wilmersdorf',
  'Spandau',
  'Steglitz-Zehlendorf',
  'Tempelhof-Schöneberg',
  'Neukölln',
  'Treptow-Köpenick',
  'Marzahn-Hellersdorf',
  'Lichtenberg',
  'Reinickendorf',
] as const;

export type BerlinBorough = (typeof BERLIN_BOROUGHS)[number];

// ── Neighbourhoods (Ortsteile) — curated 26-item subset ──────────────────────

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

// ── Hierarchy lookups ────────────────────────────────────────────────────────

/** Ortsteil → its parent Bezirk. */
export const ORTSTEIL_TO_BEZIRK: Record<BerlinNeighborhood, BerlinBorough> = {
  Mitte: 'Mitte',
  Tiergarten: 'Mitte',
  Hansaviertel: 'Mitte',
  Wedding: 'Mitte',
  Moabit: 'Mitte',
  Gesundbrunnen: 'Mitte',
  Kreuzberg: 'Friedrichshain-Kreuzberg',
  Friedrichshain: 'Friedrichshain-Kreuzberg',
  Neukölln: 'Neukölln',
  'Prenzlauer Berg': 'Pankow',
  Pankow: 'Pankow',
  Weißensee: 'Pankow',
  Charlottenburg: 'Charlottenburg-Wilmersdorf',
  Wilmersdorf: 'Charlottenburg-Wilmersdorf',
  Schöneberg: 'Tempelhof-Schöneberg',
  Tempelhof: 'Tempelhof-Schöneberg',
  Lichtenberg: 'Lichtenberg',
  Rummelsburg: 'Lichtenberg',
  Treptow: 'Treptow-Köpenick',
  Köpenick: 'Treptow-Köpenick',
  Steglitz: 'Steglitz-Zehlendorf',
  Zehlendorf: 'Steglitz-Zehlendorf',
  Reinickendorf: 'Reinickendorf',
  Spandau: 'Spandau',
  Marzahn: 'Marzahn-Hellersdorf',
  Hellersdorf: 'Marzahn-Hellersdorf',
};

/** Bezirk → the (curated) Ortsteils it contains. Derived from
 *  ORTSTEIL_TO_BEZIRK at module load so the two maps can't drift. */
export const BEZIRK_TO_ORTSTEILS: Record<BerlinBorough, BerlinNeighborhood[]> = (() => {
  const acc: Record<string, BerlinNeighborhood[]> = {};
  for (const [ortsteil, bezirk] of Object.entries(ORTSTEIL_TO_BEZIRK)) {
    (acc[bezirk] ??= []).push(ortsteil as BerlinNeighborhood);
  }
  return acc as Record<BerlinBorough, BerlinNeighborhood[]>;
})();

// ── Resolvers (case-insensitive exact match — no substring tricks) ───────────

/** Returns the canonical Bezirk name for an exact case-insensitive match,
 *  or null. No substring matching — "Friedrichshain" alone won't match the
 *  Bezirk "Friedrichshain-Kreuzberg". */
export function matchBerlinBorough(input: string | null | undefined): BerlinBorough | null {
  if (!input) return null;
  const needle = input.trim().toLowerCase();
  if (needle.length === 0) return null;
  for (const b of BERLIN_BOROUGHS) {
    if (b.toLowerCase() === needle) return b;
  }
  return null;
}

/** Returns the canonical Ortsteil name for an exact case-insensitive match,
 *  or null. */
export function matchBerlinNeighborhood(
  input: string | null | undefined
): BerlinNeighborhood | null {
  if (!input) return null;
  const needle = input.trim().toLowerCase();
  if (needle.length === 0) return null;
  for (const n of BERLIN_NEIGHBORHOODS) {
    if (n.toLowerCase() === needle) return n;
  }
  return null;
}

/** Composite resolver — given a free-text string, returns whichever level
 *  it exactly matches (Ortsteil preferred). Use this when you have one
 *  filter slot but don't know which kind the user picked. */
export interface ResolvedBerlinLocation {
  ortsteil: BerlinNeighborhood | null;
  bezirk: BerlinBorough | null;
}

export function resolveBerlinLocation(input: string | null | undefined): ResolvedBerlinLocation {
  const ortsteil = matchBerlinNeighborhood(input);
  if (ortsteil) {
    return { ortsteil, bezirk: ORTSTEIL_TO_BEZIRK[ortsteil] };
  }
  const bezirk = matchBerlinBorough(input);
  return { ortsteil: null, bezirk };
}

/** Decides whether an event matches a filter selection. Pass the raw
 *  filter string (Ortsteil OR Bezirk name) and the event's stored levels.
 *
 *  Filter is a Bezirk → match if event.borough is that Bezirk (or if
 *      event.neighbourhood is one of that Bezirk's Ortsteils).
 *  Filter is an Ortsteil → match if event.neighbourhood is that exact
 *      Ortsteil.
 *  Filter is anything else → fall through to a substring-on-address match
 *      via the caller (we don't do that here). */
export function eventMatchesLocationFilter(
  filter: string,
  event: { borough: string | null; neighbourhood: string | null }
): boolean | null {
  const bezirk = matchBerlinBorough(filter);
  if (bezirk) {
    if (event.borough === bezirk) return true;
    if (event.neighbourhood) {
      const eventBezirk = ORTSTEIL_TO_BEZIRK[event.neighbourhood as BerlinNeighborhood];
      if (eventBezirk === bezirk) return true;
    }
    return false;
  }
  const ortsteil = matchBerlinNeighborhood(filter);
  if (ortsteil) {
    return event.neighbourhood === ortsteil;
  }
  // Filter isn't a recognised canonical name — caller can fall through to
  // substring match on the freeform address.
  return null;
}
