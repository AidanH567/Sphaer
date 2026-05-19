import type { Database } from './supabase';
import type { Profile } from './user.types';

export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];

export interface MessageWithSender extends Message {
  sender: Profile | null;
}

export interface Conversation {
  partner: Profile;
  last_message: Message | null;
  unread_count: number;
}

export type Notification = Database['public']['Tables']['notifications']['Row'];
