import { supabase } from '@/lib/supabase';
import type { EventInsert, EventUpdate, EventWithRelations, EventFilters } from '@/types/event.types';

export async function getEvents(filters?: EventFilters): Promise<EventWithRelations[]> {
  let query = supabase
    .from('events')
    .select(`
      *,
      creator:profiles!events_creator_id_fkey(*),
      circle:circles(*)
    `)
    .order('starts_at', { ascending: true });

  if (filters?.search) {
    query = query.ilike('title', `%${filters.search}%`);
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

export async function uploadEventPoster(eventId: string, uri: string): Promise<string> {
  const ext = uri.split('.').pop() ?? 'jpg';
  const path = `${eventId}/poster.${ext}`;
  const response = await fetch(uri);
  const blob = await response.blob();

  const { error } = await supabase.storage.from('posters').upload(path, blob, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('posters').getPublicUrl(path);
  return data.publicUrl;
}
