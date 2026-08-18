import { supabase } from '@/lib/supabase';
import {
  MAX_UPLOAD_BYTES,
  UploadValidationError,
  validateImageUpload,
} from '@/utils/upload-validation';
import { assertPngIsPlausible, base64ToBytes } from '@/utils/poster-guard';
import { COVER_HEIGHT, COVER_WIDTH } from '@/utils/cover-template';
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

/**
 * Delete a circle. Creator-only by RLS (`circles_delete_own`,
 * 20260612000000). FKs handle the fallout: members / follows / chat
 * messages cascade away, and events keep existing with circle_id = NULL
 * (they become independent activities — core design decision).
 */
export async function deleteCircle(id: string) {
  const { error } = await supabase.from('circles').delete().eq('id', id);
  if (error) throw error;
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

/**
 * Remove (kick) a member from a circle. Same row delete as leaveCircle but
 * issued by the circle creator against someone else's membership — allowed
 * by RLS policy `circle_members_creator_delete` (20260612000000). Without
 * that policy applied the delete silently matches zero rows.
 */
export async function removeMember(circleId: string, userId: string) {
  const { error } = await supabase
    .from('circle_members')
    .delete()
    .eq('circle_id', circleId)
    .eq('user_id', userId);
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
 * The two ways a user is connected to a circle, kept apart.
 *
 * `getMyCircleIds` flattens these into one deduped list for the profile
 * count, but the "My circles" section on the Circles screen needs the
 * distinction: being a MEMBER of a circle is a different relationship from
 * merely FOLLOWING it, and the UI would be lying if it showed both under one
 * undifferentiated heading.
 */
export async function getMyCircleMembership(
  userId: string,
): Promise<{ memberIds: Set<string>; followIds: Set<string> }> {
  const [membersRes, followsRes] = await Promise.all([
    supabase.from('circle_members').select('circle_id').eq('user_id', userId),
    supabase.from('circle_follows').select('circle_id').eq('user_id', userId),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (followsRes.error) throw followsRes.error;

  const toSet = (rows: unknown[]) =>
    new Set((rows ?? []).map((row) => (row as { circle_id: string }).circle_id));

  return {
    memberIds: toSet(membersRes.data ?? []),
    followIds: toSet(followsRes.data ?? []),
  };
}

/**
 * IDs of every circle the user is connected to via either membership or
 * follow, deduped. Used by the profile circle count.
 */
export async function getMyCircleIds(userId: string): Promise<string[]> {
  const { memberIds, followIds } = await getMyCircleMembership(userId);
  return Array.from(new Set([...memberIds, ...followIds]));
}

/**
 * Full CircleWithCounts list for every circle the user is connected to via
 * membership or follow. Used by the "Circles" popup on the profile page.
 *
 * One round trip to gather circle ids, then a single `.in()` fetch with
 * the counts populated like getCircles().
 *
 * `is_member` / `is_following` are populated from the two source sets so
 * callers can tell a joined circle from a merely-followed one without a
 * second query. Both can be true at once.
 */
export async function getMyCircles(userId: string): Promise<CircleWithCounts[]> {
  const { memberIds, followIds } = await getMyCircleMembership(userId);
  const ids = Array.from(new Set([...memberIds, ...followIds]));
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
        is_member: memberIds.has(circle.id),
        is_following: followIds.has(circle.id),
      } as CircleWithCounts;
    }),
  );

  // Members first, then followed-only — "circles you're in" is the stronger
  // relationship and should lead. Within each group, newest-first to roughly
  // mirror "most recently joined" without schema changes (a true join-time
  // sort would need joined_at from circle_members).
  return enriched.sort((a, b) => {
    if (a.is_member !== b.is_member) return a.is_member ? -1 : 1;
    return +new Date(b.created_at ?? 0) - +new Date(a.created_at ?? 0);
  });
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

/**
 * Upload a circle cover image. Thin wrapper over uploadCircleImage with
 * kind='cover' — lands at `circle-images/<userId>/<circleId>-cover.<ext>`,
 * right next to the circle's avatar, and runs the same validateImageUpload
 * MIME/size guardrails.
 */
export async function uploadCircleCover(
  userId: string,
  circleId: string,
  uri: string
): Promise<string> {
  return uploadCircleImage(userId, circleId, uri, 'cover');
}

/**
 * Upload a cover the app GENERATED (`src/utils/cover-template.ts`) rather than
 * one the user picked from their photo library.
 *
 * Same bucket and same owner-folder RLS scheme as `uploadCircleCover`, and PNG
 * is already inside the bucket's `allowed_mime_types` allowlist
 * (20260612050000_storage_image_mime_limits.sql), so no schema change was
 * needed. The path deliberately keeps the `-cover` name so a generated cover
 * and a later hand-picked one occupy the same slot — a circle has exactly one
 * cover, and leaving an orphan behind would just be a second file nobody reads.
 *
 * ── Why this cannot go through `uploadCircleImage` ───────────────────────────
 * That function does `fetch(uri) → blob → upload(blob)`, and a generated cover
 * is a `data:` URI. React Native's `fetch` does not reliably resolve `data:`
 * URIs, and `Blob` on RN cannot be constructed from a typed array — the same
 * wall `uploadGeneratedEventPoster` documents at length. The path that works on
 * iOS, Android and web alike is base64 → ArrayBuffer → `upload(arrayBuffer,
 * { contentType })`.
 *
 * Decoding here rather than in the caller is deliberate, for the same reason it
 * is on the event side: the guard below then runs on the EXACT bytes that go
 * over the wire, not on a copy that was checked earlier and re-encoded since.
 *
 * Note `assertPngIsPlausible` takes the expected dimensions as arguments, so
 * the landscape canvas needed no change to it — it is the portrait/landscape
 * difference being passed as data rather than branched on.
 */
export async function uploadGeneratedCircleCover(
  userId: string,
  circleId: string,
  base64Png: string
): Promise<string> {
  const bytes = base64ToBytes(base64Png);
  assertPngIsPlausible(bytes, COVER_WIDTH, COVER_HEIGHT);
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    const mb = (bytes.byteLength / 1024 / 1024).toFixed(1);
    throw new UploadValidationError(
      `The generated cover came out at ${mb} MB, over the ${
        MAX_UPLOAD_BYTES / 1024 / 1024
      } MB limit. Please try again.`
    );
  }

  const path = `${userId}/${circleId}-cover.png`;
  const { error } = await supabase.storage
    .from('circle-images')
    // `bytes.buffer` is exact-length — base64ToBytes slices rather than
    // subarrays for precisely this reason.
    .upload(path, bytes.buffer as ArrayBuffer, {
      upsert: true,
      contentType: 'image/png',
    });
  if (error) throw error;

  const { data } = supabase.storage.from('circle-images').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
