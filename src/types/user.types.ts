import type { Database } from './supabase';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export interface ProfileWithCounts extends Profile {
  followers_count: number;
  following_count: number;
  events_count: number;
  is_following?: boolean;
}
