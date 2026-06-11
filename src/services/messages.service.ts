import { supabase } from '@/lib/supabase';
import type {
  Message,
  MessageInsert,
  MessageWithSender,
  Conversation,
} from '@/types/message.types';
import type { Profile } from '@/types/user.types';
import type { Event } from '@/types/event.types';
import type { Circle } from '@/types/circle.types';

// ── get_conversations JSONB guards ───────────────────────────────────────────
// The RPC returns `partner` / `last_message` as untyped JSONB built in SQL.
// These guards check only the fields the inbox actually renders
// (app/(tabs)/messages/index.tsx + MessagesContext keying), so drift in the
// SQL function's shape fails loudly here instead of rendering blank rows.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): boolean {
  return value === null || value === undefined || typeof value === 'string';
}

/** DM partner row: id (keying/routing) + username / display_name / avatar_url. */
function isProfileShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isNullableString(value.username) &&
    isNullableString(value.display_name) &&
    isNullableString(value.avatar_url)
  );
}

/** Event chat row: id (keying/routing) + title / poster_url. */
function isEventShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    isNullableString(value.poster_url)
  );
}

/** Circle chat row: id (keying/routing) + name / avatar_url. */
function isCircleShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isNullableString(value.avatar_url)
  );
}

/** Inbox preview line: content / sender_id + created_at timestamp. */
function isMessageShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.content === 'string' &&
    typeof value.sender_id === 'string' &&
    isNullableString(value.created_at)
  );
}

function validateShape<T>(
  value: unknown,
  column: 'partner' | 'last_message',
  shape: string,
  guard: (v: unknown) => boolean
): T {
  if (guard(value)) return value as T;
  const got = isRecord(value)
    ? `keys: ${Object.keys(value).join(', ') || '<empty object>'}`
    : `type: ${value === null ? 'null' : typeof value}`;
  throw new Error(`get_conversations: ${column} row failed ${shape} validation (got ${got})`);
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc('get_conversations', { p_user_id: userId });
  if (error) throw error;

  return (data ?? []).map((row): Conversation => {
    const last_message =
      row.last_message === null
        ? null
        : validateShape<Message>(row.last_message, 'last_message', 'Message', isMessageShape);
    const unread_count = Number(row.unread_count ?? 0);

    if (row.kind === 'event') {
      return {
        kind: 'event',
        event: validateShape<Event>(row.partner, 'partner', 'Event', isEventShape),
        last_message,
        unread_count,
      };
    }
    if (row.kind === 'circle') {
      return {
        kind: 'circle',
        circle: validateShape<Circle>(row.partner, 'partner', 'Circle', isCircleShape),
        last_message,
        unread_count,
      };
    }
    return {
      kind: 'dm',
      partner: validateShape<Profile>(row.partner, 'partner', 'Profile', isProfileShape),
      last_message,
      unread_count,
    };
  });
}

export async function getMessages(
  userId: string,
  partnerId: string
): Promise<MessageWithSender[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(`*, sender:profiles!messages_sender_id_fkey(*)`)
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${userId})`
    )
    .is('circle_id', null)
    .is('event_id', null)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as MessageWithSender[]) ?? [];
}

export async function sendMessage(message: MessageInsert): Promise<MessageWithSender> {
  if (message.sender_id === message.recipient_id) {
    throw new Error('Cannot message yourself.');
  }
  const { data, error } = await supabase
    .from('messages')
    .insert(message)
    .select(`*, sender:profiles!messages_sender_id_fkey(*)`)
    .single();
  if (error) throw error;
  return data as MessageWithSender;
}

export async function markRead(userId: string, partnerId: string): Promise<void> {
  const { error } = await supabase
    .from('direct_message_reads')
    .upsert(
      { user_id: userId, partner_id: partnerId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,partner_id' }
    );
  if (error) throw error;
}

export async function getPartnerLastRead(
  userId: string,
  partnerId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('direct_message_reads')
    .select('last_read_at')
    .eq('user_id', partnerId)
    .eq('partner_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.last_read_at ?? null;
}

// ── Event group chats ────────────────────────────────────────────────────────

export async function getEventMessages(eventId: string): Promise<MessageWithSender[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(`*, sender:profiles!messages_sender_id_fkey(*)`)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as MessageWithSender[]) ?? [];
}

export async function sendEventMessage(
  senderId: string,
  eventId: string,
  content: string
): Promise<MessageWithSender> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: senderId,
      event_id: eventId,
      recipient_id: null,
      circle_id: null,
      content,
    })
    .select(`*, sender:profiles!messages_sender_id_fkey(*)`)
    .single();
  if (error) throw error;
  return data as MessageWithSender;
}

export async function markEventRead(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('event_message_reads')
    .upsert(
      { user_id: userId, event_id: eventId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,event_id' }
    );
  if (error) throw error;
}

// ── Circle group chats ───────────────────────────────────────────────────────

export async function getCircleMessages(circleId: string): Promise<MessageWithSender[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(`*, sender:profiles!messages_sender_id_fkey(*)`)
    .eq('circle_id', circleId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as MessageWithSender[]) ?? [];
}

export async function sendCircleMessage(
  senderId: string,
  circleId: string,
  content: string
): Promise<MessageWithSender> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: senderId,
      circle_id: circleId,
      recipient_id: null,
      event_id: null,
      content,
    })
    .select(`*, sender:profiles!messages_sender_id_fkey(*)`)
    .single();
  if (error) throw error;
  return data as MessageWithSender;
}

export async function markCircleRead(userId: string, circleId: string): Promise<void> {
  const { error } = await supabase
    .from('circle_message_reads')
    .upsert(
      { user_id: userId, circle_id: circleId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,circle_id' }
    );
  if (error) throw error;
}
