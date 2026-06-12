import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@/context/AuthContext';
import { useMessagesContext } from '@/context/MessagesContext';
import { useEventMessages } from '@/hooks/useEventMessages';
import { ChatBubble } from '@/components/messaging/ChatBubble';
import { MessageInput } from '@/components/messaging/MessageInput';
import { supabase } from '@/lib/supabase';
import { colors, typography, spacing } from '@/constants/theme';
import type { OptimisticMessage } from '@/types/message.types';
import type { Event } from '@/types/event.types';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ErrorState } from '@/components/ui/ErrorState';
import { MessageBubbleSkeletonList } from '@/components/ui/skeletons/MessageBubbleSkeleton';

const GROUP_GAP_MS = 5 * 60 * 1000;

interface DisplayMessage extends OptimisticMessage {
  showTimestamp: boolean;
  showAttribution: boolean;
}

export default function EventChatScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthContext();
  const { markRead, conversations } = useMessagesContext();
  const isFocused = useIsFocused();

  // Event metadata: prefer the conversations cache, fall back to a single
  // events row fetch (covers the just-registered-not-refreshed-yet case).
  const cachedEvent = useMemo(() => {
    const found = conversations.find(
      (c) => c.kind === 'event' && c.event.id === eventId
    );
    return found?.kind === 'event' ? found.event : null;
  }, [conversations, eventId]);
  const [event, setEvent] = useState<Event | null>(cachedEvent);
  useEffect(() => {
    if (cachedEvent) {
      setEvent(cachedEvent);
      return;
    }
    if (!eventId) return;
    let cancelled = false;
    supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setEvent(data as Event);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, cachedEvent]);

  const { messages, isLoading, error, sendMessage, retryMessage, refetch } = useEventMessages(
    user?.id,
    eventId
  );

  // Mark read on focus + whenever messages change while focused.
  useEffect(() => {
    if (!user?.id || !eventId || !isFocused) return;
    markRead({ kind: 'event', eventId });
  }, [user?.id, eventId, isFocused, messages.length, markRead]);

  const display: DisplayMessage[] = useMemo(() => {
    const flagged = messages.map<DisplayMessage>((m, i) => {
      const prev = i > 0 ? messages[i - 1] : null;
      const sameSenderAsPrev = prev?.sender_id === m.sender_id;
      const withinGroupGap =
        prev &&
        new Date(m.created_at ?? 0).getTime() - new Date(prev.created_at ?? 0).getTime() <=
          GROUP_GAP_MS;
      const isFirstInGroup = !sameSenderAsPrev || !withinGroupGap;
      return {
        ...m,
        showTimestamp: isFirstInGroup,
        // Attribution appears at the start of each sender-group, on non-own
        // messages only. Bubble component handles the isOwn skip internally.
        showAttribution: isFirstInGroup,
      };
    });
    return flagged.slice().reverse();
  }, [messages]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        {event && (
          <TouchableOpacity
            style={styles.eventInfo}
            onPress={() => router.push(`/event/${eventId}`)}
            accessibilityRole="button"
            accessibilityHint="Opens the event details"
          >
            {event.poster_url ? (
              <Image source={{ uri: event.poster_url }} style={styles.posterThumb} />
            ) : (
              <View style={[styles.posterThumb, styles.posterFallback]}>
                <Ionicons name="calendar" size={16} color={colors.text.tertiary} />
              </View>
            )}
            <Text style={styles.eventTitle} numberOfLines={1}>
              {event.title}
            </Text>
          </TouchableOpacity>
        )}
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {isLoading ? (
          <MessageBubbleSkeletonList />
        ) : error ? (
          <ErrorState
            icon="chatbubble-ellipses-outline"
            title="Couldn't load chat"
            body={error}
            onRetry={refetch}
            onBack={() => router.back()}
          />
        ) : (
          <FlatList
            data={display}
            keyExtractor={(item) => item.client_id}
            inverted
            renderItem={({ item }) => {
              const isOwn = item.sender_id === user?.id;
              const showAttr = item.showAttribution && !isOwn;
              return (
                <ChatBubble
                  message={item}
                  isOwn={isOwn}
                  showTimestamp={item.showTimestamp}
                  senderName={
                    showAttr
                      ? item.sender?.display_name ??
                        item.sender?.username ??
                        null
                      : null
                  }
                  senderAvatarUrl={showAttr ? item.sender?.avatar_url ?? null : null}
                  onRetry={
                    item.status === 'failed' ? () => retryMessage(item.client_id) : undefined
                  }
                />
              );
            }}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={36} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>No messages yet — say hi to your activity group.</Text>
              </View>
            }
          />
        )}

        <MessageInput onSend={sendMessage} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Figma 6298:6104: 48px-tall thumb in the chat header. Posters keep their
// existing square crop + soft corners (rounding scaled with the size bump).
const POSTER_SIZE = 48;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  // Figma Tabbar_Title Side 6298:6104: soft shadow instead of a border.
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: 10,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 1,
  },
  backButton: { padding: spacing.sm },
  eventInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  posterThumb: {
    width: POSTER_SIZE,
    height: POSTER_SIZE,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  posterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: {
    flex: 1,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.ink,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: spacing.base, flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    // Inverted FlatList: scaleY(-1) flips the empty component too; counter-flip.
    transform: [{ scaleY: -1 }],
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('messages-event');
