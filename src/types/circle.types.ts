import type { Database } from './supabase';
import type { Profile } from './user.types';

export type Circle = Database['public']['Tables']['circles']['Row'];
export type CircleInsert = Database['public']['Tables']['circles']['Insert'];
export type CircleUpdate = Database['public']['Tables']['circles']['Update'];

export type CircleMember = Database['public']['Tables']['circle_members']['Row'];

export interface CircleWithCounts extends Circle {
  members_count: number;
  activities_count: number;
  is_member?: boolean;
  is_following?: boolean;
  creator?: Profile | null;
}
