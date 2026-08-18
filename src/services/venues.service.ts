/**
 * Venues and venue favourites.
 *
 * ⚠️ THE SCHEMA THIS TALKS TO IS NOT LIVE YET.
 * 20260818000000_venues_and_favourites.sql is written but unapplied (this
 * repo applies migrations by hand, one at a time — see that file's header).
 * So every read here degrades to EMPTY rather than throwing, and every
 * write throws a typed VenuesUnavailableError the UI can catch. That is the
 * same contract bugReport.service.ts ships under, and it is what lets the
 * client merge before the migration lands without the map going dark:
 * `venues` mode simply shows nothing until Aidan applies the SQL.
 *
 * Save/unsave mirror events.service.ts's saveEvent/unsaveEvent exactly —
 * favourites are the same idiom pointed at a different table.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Venue, VenueWithMeta, VenuesDatabase } from '@/types/venue.types';
import { venueSlug } from '@/utils/venue-slug';

/** Thrown by writes when the venues schema isn't live yet. */
export class VenuesUnavailableError extends Error {
  constructor() {
    super('Venues are not available yet.');
    this.name = 'VenuesUnavailableError';
  }
}

/** Does this error mean "the table/column doesn't exist yet"? Same four
 *  codes bugReport.service.ts checks — 42P01 relation missing, 42703
 *  column missing, and PostgREST's two schema-cache shapes. */
function isMissingSchemaError(error: { code?: string; message?: string }): boolean {
  if (
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === 'PGRST205' ||
    error.code === 'PGRST204'
  ) {
    return true;
  }
  const msg = (error.message ?? '').toLowerCase();
  return msg.includes('does not exist') || msg.includes('schema cache');
}

/** The single documented cast at the venues boundary — same rule as
 *  bugReport.service.ts's bugReportDb — until `supabase gen types` has
 *  seen the venues migration. See VenuesDatabase for the shim it widens to. */
const venuesDb = supabase as unknown as SupabaseClient<VenuesDatabase>;

/**
 * Every venue. Returns [] when the schema isn't live.
 *
 * Unpaginated on purpose: the backfill creates ~70 rows and Berlin's real
 * ceiling is in the low thousands. Add a bbox filter (venues_coords_idx
 * exists for it) when that stops being true.
 */
export async function getVenues(): Promise<Venue[]> {
  const { data, error } = await venuesDb
    .from('venues')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []) as Venue[];
}

/** Cheap id-only fetch for heart state, mirroring getSavedEventIds. */
export async function getSavedVenueIds(userId: string): Promise<string[]> {
  const { data, error } = await venuesDb
    .from('saved_venues')
    .select('venue_id')
    .eq('user_id', userId);

  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }
  return ((data ?? []) as { venue_id: string }[]).map((r) => r.venue_id);
}

/**
 * Full venue rows the user hearted, newest save first.
 *
 * Two queries rather than a PostgREST embed (`venue:venues(*)`), for the
 * reason bugReport.service.ts documents: the hand-written VenuesDatabase
 * shim declares `Relationships: []`, so an embed has no typed FK to
 * traverse. Once the generated types know about venues this can collapse
 * back into one embedded select, exactly like getSavedEvents does.
 */
export async function getSavedVenues(userId: string): Promise<Venue[]> {
  const { data: saved, error: savedError } = await venuesDb
    .from('saved_venues')
    .select('venue_id')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });

  if (savedError) {
    if (isMissingSchemaError(savedError)) return [];
    throw savedError;
  }

  const orderedIds = (saved ?? []).map((r) => r.venue_id);
  if (orderedIds.length === 0) return [];

  const { data: rows, error: venuesError } = await venuesDb
    .from('venues')
    .select('*')
    .in('id', orderedIds);

  if (venuesError) {
    if (isMissingSchemaError(venuesError)) return [];
    throw venuesError;
  }

  // `in` returns rows in whatever order the planner likes; restore the
  // newest-saved-first order the caller asked for.
  const byId = new Map((rows ?? []).map((v) => [v.id, v as Venue]));
  return orderedIds
    .map((id) => byId.get(id))
    .filter((v): v is Venue => v !== undefined);
}

export async function saveVenue(userId: string, venueId: string): Promise<void> {
  const { error } = await venuesDb
    .from('saved_venues')
    .insert({ user_id: userId, venue_id: venueId });

  if (error) {
    if (isMissingSchemaError(error)) throw new VenuesUnavailableError();
    throw error;
  }
}

export async function unsaveVenue(userId: string, venueId: string): Promise<void> {
  const { error } = await venuesDb
    .from('saved_venues')
    .delete()
    .eq('user_id', userId)
    .eq('venue_id', venueId);

  if (error) {
    if (isMissingSchemaError(error)) throw new VenuesUnavailableError();
    throw error;
  }
}

export interface NewVenue {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  borough?: string | null;
  neighbourhood?: string | null;
  description?: string | null;
  website_url?: string | null;
}

/**
 * Add a venue. `slug` is left to the database trigger (venues_set_slug) —
 * the client must never be the thing that decides identity, or two clients
 * on different app versions would disagree about it. venueSlug() is used
 * only to reject a name that would normalise to nothing, so the user gets
 * a message instead of a constraint violation.
 */
export async function createVenue(userId: string, venue: NewVenue): Promise<Venue> {
  if (venueSlug(venue.name) === null) {
    throw new Error('That venue name is too short to identify a place.');
  }

  const { data, error } = await venuesDb
    .from('venues')
    .insert({ ...venue, created_by: userId })
    .select()
    .single();

  if (error) {
    if (isMissingSchemaError(error)) throw new VenuesUnavailableError();
    throw error;
  }
  return data as Venue;
}

/** Decorate venues with the user's heart state, for list surfaces. */
export function withSavedState(
  venues: readonly Venue[],
  savedIds: ReadonlySet<string>,
): VenueWithMeta[] {
  return venues.map((v) => ({ ...v, is_saved: savedIds.has(v.id) }));
}
