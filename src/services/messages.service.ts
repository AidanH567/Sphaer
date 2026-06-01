import { supabase } from '@/lib/supabase';
import type {
  Message,
  MessageInsert,
  MessageWithSender,
  Conversation,
} from '@/types/message.types';
import type { Profile } from '@/types/user.types';

export async function getConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc('get_conversations', { p_user_id: userId });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    partner: row.partner as unknown as Profile,
    last_message: row.last_message as unknown as Message,
    unread_count: Number(row.unread_count ?? 0),
  }));
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

export async function getCircleMessages(circleId: string): Promise<MessageWithSender[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(`*, sender:profiles!messages_sender_id_fkey(*)`)
    .eq('circle_id', circleId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as MessageWithSender[]) ?? [];
}
