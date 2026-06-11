import { supabase } from '@/lib/supabase';
import { validateImageUpload } from '@/utils/upload-validation';
import type { CircleInsert, CircleUpdate, CircleWithCounts } from '@/types/circle.types';
import type { CircleRole } from '@/types/enums';

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

export async function joinCircle(userId: string, circleId: string, role: CircleRole = 'member') {
  const { error } = await supabase
    .from('circle_members')
    .insert({ user_id: userId, circle_id: circleId, role });
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

/**
 * Circles where the user is an admin member — used by the Create Activity
 * form's "Associate with circle" picker. Includes circles the user created
 * (auto-admined by the `on_circle_created` trigger).
 */
export async function getAdminCircles(userId: string): Promise<CircleWithCounts[]> {
  const { data, error } = await supabase
    .from('circle_members')
    .select(`
      circle:circles(
        *,
        creator:profiles!circles_creator_id_fkey(*)
      )
    `)
    .eq('user_id', userId)
    .eq('role', 'admin' satisfies CircleRole);
  if (error) throw error;

  const circles = (data ?? [])
    .map((row) => (row as { circle: CircleWithCounts | null }).circle)
    .filter((c): c is CircleWithCounts => c !== null);

  // No counts needed for the picker — just name + id. Return as-is.
  return circles.map((c) => ({ ...c, members_count: 0, activities_count: 0 }));
}

/**
 * IDs of every circle the user is connected to via either membership or
 * follow, deduped. Used by the profile circle count.
 */
export async function getMyCircleIds(userId: string): Promise<string[]> {
  const [membersRes, followsRes] = await Promise.all([
    supabase.from('circle_members').select('circle_id').eq('user_id', userId),
    supabase.from('circle_follows').select('circle_id').eq('user_id', userId),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (followsRes.error) throw followsRes.error;

  const ids = new Set<string>();
  (membersRes.data ?? []).forEach((row) => ids.add((row as { circle_id: string }).circle_id));
  (followsRes.data ?? []).forEach((row) => ids.add((row as { circle_id: string }).circle_id));
  return Array.from(ids);
}

/**
 * Full CircleWithCounts list for every circle the user is connected to via
 * membership or follow. Used by the "Circles" popup on the profile page.
 *
 * One round trip to gather circle ids, then a single `.in()` fetch with
 * the counts populated like getCircles().
 */
export async function getMyCircles(userId: string): Promise<CircleWithCounts[]> {
  const ids = await getMyCircleIds(userId);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('circles')
    .select(`*, creator:profiles!circles_creator_id_fkey(*)`)
    .in('id', ids);
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
    }),
  );

  // Sort newest-first to roughly mirror "most recently joined" without
  // schema changes (full join-time sort would need joined_at from members).
  return enriched.sort((a, b) => +new Date(b.created_at ?? 0) - +new Date(a.created_at ?? 0));
}

/**
 * Full member list for a circle (Profile rows, not just IDs). Used by the
 * Members popup on the circle detail page.
 */
export async function getCircleMembers(circleId: string): Promise<import('@/types/user.types').Profile[]> {
  const { data, error } = await supabase
    .from('circle_members')
    .select('user:profiles!circle_members_user_id_fkey(*)')
    .eq('circle_id', circleId)
    .order('joined_at', { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .map((row) => (row as { user: import('@/types/user.types').Profile | null }).user)
    .filter((p): p is import('@/types/user.types').Profile => p !== null);
}

/**
 * Upload a circle avatar / cover image to the `circle-images` storage bucket.
 *
 * Path scheme: `<userId>/<circleId>-<kind>.<ext>` — the leading folder must
 * be the authed user's ID to satisfy bucket RLS. `kind` is 'avatar' or 'cover'.
 * Bucket was created in 20260527010000_activities_v2.sql.
 */
export async function uploadCircleImage(
  userId: string,
  circleId: string,
  uri: string,
  kind: 'avatar' | 'cover' = 'avatar'
): Promise<string> {
  const extMatch = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const rawExt = extMatch?.[1]?.toLowerCase();
  const ext = !rawExt || rawExt.length > 5 ? 'jpg' : rawExt === 'jpeg' ? 'jpg' : rawExt;
  const path = `${userId}/${circleId}-${kind}.${ext}`;
  const response = await fetch(uri);
  const blob = await response.blob();
  validateImageUpload(blob);

  const { error } = await supabase.storage
    .from('circle-images')
    .upload(path, blob, { upsert: true, contentType: blob.type || `image/${ext}` });
  if (error) throw error;

  const { data } = supabase.storage.from('circle-images').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
