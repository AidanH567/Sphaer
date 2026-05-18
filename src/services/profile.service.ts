import { supabase } from '@/lib/supabase';
import type { ProfileUpdate, ProfileWithCounts } from '@/types/user.types';

export async function getProfile(userId: string): Promise<ProfileWithCounts | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;

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

export async function uploadAvatar(userId: string, uri: string): Promise<string> {
  const ext = uri.split('.').pop() ?? 'jpg';
  const path = `${userId}/avatar.${ext}`;
  const response = await fetch(uri);
  const blob = await response.blob();

  const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
