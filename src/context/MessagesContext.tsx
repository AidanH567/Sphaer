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
import type { Conversation, Message } from '@/types/message.types';
import type { Profile } from '@/types/user.types';

interface MessagesContextValue {
  conversations: Conversation[];
  totalUnread: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  markRead: (partnerId: string) => Promise<void>;
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

  const handleIncomingMessage = useCallback(
    async (msg: Message) => {
      if (!userId || msg.circle_id) return;
      const isIncoming = msg.recipient_id === userId;
      const partnerId = isIncoming ? msg.sender_id : msg.recipient_id;
      if (!partnerId) return;

      const existingPartner = conversationsRef.current.find(
        (c) => c.partner.id === partnerId
      )?.partner;

      let partner: Profile | null = existingPartner ?? null;
      if (!partner) {
        partner = await fetchPartnerProfile(partnerId);
        if (!partner) return;
      }

      const partnerResolved = partner;
      setConversations((prev) => {
        const existing = prev.find((c) => c.partner.id === partnerId);
        const updated: Conversation = {
          partner: partnerResolved,
          last_message: msg,
          unread_count: isIncoming
            ? (existing?.unread_count ?? 0) + 1
            : existing?.unread_count ?? 0,
        };
        const rest = prev.filter((c) => c.partner.id !== partnerId);
        return [updated, ...rest];
      });
    },
    [userId]
  );

  const handleReadUpdate = useCallback((partnerId: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.partner.id === partnerId ? { ...c, unread_count: 0 } : c
      )
    );
  }, []);

  const markRead = useCallback(
    async (partnerId: string) => {
      if (!userId) return;
      handleReadUpdate(partnerId);
      try {
        await messagesService.markRead(userId, partnerId);
      } catch (err) {
        console.error('[MessagesContext] markRead failed:', err);
      }
    },
    [userId, handleReadUpdate]
  );

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
        (payload) => handleIncomingMessage(payload.new as Message)
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${userId}`,
        },
        (payload) => handleIncomingMessage(payload.new as Message)
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
          if (row?.partner_id) handleReadUpdate(row.partner_id);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId, refresh, handleIncomingMessage, handleReadUpdate]);

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
