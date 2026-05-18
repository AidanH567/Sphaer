import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import * as messagesService from '@/services/messages.service';
import type { MessageWithSender, Conversation } from '@/types/message.types';

export function useConversations(userId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    messagesService
      .getConversations(userId)
      .then(setConversations)
      .finally(() => setIsLoading(false));
  }, [userId]);

  return { conversations, isLoading };
}

export function useMessages(userId: string | undefined, partnerId: string | undefined) {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!userId || !partnerId) return;
    const data = await messagesService.getMessages(userId, partnerId);
    setMessages(data);
  }, [userId, partnerId]);

  useEffect(() => {
    if (!userId || !partnerId) return;
    setIsLoading(true);
    fetchMessages().finally(() => setIsLoading(false));

    channelRef.current = supabase
      .channel(`messages:${[userId, partnerId].sort().join('-')}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [userId, partnerId, fetchMessages]);

  async function sendMessage(content: string) {
    if (!userId || !partnerId) return;
    await messagesService.sendMessage({
      sender_id: userId,
      recipient_id: partnerId,
      content,
    });
  }

  return { messages, isLoading, sendMessage };
}
