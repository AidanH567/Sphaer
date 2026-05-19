import { supabase } from '@/lib/supabase';
import type { MessageInsert, MessageWithSender, Conversation } from '@/types/message.types';

export async function getConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(`*, sender:profiles!messages_sender_id_fkey(*)`)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .is('circle_id', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const seen = new Set<string>();
  const conversations: Conversation[] = [];

  for (const msg of data ?? []) {
    const partnerId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
    if (!partnerId || seen.has(partnerId)) continue;
    seen.add(partnerId);

    const { data: partnerData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', partnerId)
      .single();

    if (partnerData) {
      conversations.push({
        partner: partnerData,
        last_message: msg,
        unread_count: 0,
      });
    }
  }

  return conversations;
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

export async function sendMessage(message: MessageInsert) {
  const { data, error } = await supabase.from('messages').insert(message).select().single();
  if (error) throw error;
  return data;
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
