import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/context/AuthContext';
import * as messagesService from '@/services/messages.service';
import type {
  Conversation,
  DMConversation,
  EventConversation,
  Message,
} from '@/types/message.types';
import type { Profile } from '@/types/user.types';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Discriminated target for marking a conversation as read. DMs key by the
 * other user's profile id; event chats key by the event id.
 */
export type MarkReadTarget =
  | { kind: 'dm'; partnerId: string }
  | { kind: 'event'; eventId: string };

interface MessagesContextValue {
  conversations: Conversation[];
  totalUnread: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  markRead: (target: MarkReadTarget) => Promise<void>;
}

const MessagesContext = createContext<MessagesContextValue>({
  conversations: [],
  totalUnread: 0,
  isLoading: true,
  refresh: async () => {},
  markRead: async () => {},
});

async function fetchPartnerProfile(partnerId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', partnerId)
    .maybeSingle();
  return data ?? null;
}

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const userId = user?.id;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const conversationsRef = useRef<Conversation[]>([]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Map<eventId, RealtimeChannel>. Reconciled against `conversations` so that
  // every event chat the user can see has exactly one open subscription.
  const eventChannelsRef = useRef<Map<string, RealtimeChannel>>(new Map());

  const refresh = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      setIsLoading(false);
      return;
    }
    try {
      const data = await messagesService.getConversations(userId);
      setConversations(data);
    } catch (err) {
      console.error('[MessagesContext] refresh failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Handle an incoming DM (from recipient_id=me or sender_id=me filters).
  const handleIncomingDM = useCallback(
    async (msg: Message) => {
      if (!userId || msg.circle_id || msg.event_id) return;
      const isIncoming = msg.recipient_id === userId;
      const partnerId = isIncoming ? msg.sender_id : msg.recipient_id;
      if (!partnerId) return;

      const existingPartner = conversationsRef.current.find(
        (c): c is DMConversation => c.kind === 'dm' && c.partner.id === partnerId
      )?.partner;

      let partner: Profile | null = existingPartner ?? null;
      if (!partner) {
        partner = await fetchPartnerProfile(partnerId);
        if (!partner) return;
      }
      const partnerResolved = partner;

      setConversations((prev) => {
        const found = prev.find(
          (c): c is DMConversation => c.kind === 'dm' && c.partner.id === partnerId
        );
        const updated: DMConversation = {
          kind: 'dm',
          partner: partnerResolved,
          last_message: msg,
          unread_count: isIncoming
            ? (found?.unread_count ?? 0) + 1
            : found?.unread_count ?? 0,
        };
        const rest = prev.filter(
          (c) => !(c.kind === 'dm' && c.partner.id === partnerId)
        );
        return [updated, ...rest];
      });
    },
    [userId]
  );

  // Handle an incoming event message. Fired from a per-event channel filtered
  // by event_id=eq.<eventId>, so we trust msg.event_id is set. Looks up the
  // event metadata from the current conversations list (it's always there
  // because we only subscribe to events we have a row for).
  const handleIncomingEventMessage = useCallback(
    (msg: Message) => {
      if (!userId || !msg.event_id) return;
      const eventId = msg.event_id;

      setConversations((prev) => {
        const existing = prev.find(
          (c): c is EventConversation => c.kind === 'event' && c.event.id === eventId
        );
        if (!existing) {
          // We subscribed to this event but it's not in our conversations
          // yet (e.g. registered just now, refresh in flight). Trigger one.
          refresh();
          return prev;
        }
        const isIncoming = msg.sender_id !== userId;
        const updated: EventConversation = {
          kind: 'event',
          event: existing.event,
          last_message: msg,
          unread_count: isIncoming ? existing.unread_count + 1 : existing.unread_count,
        };
        const rest = prev.filter(
          (c) => !(c.kind === 'event' && c.event.id === eventId)
        );
        return [updated, ...rest];
      });
    },
    [userId, refresh]
  );

  // Keep a ref to the event handler so each per-event channel callback (created
  // once when the channel opens) always invokes the latest closure.
  const handleEventMessageRef = useRef(handleIncomingEventMessage);
  useEffect(() => {
    handleEventMessageRef.current = handleIncomingEventMessage;
  }, [handleIncomingEventMessage]);

  // Reconcile per-event channels: every event in `conversations` should have
  // one open channel; events that left the list get their channel closed.
  useEffect(() => {
    const wantedIds = new Set(
      conversations
        .filter((c): c is EventConversation => c.kind === 'event')
        .map((c) => c.event.id)
    );
    const channels = eventChannelsRef.current;

    // Close channels for events no longer in scope.
    for (const [id, ch] of Array.from(channels.entries())) {
      if (!wantedIds.has(id)) {
        ch.unsubscribe();
        channels.delete(id);
      }
    }

    // Open channels for new events.
    for (const id of wantedIds) {
      if (channels.has(id)) continue;
      const ch = supabase
        .channel(`event-chat:${id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `event_id=eq.${id}`,
          },
          (payload) => handleEventMessageRef.current(payload.new as Message)
        )
        .subscribe();
      channels.set(id, ch);
    }
  }, [conversations]);

  const markRead = useCallback(
    async (target: MarkReadTarget) => {
      if (!userId) return;
      if (target.kind === 'dm') {
        setConversations((prev) =>
          prev.map((c) =>
            c.kind === 'dm' && c.partner.id === target.partnerId
              ? { ...c, unread_count: 0 }
              : c
          )
        );
        try {
          await messagesService.markRead(userId, target.partnerId);
        } catch (err) {
          console.error('[MessagesContext] markRead (dm) failed:', err);
        }
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.kind === 'event' && c.event.id === target.eventId
              ? { ...c, unread_count: 0 }
              : c
          )
        );
        try {
          await messagesService.markEventRead(userId, target.eventId);
        } catch (err) {
          console.error('[MessagesContext] markRead (event) failed:', err);
        }
      }
    },
    [userId]
  );

  // Global subscriptions: DM events, DM read state, event read state, and
  // registration changes (so we know when to refresh the event chat list).
  useEffect(() => {
    if (!userId) {
      setConversations([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    refresh();

    const channel = supabase
      .channel(`messages-context:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => handleIncomingDM(payload.new as Message)
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${userId}`,
        },
        (payload) => {
          // Only DM-shape; circle/event messages I sent are handled by their
          // own per-event channels (avoids double-counting).
          const msg = payload.new as Message;
          if (msg.circle_id || msg.event_id) return;
          handleIncomingDM(msg);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_message_reads',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { partner_id?: string } | null;
          if (!row?.partner_id) return;
          const pid = row.partner_id;
          setConversations((prev) =>
            prev.map((c) =>
              c.kind === 'dm' && c.partner.id === pid
                ? { ...c, unread_count: 0 }
                : c
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_message_reads',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { event_id?: string } | null;
          if (!row?.event_id) return;
          const eid = row.event_id;
          setConversations((prev) =>
            prev.map((c) =>
              c.kind === 'event' && c.event.id === eid
                ? { ...c, unread_count: 0 }
                : c
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_registrations',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Registration added/removed → conversation list might change.
          // Re-fetch; the reconcile effect will then add/remove channels.
          refresh();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      for (const ch of eventChannelsRef.current.values()) {
        ch.unsubscribe();
      }
      eventChannelsRef.current.clear();
    };
  }, [userId, refresh, handleIncomingDM]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unread_count, 0),
    [conversations]
  );

  const value = useMemo(
    () => ({ conversations, totalUnread, isLoading, refresh, markRead }),
    [conversations, totalUnread, isLoading, refresh, markRead]
  );

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

export function useMessagesContext() {
  return useContext(MessagesContext);
}
