import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import * as messagesService from '@/services/messages.service';
import type {
  Message,
  MessageWithSender,
  OptimisticMessage,
} from '@/types/message.types';

function toOptimistic(
  msg: MessageWithSender,
  overrides?: Partial<OptimisticMessage>
): OptimisticMessage {
  return {
    ...msg,
    client_id: msg.id,
    status: 'sent',
    ...overrides,
  };
}

function generateClientId(): string {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useMessages(userId: string | undefined, partnerId: string | undefined) {
  const [messages, setMessages] = useState<OptimisticMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partnerLastReadAt, setPartnerLastReadAt] = useState<string | null>(null);

  const messagesRef = useRef<OptimisticMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!userId || !partnerId) return;
    setIsLoading(true);
    setError(null);

    let cancelled = false;

    Promise.all([
      messagesService.getMessages(userId, partnerId),
      messagesService.getPartnerLastRead(userId, partnerId),
    ])
      .then(([msgs, lastRead]) => {
        if (cancelled) return;
        setMessages(msgs.map((m) => toOptimistic(m)));
        setPartnerLastReadAt(lastRead);
      })
      .catch((err) => {
        if (cancelled) return;
        // Surface the error so the UI can render an error state instead of
        // an empty thread. Logged for dev visibility too.
        console.error('[useMessages] initial fetch failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to load messages.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    const channel = supabase
      .channel(`chat:${[userId, partnerId].sort().join('-')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.sender_id !== partnerId || msg.circle_id) return;
          if (messagesRef.current.some((m) => m.id === msg.id)) return;
          setMessages((prev) => [...prev, toOptimistic(msg as MessageWithSender)]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_message_reads',
          filter: `user_id=eq.${partnerId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as
            | { partner_id?: string; last_read_at?: string }
            | null;
          if (row?.partner_id !== userId) return;
          if (row?.last_read_at) setPartnerLastReadAt(row.last_read_at);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, [userId, partnerId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!userId || !partnerId) return;
      const trimmed = content.trim();
      if (!trimmed) return;

      const clientId = generateClientId();
      const optimistic: OptimisticMessage = {
        id: clientId,
        client_id: clientId,
        sender_id: userId,
        recipient_id: partnerId,
        circle_id: null,
        event_id: null,
        content: trimmed,
        created_at: new Date().toISOString(),
        sender: null,
        status: 'pending',
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const real = await messagesService.sendMessage({
          sender_id: userId,
          recipient_id: partnerId,
          circle_id: null,
          content: trimmed,
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.client_id === clientId ? toOptimistic(real, { client_id: clientId }) : m
          )
        );
      } catch (err) {
        console.error('[useMessages] sendMessage failed:', err);
        setMessages((prev) =>
          prev.map((m) => (m.client_id === clientId ? { ...m, status: 'failed' } : m))
        );
      }
    },
    [userId, partnerId]
  );

  const retryMessage = useCallback(
    async (clientId: string) => {
      if (!userId || !partnerId) return;
      const failed = messagesRef.current.find((m) => m.client_id === clientId);
      if (!failed || failed.status !== 'failed') return;

      setMessages((prev) =>
        prev.map((m) => (m.client_id === clientId ? { ...m, status: 'pending' } : m))
      );
      try {
        const real = await messagesService.sendMessage({
          sender_id: userId,
          recipient_id: partnerId,
          circle_id: null,
          content: failed.content,
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.client_id === clientId ? toOptimistic(real, { client_id: clientId }) : m
          )
        );
      } catch (err) {
        console.error('[useMessages] retryMessage failed:', err);
        setMessages((prev) =>
          prev.map((m) => (m.client_id === clientId ? { ...m, status: 'failed' } : m))
        );
      }
    },
    [userId, partnerId]
  );

  return { messages, isLoading, error, partnerLastReadAt, sendMessage, retryMessage };
}
