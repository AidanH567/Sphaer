export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

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

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      circle_follows: {
        Row: {
          circle_id: string
          created_at: string | null
          user_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string | null
          user_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_follows_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_members: {
        Row: {
          circle_id: string
          joined_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          circle_id: string
          joined_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          circle_id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          avatar_url: string | null
          cover_url: string | null
          created_at: string | null
          creator_id: string
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          tags: string[] | null
        }
        Insert: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          creator_id: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          tags?: string[] | null
        }
        Update: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          creator_id?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "circles_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_message_reads: {
        Row: {
          last_read_at: string
          partner_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          partner_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          partner_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_message_reads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          event_id: string
          quantity: number
          registered_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          quantity?: number
          registered_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          quantity?: number
          registered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          // Berlin Bezirk (borough) — broader than neighbourhood. Some
          // Google geocoder results only resolve this level. Added in
          // 20260601300000_events_borough.sql.
          borough: string | null
          categories: string[] | null
          circle_id: string | null
          created_at: string | null
          creator_id: string
          description: string | null
          ends_at: string | null
          id: string
          is_free: boolean | null
          lat: number | null
          lng: number | null
          location_name: string | null
          // Berlin Ortsteil — more specific. May be null when the
          // geocoder only knew the borough.
          neighbourhood: string | null
          poster_url: string | null
          price: number | null
          starts_at: string
          ticket_url: string | null
          title: string
        }
        Insert: {
          address?: string | null
          borough?: string | null
          categories?: string[] | null
          circle_id?: string | null
          created_at?: string | null
          creator_id: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_free?: boolean | null
          lat?: number | null
          lng?: number | null
          location_name?: string | null
          neighbourhood?: string | null
          poster_url?: string | null
          price?: number | null
          starts_at: string
          ticket_url?: string | null
          title: string
        }
        Update: {
          address?: string | null
          borough?: string | null
          categories?: string[] | null
          circle_id?: string | null
          created_at?: string | null
          creator_id?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_free?: boolean | null
          lat?: number | null
          lng?: number | null
          location_name?: string | null
          neighbourhood?: string | null
          poster_url?: string | null
          price?: number | null
          starts_at?: string
          ticket_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          circle_id: string | null
          content: string
          created_at: string | null
          // Added in 20260601100000_event_chats.sql — event group chat target.
          // CHECK constraint enforces exactly one of recipient_id / circle_id /
          // event_id is non-null.
          event_id: string | null
          id: string
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          circle_id?: string | null
          content: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          circle_id?: string | null
          content?: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          recipient_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_message_reads: {
        Row: {
          event_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_message_reads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_message_reads: {
        Row: {
          circle_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          circle_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_message_reads_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          path: string
          profile_id: string
          sort_order: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          path: string
          profile_id: string
          sort_order?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          path?: string
          profile_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_images_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          about: string | null
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string | null
          disciplines: string[] | null
          display_name: string | null
          experiences: ProfileExperienceEntry[]
          id: string
          location: string | null
          neighborhood: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          about?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          disciplines?: string[] | null
          display_name?: string | null
          experiences?: ProfileExperienceEntry[]
          id: string
          location?: string | null
          neighborhood?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          about?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          disciplines?: string[] | null
          display_name?: string | null
          experiences?: ProfileExperienceEntry[]
          id?: string
          location?: string | null
          neighborhood?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      saved_events: {
        Row: {
          event_id: string
          saved_at: string | null
          user_id: string
        }
        Insert: {
          event_id: string
          saved_at?: string | null
          user_id: string
        }
        Update: {
          event_id?: string
          saved_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      // Updated in 20260601100000_event_chats.sql — polymorphic over DMs and
      // event chats. `kind` discriminates: for 'dm' the partner is a Profile,
      // for 'event' the partner is an event row. `last_message` is nullable
      // for empty event chats (you registered but no one has posted yet).
      get_conversations: {
        Args: { p_user_id: string }
        Returns: {
          kind: 'dm' | 'event' | 'circle'
          partner_id: string
          partner: Json
          last_message: Json | null
          unread_count: number
          sort_at: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
