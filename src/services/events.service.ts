import { supabase } from '@/lib/supabase';
import { validateImageUpload } from '@/utils/upload-validation';
import type { Event, EventInsert, EventUpdate, EventWithRelations, EventFilters } from '@/types/event.types';

export async function getEvents(filters?: EventFilters): Promise<EventWithRelations[]> {
  // Newest-first: the feed shows freshly published activities at the top.
  // (Future "upcoming events" view will re-sort by starts_at separately.)
  let query = supabase
    .from('events')
    .select(`
      *,
      creator:profiles!events_creator_id_fkey(*),
      circle:circles(*)
    `)
    .order('created_at', { ascending: false });

  if (filters?.search) {
    // Server-side fuzzy match across the four most-searched columns. `.or()`
    // takes a PostgREST filter string; `%` wildcards each side make this a
    // contains-match (case-insensitive via `ilike`). The `categories` column
    // is text[] — `cs.{...}` is the PostgREST "contains" operator for
    // arrays, but we want a substring match against the category names too,
    // so we fold the array to text via `categories::text` and ilike against
    // that. Cheap on small data sets; switch to a tsvector + GIN index when
    // events crosses ~10k rows (tracked as Activities v2 #11).
    //
    // Sanitize the input: strip PostgREST-reserved characters (commas split
    // filter clauses, parens nest them, asterisk is a column wildcard, colon
    // separates field.op.value). Without this, a user typing `event,*` as a
    // search would inject a malformed filter clause. The parser is otherwise
    // safe today, but defensive — see BACKLOG P2 security entry.
    const safe = filters.search.replace(/[,():*]/g, ' ').trim();
    if (safe.length > 0) {
      const q = `%${safe}%`;
      query = query.or(
        [
          `title.ilike.${q}`,
          `description.ilike.${q}`,
          `location_name.ilike.${q}`,
          `address.ilike.${q}`,
        ].join(',')
      );
    }
  }
  if (filters?.categories?.length) {
    query = query.overlaps('categories', filters.categories);
  }
  if (filters?.isFree !== undefined) {
    query = query.eq('is_free', filters.isFree);
  }
  if (filters?.startDate) {
    query = query.gte('starts_at', filters.startDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as EventWithRelations[]) ?? [];
}

export async function getEventById(id: string): Promise<EventWithRelations | null> {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      creator:profiles!events_creator_id_fkey(*),
      circle:circles(*)
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as EventWithRelations;
}

/**
 * All events a user has created, newest start first. Powers the "created"
 * half of the profile Activities drill-down (Activities v2 #15) — the
 * caller merges in registered events on top (see loadUserActivities in
 * src/components/profile/UserEventsSheet.tsx).
 *
 * Works for ANY profile, not just the authed user: `events_read_all` is
 * `FOR SELECT USING (TRUE)` (20240101000000_initial_schema.sql).
 */
export async function getEventsByCreator(userId: string): Promise<EventWithRelations[]> {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      creator:profiles!events_creator_id_fkey(*),
      circle:circles(*)
    `)
    .eq('creator_id', userId)
    .order('starts_at', { ascending: false });
  if (error) throw error;
  return (data as EventWithRelations[]) ?? [];
}

// ---------------------------------------------------------------------------
// Create Activity v3 fields (migration 20260612010000_events_subtitle_spots_
// visibility.sql). The generated EventInsert type doesn't know these columns
// until that migration is applied and types are regenerated — so we widen the
// insert type locally and degrade gracefully at runtime (see createEvent).
// ---------------------------------------------------------------------------

const V3_EVENT_KEYS = ['subtitle', 'spots', 'visibility', 'media_urls'] as const;

export type EventInsertV3 = EventInsert & {
  subtitle?: string | null;
  spots?: number | null;
  visibility?: 'anyone' | 'invite_only';
  media_urls?: string[] | null;
};

export interface CreateEventResult {
  data: Event;
  /** True when the insert had to retry without the v3 columns because the
   *  database hasn't run migration 20260612010000 yet. The caller surfaces
   *  a non-blocking "will activate after the next database update" notice. */
  degraded: boolean;
}

/** The single documented cast at the insert boundary: columns land with
 *  migration 20260612010000; types regenerate after db push. Until then the
 *  generated Insert type rejects the v3 keys as excess properties, so we
 *  widen through `unknown` here — and ONLY here — instead of sprinkling
 *  casts over every call site. */
function asGeneratedInsert(event: EventInsertV3): EventInsert {
  return event as unknown as EventInsert;
}

/** Does this insert error look like "one of the v3 columns doesn't exist"?
 *  PostgREST reports a stale schema as PGRST204 ("Could not find the
 *  'subtitle' column of 'events' in the schema cache") and raw Postgres as
 *  42703 ("column \"subtitle\" of relation \"events\" does not exist") —
 *  both messages name the column, so a message match covers either path. */
function isMissingV3ColumnError(error: { message?: string; code?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase();
  if (!msg.includes('column')) return false;
  return V3_EVENT_KEYS.some((key) => msg.includes(`'${key}'`) || msg.includes(`"${key}"`) || msg.includes(` ${key} `));
}

export async function createEvent(event: EventInsertV3): Promise<CreateEventResult> {
  const { data, error } = await supabase
    .from('events')
    .insert(asGeneratedInsert(event))
    .select()
    .single();
  if (!error) return { data, degraded: false };

  // Graceful degradation: the client can ship ahead of the v3 migration.
  // If the failure is specifically a missing v3 column, strip the new keys
  // and retry once — the activity still publishes, it just loses the
  // not-yet-supported fields. Any other error (RLS, validation, network)
  // rethrows untouched.
  const sentV3Keys = V3_EVENT_KEYS.filter((key) => key in event);
  if (sentV3Keys.length > 0 && isMissingV3ColumnError(error)) {
    const fallback: EventInsertV3 = { ...event };
    for (const key of sentV3Keys) delete fallback[key];
    const retry = await supabase.from('events').insert(asGeneratedInsert(fallback)).select().single();
    if (retry.error) throw retry.error;
    return { data: retry.data, degraded: true };
  }
  throw error;
}

export async function updateEvent(id: string, updates: EventUpdate) {
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

/** Single-event check for event detail screen's bookmark button. */
export async function isEventSaved(userId: string, eventId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('saved_events')
    .select('event_id')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/** Cheap ID-only fetch — the feed uses this to render the bookmark-icon
 *  state on every card without pulling full event rows for each save. */
export async function getSavedEventIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('saved_events')
    .select('event_id')
    .eq('user_id', userId);
  if (error) throw error;
  return ((data ?? []) as { event_id: string }[]).map((r) => r.event_id);
}

export async function saveEvent(userId: string, eventId: string) {
  const { error } = await supabase
    .from('saved_events')
    .insert({ user_id: userId, event_id: eventId });
  if (error) throw error;
}

export async function unsaveEvent(userId: string, eventId: string) {
  const { error } = await supabase
    .from('saved_events')
    .delete()
    .eq('user_id', userId)
    .eq('event_id', eventId);
  if (error) throw error;
}

export async function getSavedEvents(userId: string): Promise<EventWithRelations[]> {
  const { data, error } = await supabase
    .from('saved_events')
    .select(`
      event:events(
        *,
        creator:profiles!events_creator_id_fkey(*),
        circle:circles(*)
      )
    `)
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });
  if (error) throw error;
  return (data?.map((d) => d.event).filter(Boolean) as EventWithRelations[]) ?? [];
}

/**
 * Upload an event poster to the `event-posters` storage bucket.
 *
 * Path scheme: `<userId>/<eventId>.<ext>` — the leading folder must be the
 * authed user's ID to satisfy the bucket's RLS insert policy (owner-write).
 * Bucket was created in 20260527000000_profile_v2.sql.
 */
export async function uploadEventPoster(
  userId: string,
  eventId: string,
  uri: string
): Promise<string> {
  return uploadEventImage(userId, eventId, uri);
}

/**
 * Upload the extra "Media" images (Create Activity v3) — same bucket, same
 * owner-folder RLS scheme as the poster, with `-media-<n>` indexed filenames
 * so they never collide with the cover poster. Sequential on purpose: these
 * are user-picked photos on a mobile uplink; parallel uploads gain little
 * and make partial-failure cleanup messier.
 */
export async function uploadEventMedia(
  userId: string,
  eventId: string,
  uris: string[]
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < uris.length; i++) {
    urls.push(await uploadEventImage(userId, eventId, uris[i], `-media-${i + 1}`));
  }
  return urls;
}

/** Shared core for poster + media uploads: `<userId>/<eventId><suffix>.<ext>`. */
async function uploadEventImage(
  userId: string,
  eventId: string,
  uri: string,
  suffix = ''
): Promise<string> {
  const extMatch = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const rawExt = extMatch?.[1]?.toLowerCase();
  const ext = !rawExt || rawExt.length > 5 ? 'jpg' : rawExt === 'jpeg' ? 'jpg' : rawExt;
  const path = `${userId}/${eventId}${suffix}.${ext}`;
  const response = await fetch(uri);
  const blob = await response.blob();
  validateImageUpload(blob);

  const { error } = await supabase.storage
    .from('event-posters')
    .upload(path, blob, { upsert: true, contentType: blob.type || `image/${ext}` });
  if (error) throw error;

  const { data } = supabase.storage.from('event-posters').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
