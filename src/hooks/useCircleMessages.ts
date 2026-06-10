import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import * as messagesService from '@/services/messages.service';
import type {
  Message,
  MessageWithSender,
  OptimisticMessage,
} from '@/types/message.types';
import type { Profile } from '@/types/user.types';

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

/**
 * Circle group chat hook. Mirrors useEventMessages: loads history, subscribes
 * to live INSERTs filtered by circle_id, optimistic send + retry, sender
 * profile cache for realtime payloads that come in without the join.
 * No "Seen X" tracking — group chats skip the line by design.
 */
export function useCircleMessages(userId: string | undefined, circleId: string | undefined) {
  const [messages, setMessages] = useState<OptimisticMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);
  const refetch = useCallback(() => setRefetchTick((n) => n + 1), []);

  const messagesRef = useRef<OptimisticMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const sendersCacheRef = useRef<Map<string, Profile>>(new Map());

  useEffect(() => {
    if (!userId || !circleId) return;
    setIsLoading(true);
    setError(null);
    sendersCacheRef.current.clear();

    let cancelled = false;

    messagesService
      .getCircleMessages(circleId)
      .then((msgs) => {
        if (cancelled) return;
        msgs.forEach((m) => {
          if (m.sender) sendersCacheRef.current.set(m.sender_id, m.sender);
        });
        setMessages(msgs.map((m) => toOptimistic(m)));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[useCircleMessages] initial fetch failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chat.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    const channel = supabase
      .channel(`circle-chat-screen:${circleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `circle_id=eq.${circleId}`,
        },
        async (payload) => {
          const msg = payload.new as Message;
          if (messagesRef.current.some((m) => m.id === msg.id)) return;

          let sender: Profile | null = sendersCacheRef.current.get(msg.sender_id) ?? null;
          if (!sender) {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', msg.sender_id)
              .maybeSingle();
            if (data) {
              sender = data;
              sendersCacheRef.current.set(msg.sender_id, data);
            }
          }
          const enriched: MessageWithSender = { ...msg, sender };
          if (messagesRef.current.some((m) => m.id === msg.id)) return;
          setMessages((prev) => [...prev, toOptimistic(enriched)]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, [userId, circleId, refetchTick]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!userId || !circleId) return;
      const trimmed = content.trim();
      if (!trimmed) return;

      const clientId = generateClientId();
      const ownProfile = sendersCacheRef.current.get(userId) ?? null;
      const optimistic: OptimisticMessage = {
        id: clientId,
        client_id: clientId,
        sender_id: userId,
        recipient_id: null,
        circle_id: circleId,
        event_id: null,
        content: trimmed,
        created_at: new Date().toISOString(),
        sender: ownProfile,
        status: 'pending',
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const real = await messagesService.sendCircleMessage(userId, circleId, trimmed);
        if (real.sender) sendersCacheRef.current.set(real.sender_id, real.sender);
        setMessages((prev) =>
          prev.map((m) =>
            m.client_id === clientId ? toOptimistic(real, { client_id: clientId }) : m
          )
        );
      } catch (err) {
        console.error('[useCircleMessages] sendMessage failed:', err);
        setMessages((prev) =>
          prev.map((m) => (m.client_id === clientId ? { ...m, status: 'failed' } : m))
        );
      }
    },
    [userId, circleId]
  );

  const retryMessage = useCallback(
    async (clientId: string) => {
      if (!userId || !circleId) return;
      const failed = messagesRef.current.find((m) => m.client_id === clientId);
      if (!failed || failed.status !== 'failed') return;

      setMessages((prev) =>
        prev.map((m) => (m.client_id === clientId ? { ...m, status: 'pending' } : m))
      );
      try {
        const real = await messagesService.sendCircleMessage(userId, circleId, failed.content);
        if (real.sender) sendersCacheRef.current.set(real.sender_id, real.sender);
        setMessages((prev) =>
          prev.map((m) =>
            m.client_id === clientId ? toOptimistic(real, { client_id: clientId }) : m
          )
        );
      } catch (err) {
        console.error('[useCircleMessages] retryMessage failed:', err);
        setMessages((prev) =>
          prev.map((m) => (m.client_id === clientId ? { ...m, status: 'failed' } : m))
        );
      }
    },
    [userId, circleId]
  );

  return { messages, isLoading, error, sendMessage, retryMessage, refetch };
}
