import type { Database } from './supabase';
import type { Profile } from './user.types';

export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];

export type DirectMessageRead = Database['public']['Tables']['direct_message_reads']['Row'];

export interface MessageWithSender extends Message {
  sender: Profile | null;
}

export type MessageStatus = 'pending' | 'sent' | 'failed';

export interface OptimisticMessage extends MessageWithSender {
  status: MessageStatus;
  client_id: string;
}

export interface Conversation {
  partner: Profile;
  last_message: Message | null;
  unread_count: number;
}

export type Notification = Database['public']['Tables']['notifications']['Row'];
