import type { Database } from './supabase';
import type { Profile } from './user.types';
import type { Event } from './event.types';
import type { Circle } from './circle.types';

export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];

export type DirectMessageRead = Database['public']['Tables']['direct_message_reads']['Row'];
export type EventMessageRead = Database['public']['Tables']['event_message_reads']['Row'];
export type CircleMessageRead = Database['public']['Tables']['circle_message_reads']['Row'];

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

/** Group chat row in the inbox — bound to a circle. last_message is null
 *  for empty circle chats (you joined, no one has posted yet). */
export interface CircleConversation {
  kind: 'circle';
  circle: Circle;
  last_message: Message | null;
  unread_count: number;
}

export type Conversation = DMConversation | EventConversation | CircleConversation;

/** Stable key for routing + dedup. */
export function conversationKey(conv: Conversation): string {
  if (conv.kind === 'dm') return conv.partner.id;
  if (conv.kind === 'event') return conv.event.id;
  return conv.circle.id;
}

export type Notification = Database['public']['Tables']['notifications']['Row'];
