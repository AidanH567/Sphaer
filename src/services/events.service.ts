import { supabase } from '@/lib/supabase';
import { validateImageUpload } from '@/utils/upload-validation';
import type { EventInsert, EventUpdate, EventWithRelations, EventFilters } from '@/types/event.types';

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

export async function createEvent(event: EventInsert) {
  const { data, error } = await supabase
    .from('events')
    .insert(event)
    .select()
    .single();
  if (error) throw error;
  return data;
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
  const extMatch = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const rawExt = extMatch?.[1]?.toLowerCase();
  const ext = !rawExt || rawExt.length > 5 ? 'jpg' : rawExt === 'jpeg' ? 'jpg' : rawExt;
  const path = `${userId}/${eventId}.${ext}`;
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
