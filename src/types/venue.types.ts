/**
 * Venues, and the three lenses the map can look at the city through.
 *
 * `Venue` is hand-written rather than pulled from `Database['public']
 * ['Tables']['venues']`, for the same reason event.types.ts hand-declares
 * the provenance columns: src/types/supabase.ts is generated, and the
 * venues migration (20260818000000_venues_and_favourites.sql) is NOT
 * APPLIED yet. Regenerating types is a separate, riskier task that has to
 * follow the migration, not lead it.
 */

/**
 * A place. Mirrors public.venues in 20260818000000.
 *
 * ⚠️ `type`, not `interface`, and it has to stay that way. supabase-js
 * constrains a table's Row/Insert/Update to `Record<string, unknown>`; a TS
 * interface has no implicit index signature, so using one here makes the
 * whole table resolve to `never` inside VenuesDatabase and every query
 * silently loses its types. Same reason BugReportRow is a type alias.
 */
export type Venue = {
  id: string;
  /** Human-facing, editable. What the pin is labelled with. */
  name: string;
  /** Canonical identity — `venue_slug(name)` server-side. Never shown. */
  slug: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  borough: string | null;
  neighbourhood: string | null;
  description: string | null;
  image_url: string | null;
  website_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A venue plus whatever the current screen knows about it. */
export type VenueWithMeta = Venue & {
  /** Whether the signed-in user has hearted it. Absent when nobody is
   *  signed in — deliberately optional rather than defaulted to false, so
   *  "not loaded" and "not saved" stay distinguishable. */
  is_saved?: boolean;
  /** How many of the currently-filtered events sit at this venue. Filled
   *  by the map's venue mode so a pin can say "3 on". */
  event_count?: number;
}

/**
 * The map's three viewing options (Lara, 2026-08-18).
 *
 *   activities — every filtered event with coordinates. What the map has
 *                always done; unchanged.
 *   venues     — the places themselves, one pin per venue, regardless of
 *                whether anything is on tonight.
 *   favourites — "my city": only what this user saved. Both hearted venues
 *                AND saved events, because the ask was "all favourites
 *                shown in a glimpse", and Sphaer already had saved_events
 *                long before venues existed. Showing only saved venues
 *                would make the mode emptier than the user's actual city.
 */
export type MapMode = 'activities' | 'venues' | 'favourites';

export const MAP_MODES: readonly MapMode[] = ['activities', 'venues', 'favourites'] as const;

export function isMapMode(value: string): value is MapMode {
  return (MAP_MODES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// PostgREST shim
// ---------------------------------------------------------------------------
// Same pattern (and same reason) as BugReportsDatabase in
// src/types/bug-reports.ts: src/types/supabase.ts is generated and does not
// know about `venues` / `saved_venues` yet, because the migration is not
// applied. This minimal schema mirrors the generated Database layout so a
// cast SupabaseClient resolves identical builder behaviour — and keeps
// venues.service.ts free of `any`.
//
// DELETE this block, and the cast in venues.service.ts, as soon as
// `supabase gen types typescript` has seen 20260818000000.

/** Columns a client may set. id/slug/created_at/updated_at are server-side:
 *  slug comes from the venues_set_slug trigger, the rest have defaults. */
export type VenueInsert = {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  borough?: string | null;
  neighbourhood?: string | null;
  description?: string | null;
  image_url?: string | null;
  website_url?: string | null;
  created_by?: string | null;
}

export type VenueUpdate = Partial<VenueInsert>;

export type SavedVenueRow = {
  user_id: string;
  venue_id: string;
  saved_at: string;
}

export type SavedVenueInsert = {
  user_id: string;
  venue_id: string;
  saved_at?: string;
}

export type VenuesDatabase = {
  // Same PostgREST version marker as the generated Database type.
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      venues: {
        Row: Venue;
        Insert: VenueInsert;
        Update: VenueUpdate;
        Relationships: [];
      };
      saved_venues: {
        Row: SavedVenueRow;
        Insert: SavedVenueInsert;
        Update: Partial<SavedVenueRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
