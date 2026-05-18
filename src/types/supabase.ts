export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

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
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'> & {
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
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
