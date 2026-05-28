export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/**
 * One experience entry stored inside `profiles.experiences` (JSONB array).
 * Shape is enforced in the app — the column is JSONB, the validation lives in
 * `ProfileForm`. Keep this in sync with the form's local types.
 */
export interface ProfileExperienceEntry {
  id: string; // client-generated UUID
  title: string;
  organisation: string | null;
  start_date: string | null; // ISO yyyy-mm or yyyy-mm-dd
  end_date: string | null;   // null = "Present"
  description: string | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string | null;
          bio: string | null;
          avatar_url: string | null;
          cover_url: string | null;
          disciplines: string[] | null;
          location: string | null;
          website: string | null;
          // Added in 20260527000000_profile_v2.sql
          about: string | null;
          neighborhood: string | null;
          experiences: ProfileExperienceEntry[];
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'experiences'> & {
          created_at?: string;
          experiences?: ProfileExperienceEntry[];
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      profile_images: {
        Row: {
          id: string;
          profile_id: string;
          path: string;            // storage path in the `profile-gallery` bucket
          caption: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profile_images']['Row'], 'id' | 'created_at' | 'caption' | 'sort_order'> & {
          id?: string;
          caption?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profile_images']['Insert']>;
      };
      events: {
        Row: {
          id: string;
          creator_id: string;
          circle_id: string | null;
          title: string;
          description: string | null;
          location_name: string | null;
          address: string | null;
          lat: number | null;
          lng: number | null;
          starts_at: string;
          ends_at: string | null;
          categories: string[] | null;
          poster_url: string | null;
          ticket_url: string | null;
          is_free: boolean;
          price: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['events']['Insert']>;
      };
      circles: {
        Row: {
          id: string;
          creator_id: string;
          name: string;
          description: string | null;
          avatar_url: string | null;
          cover_url: string | null;
          tags: string[] | null;
          is_public: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['circles']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['circles']['Insert']>;
      };
      circle_members: {
        Row: {
          circle_id: string;
          user_id: string;
          role: 'admin' | 'member';
          joined_at: string;
        };
        Insert: Omit<Database['public']['Tables']['circle_members']['Row'], 'joined_at'> & {
          joined_at?: string;
        };
        Update: Partial<Database['public']['Tables']['circle_members']['Insert']>;
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['follows']['Row'], 'created_at'> & {
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['follows']['Insert']>;
      };
      circle_follows: {
        Row: {
          user_id: string;
          circle_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['circle_follows']['Row'], 'created_at'> & {
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['circle_follows']['Insert']>;
      };
      saved_events: {
        Row: {
          user_id: string;
          event_id: string;
          saved_at: string;
        };
        Insert: Omit<Database['public']['Tables']['saved_events']['Row'], 'saved_at'> & {
          saved_at?: string;
        };
        Update: Partial<Database['public']['Tables']['saved_events']['Insert']>;
      };
      event_registrations: {
        Row: {
          event_id: string;
          user_id: string;
          quantity: number;
          registered_at: string;
        };
        Insert: Omit<Database['public']['Tables']['event_registrations']['Row'], 'registered_at' | 'quantity'> & {
          quantity?: number;
          registered_at?: string;
        };
        Update: Partial<Database['public']['Tables']['event_registrations']['Insert']>;
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string | null;
          circle_id: string | null;
          content: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: 'follow' | 'event_reminder' | 'circle_event' | 'message';
          reference_id: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
    };
  };
}
