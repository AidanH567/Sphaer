import type { Database } from './supabase';
import type { Profile } from './user.types';
import type { Event } from './event.types';

export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];

export type DirectMessageRead = Database['public']['Tables']['direct_message_reads']['Row'];
export type EventMessageRead = Database['public']['Tables']['event_message_reads']['Row'];

export interface MessageWithSender extends Message {
  sender: Profile | null;
}

export type MessageStatus = 'pending' | 'sent' | 'failed';

export interface OptimisticMessage extends MessageWithSender {
  status: MessageStatus;
  client_id: string;
}

/** 1:1 conversation row in the inbox — partner is the other user. */
export interface DMConversation {
  kind: 'dm';
  partner: Profile;
  last_message: Message | null;
  unread_count: number;
}

/** Group chat row in the inbox — bound to an event. last_message is null
 *  for empty event chats (you registered, no one has posted yet). */
export interface EventConversation {
  kind: 'event';
  event: Event;
  last_message: Message | null;
  unread_count: number;
}

export type Conversation = DMConversation | EventConversation;

/** Stable key for routing + dedup. DMs key by partner profile id; event
 *  chats key by event id. */
export function conversationKey(conv: Conversation): string {
  return conv.kind === 'dm' ? conv.partner.id : conv.event.id;
}

export type Notification = Database['public']['Tables']['notifications']['Row'];
