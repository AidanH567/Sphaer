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
 * Event group chat hook. Loads history, subscribes to live INSERTs for this
 * event, supports optimistic send + retry.
 *
 * Sender info: the service join pre-populates `sender` for every historical
 * message. Realtime INSERTs arrive without the join, so we cache profiles
 * keyed by sender_id and fetch the profile if it's a sender we haven't seen.
 *
 * No "Seen X" tracking — group chats skip the line by design.
 */
export function useEventMessages(userId: string | undefined, eventId: string | undefined) {
  const [messages, setMessages] = useState<OptimisticMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const messagesRef = useRef<OptimisticMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Sender profiles seen in this chat. Realtime INSERTs don't carry the join
  // payload, so we look up the sender from here first; fall back to a single
  // profiles query if unseen.
  const sendersCacheRef = useRef<Map<string, Profile>>(new Map());

  useEffect(() => {
    if (!userId || !eventId) return;
    setIsLoading(true);
    setError(null);
    sendersCacheRef.current.clear();

    let cancelled = false;

    messagesService
      .getEventMessages(eventId)
      .then((msgs) => {
        if (cancelled) return;
        msgs.forEach((m) => {
          if (m.sender) sendersCacheRef.current.set(m.sender_id, m.sender);
        });
        setMessages(msgs.map((m) => toOptimistic(m)));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[useEventMessages] initial fetch failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chat.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    const channel = supabase
      .channel(`event-chat-screen:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          const msg = payload.new as Message;
          if (messagesRef.current.some((m) => m.id === msg.id)) return;

          // Resolve sender profile (cache → fallback fetch).
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
          // Re-check dedup post-await (other handler may have prepended).
          if (messagesRef.current.some((m) => m.id === msg.id)) return;
          setMessages((prev) => [...prev, toOptimistic(enriched)]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, [userId, eventId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!userId || !eventId) return;
      const trimmed = content.trim();
      if (!trimmed) return;

      const clientId = generateClientId();
      const ownProfile = sendersCacheRef.current.get(userId) ?? null;
      const optimistic: OptimisticMessage = {
        id: clientId,
        client_id: clientId,
        sender_id: userId,
        recipient_id: null,
        circle_id: null,
        event_id: eventId,
        content: trimmed,
        created_at: new Date().toISOString(),
        sender: ownProfile,
        status: 'pending',
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const real = await messagesService.sendEventMessage(userId, eventId, trimmed);
        if (real.sender) sendersCacheRef.current.set(real.sender_id, real.sender);
        setMessages((prev) =>
          prev.map((m) =>
            m.client_id === clientId ? toOptimistic(real, { client_id: clientId }) : m
          )
        );
      } catch (err) {
        console.error('[useEventMessages] sendMessage failed:', err);
        setMessages((prev) =>
          prev.map((m) => (m.client_id === clientId ? { ...m, status: 'failed' } : m))
        );
      }
    },
    [userId, eventId]
  );

  const retryMessage = useCallback(
    async (clientId: string) => {
      if (!userId || !eventId) return;
      const failed = messagesRef.current.find((m) => m.client_id === clientId);
      if (!failed || failed.status !== 'failed') return;

      setMessages((prev) =>
        prev.map((m) => (m.client_id === clientId ? { ...m, status: 'pending' } : m))
      );
      try {
        const real = await messagesService.sendEventMessage(userId, eventId, failed.content);
        if (real.sender) sendersCacheRef.current.set(real.sender_id, real.sender);
        setMessages((prev) =>
          prev.map((m) =>
            m.client_id === clientId ? toOptimistic(real, { client_id: clientId }) : m
          )
        );
      } catch (err) {
        console.error('[useEventMessages] retryMessage failed:', err);
        setMessages((prev) =>
          prev.map((m) => (m.client_id === clientId ? { ...m, status: 'failed' } : m))
        );
      }
    },
    [userId, eventId]
  );

  return { messages, isLoading, error, sendMessage, retryMessage };
}
