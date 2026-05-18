import { supabase } from '@/lib/supabase';
import type { CircleInsert, CircleUpdate, CircleWithCounts } from '@/types/circle.types';

export async function getCircles(search?: string): Promise<CircleWithCounts[]> {
  let query = supabase
    .from('circles')
    .select(`*, creator:profiles!circles_creator_id_fkey(*)`)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const enriched = await Promise.all(
    (data ?? []).map(async (circle) => {
      const [membersRes, activitiesRes] = await Promise.all([
        supabase.from('circle_members').select('*', { count: 'exact', head: true }).eq('circle_id', circle.id),
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('circle_id', circle.id),
      ]);
      return {
        ...circle,
        members_count: membersRes.count ?? 0,
        activities_count: activitiesRes.count ?? 0,
      } as CircleWithCounts;
    })
  );

  return enriched;
}

export async function getCircleById(id: string): Promise<CircleWithCounts | null> {
  const { data, error } = await supabase
    .from('circles')
    .select(`*, creator:profiles!circles_creator_id_fkey(*)`)
    .eq('id', id)
    .single();
  if (error) throw error;

  const [membersRes, activitiesRes] = await Promise.all([
    supabase.from('circle_members').select('*', { count: 'exact', head: true }).eq('circle_id', id),
    supabase.from('events').select('*', { count: 'exact', head: true }).eq('circle_id', id),
  ]);

  return {
    ...data,
    members_count: membersRes.count ?? 0,
    activities_count: activitiesRes.count ?? 0,
  } as CircleWithCounts;
}

export async function createCircle(circle: CircleInsert) {
  const { data, error } = await supabase.from('circles').insert(circle).select().single();
  if (error) throw error;
  return data;
}

export async function updateCircle(id: string, updates: CircleUpdate) {
  const { data, error } = await supabase.from('circles').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function joinCircle(userId: string, circleId: string) {
  const { error } = await supabase
    .from('circle_members')
    .insert({ user_id: userId, circle_id: circleId, role: 'member' });
  if (error) throw error;
}

export async function leaveCircle(userId: string, circleId: string) {
  const { error } = await supabase
    .from('circle_members')
    .delete()
    .eq('user_id', userId)
    .eq('circle_id', circleId);
  if (error) throw error;
}

export async function followCircle(userId: string, circleId: string) {
  const { error } = await supabase
    .from('circle_follows')
    .insert({ user_id: userId, circle_id: circleId });
  if (error) throw error;
}

export async function unfollowCircle(userId: string, circleId: string) {
  const { error } = await supabase
    .from('circle_follows')
    .delete()
    .eq('user_id', userId)
    .eq('circle_id', circleId);
  if (error) throw error;
}

export async function isMember(userId: string, circleId: string): Promise<boolean> {
  const { count } = await supabase
    .from('circle_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('circle_id', circleId);
  return (count ?? 0) > 0;
}
