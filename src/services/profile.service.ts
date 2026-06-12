import { supabase } from '@/lib/supabase';
import { validateImageUpload } from '@/utils/upload-validation';
import type {
  Profile,
  ProfileUpdate,
  ProfileWithCounts,
  ProfileImage,
  ProfileExperienceEntry,
} from '@/types/user.types';

/* ── Profile CRUD ──────────────────────────────────────── */

export async function getProfile(userId: string): Promise<ProfileWithCounts | null> {
  // `.maybeSingle()` returns data=null for 0 rows (the `.single()` 406
  // pattern was breaking the profile page when a user's row hadn't been
  // created yet — the AuthContext safety net normally creates it, but we
  // still want this service-level call to fail soft).
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [followersRes, followingRes, eventsRes] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    supabase.from('events').select('*', { count: 'exact', head: true }).eq('creator_id', userId),
  ]);

  return {
    ...data,
    followers_count: followersRes.count ?? 0,
    following_count: followingRes.count ?? 0,
    events_count: eventsRes.count ?? 0,
  };
}

export async function updateProfile(userId: string, updates: ProfileUpdate) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Type-safe wrapper for replacing the `experiences` JSONB array. */
export async function updateExperiences(userId: string, experiences: ProfileExperienceEntry[]) {
  return updateProfile(userId, { experiences });
}

/* ── Search ────────────────────────────────────────────── */

/**
 * Fuzzy artist search across `display_name` + `username` — powers the feed's
 * "Artists" section when the search bar has a query. Case-insensitive
 * contains-match via `ilike`, capped at `limit` rows.
 *
 * Sanitization mirrors events.service.getEvents exactly: strip
 * PostgREST-reserved characters before interpolating into the `.or()` filter
 * string (commas split filter clauses, parens nest them, asterisk is a
 * column wildcard, colon separates field.op.value). Without this, a user
 * typing `anna,*` would inject a malformed filter clause.
 *
 * Deliberately excludes no one — blocked-user filtering happens client-side
 * (the feed reads `blockedIds` from AppContext), matching how useEvents
 * filters blocked creators.
 */
export async function searchProfiles(query: string, limit = 5): Promise<Profile[]> {
  const safe = query.replace(/[,():*]/g, ' ').trim();
  if (safe.length === 0) return [];

  const q = `%${safe}%`;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`display_name.ilike.${q},username.ilike.${q}`)
    .order('display_name', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/* ── Follow helpers ────────────────────────────────────── */

export async function followUser(followerId: string, followingId: string) {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });
  if (error) throw error;
}

export async function unfollowUser(followerId: string, followingId: string) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  if (error) throw error;
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  return (count ?? 0) > 0;
}

/**
 * Pull every profile that follows `userId`. Used by the Followers popup
 * on the profile page.
 */
export async function getFollowers(userId: string): Promise<import('@/types/user.types').Profile[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('follower:profiles!follows_follower_id_fkey(*)')
    .eq('following_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .map((row) => (row as { follower: import('@/types/user.types').Profile | null }).follower)
    .filter((p): p is import('@/types/user.types').Profile => p !== null);
}

/**
 * Pull every profile that `userId` is following. Used by the Following
 * popup on the profile page (mirror image of getFollowers).
 */
export async function getFollowing(userId: string): Promise<import('@/types/user.types').Profile[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('followed:profiles!follows_following_id_fkey(*)')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .map((row) => (row as { followed: import('@/types/user.types').Profile | null }).followed)
    .filter((p): p is import('@/types/user.types').Profile => p !== null);
}

/* ── Avatar (single image, profiles.avatar_url) ────────── */

/**
 * Upload a new avatar image, overwriting any previous one. Returns the public
 * URL to store in `profiles.avatar_url`.
 *
 * Bucket: `avatars` (public-read, owner-write).
 * Path scheme: `<userId>/avatar.<ext>` — one avatar per user, overwriteable.
 */
export async function uploadAvatar(userId: string, uri: string): Promise<string> {
  const ext = inferExtension(uri);
  const path = `${userId}/avatar.${ext}`;
  const blob = await uriToBlob(uri);
  validateImageUpload(blob);

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: blob.type || `image/${ext}` });
  if (error) throw error;

  // Bust the CDN cache so the new avatar shows immediately
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/* ── Gallery images (profile_images table + profile-gallery bucket) ── */

/**
 * Fetch a profile's gallery images, ordered by `sort_order` then created time.
 * Resolves each row's `path` to a full public URL via `getGalleryImageUrl()`.
 */
export async function getProfileImages(profileId: string): Promise<ProfileImage[]> {
  const { data, error } = await supabase
    .from('profile_images')
    .select('*')
    .eq('profile_id', profileId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Resolve a stored gallery path to a public URL. */
export function getGalleryImageUrl(path: string): string {
  const { data } = supabase.storage.from('profile-gallery').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload one local image URI to the gallery bucket and insert its row.
 *
 * Returns the inserted `profile_images` row (so the caller can render it).
 * If the storage upload fails, no row is inserted. If the row insert fails
 * after a successful upload, we best-effort delete the orphan storage object.
 */
export async function uploadGalleryImage(
  profileId: string,
  uri: string,
  sortOrder: number
): Promise<ProfileImage> {
  const ext = inferExtension(uri);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const path = `${profileId}/${fileName}`;
  const blob = await uriToBlob(uri);
  validateImageUpload(blob);

  const { error: uploadError } = await supabase.storage
    .from('profile-gallery')
    .upload(path, blob, { upsert: false, contentType: blob.type || `image/${ext}` });
  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from('profile_images')
    .insert({ profile_id: profileId, path, sort_order: sortOrder })
    .select()
    .single();

  if (insertError) {
    // Best-effort cleanup: we got a storage object with no DB row pointing at
    // it. Try to delete it so we don't leak storage.
    await supabase.storage.from('profile-gallery').remove([path]).catch(() => {});
    throw insertError;
  }

  return data;
}

/**
 * Upload multiple images in parallel. Resolves once all uploads settle.
 * Failed uploads are reported in the `errors` array; successful ones in `images`.
 * Caller is responsible for showing per-tile retry / error UX.
 */
export async function uploadGalleryImages(
  profileId: string,
  uris: string[],
  startingSortOrder: number
): Promise<{ images: ProfileImage[]; errors: Array<{ uri: string; error: unknown }> }> {
  const results = await Promise.allSettled(
    uris.map((uri, i) => uploadGalleryImage(profileId, uri, startingSortOrder + i))
  );

  const images: ProfileImage[] = [];
  const errors: Array<{ uri: string; error: unknown }> = [];

  results.forEach((res, i) => {
    if (res.status === 'fulfilled') images.push(res.value);
    else errors.push({ uri: uris[i], error: res.reason });
  });

  return { images, errors };
}

/**
 * Remove a gallery image — deletes the DB row first (so the UI updates fast),
 * then best-effort deletes the underlying storage object.
 */
export async function removeProfileImage(image: ProfileImage): Promise<void> {
  const { error } = await supabase.from('profile_images').delete().eq('id', image.id);
  if (error) throw error;

  await supabase.storage.from('profile-gallery').remove([image.path]).catch((err) => {
    // Row is gone; orphan storage object can be cleaned up later
    console.warn('[profile.service] Failed to delete gallery storage object', image.path, err);
  });
}

/* ── Internal helpers ──────────────────────────────────── */

function inferExtension(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const ext = match?.[1]?.toLowerCase();
  if (!ext || ext.length > 5) return 'jpg';
  return ext === 'jpeg' ? 'jpg' : ext;
}

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}
