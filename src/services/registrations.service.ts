import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import type { EventWithRelations } from '@/types/event.types';

export type EventRegistration = Database['public']['Tables']['event_registrations']['Row'];

/**
 * Register the authed user for an activity. Quantity defaults to 1; for
 * paid/ticketed events the EventRegistrationSheet collects a real value.
 *
 * Upserts on (event_id, user_id) — re-registering updates the quantity
 * rather than failing.
 */
export async function register(
  eventId: string,
  userId: string,
  quantity: number = 1
): Promise<EventRegistration> {
  if (quantity < 1) throw new Error('Quantity must be at least 1');
  const { data, error } = await supabase
    .from('event_registrations')
    .upsert(
      { event_id: eventId, user_id: userId, quantity },
      { onConflict: 'event_id,user_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Cancel a registration. Hard-delete — no history kept (by design, see
 * grilling Q3b). Idempotent: deleting a non-existent row is not an error.
 */
export async function unregister(eventId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('event_registrations')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** True if the user has a registration row for this event. */
export async function isRegistered(eventId: string, userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/**
 * Total distinct activities a user is registered for. Used for the profile
 * activity count. Because the `register_event_creator` trigger auto-inserts
 * a row for every event the user creates, this naturally combines
 * "created" + "registered" with zero dedup logic needed.
 */
export async function getRegistrationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
}

/** All registrations for an event (e.g. "23 people are going"). */
export async function getEventAttendeeCount(eventId: string): Promise<number> {
  const { count, error } = await supabase
    .from('event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Pull all events the user is registered for (incl. ones they created).
 * Joins to the events table so the caller gets full event detail in one trip.
 */
export async function getMyRegisteredEvents(userId: string): Promise<EventWithRelations[]> {
  const { data, error } = await supabase
    .from('event_registrations')
    .select(`
      event:events(
        *,
        creator:profiles!events_creator_id_fkey(*),
        circle:circles(*)
      )
    `)
    .eq('user_id', userId)
    .order('registered_at', { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .map((row) => (row as { event: EventWithRelations | null }).event)
    .filter((e): e is EventWithRelations => e !== null);
}
