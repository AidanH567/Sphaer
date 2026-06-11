import React, { useEffect, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@/context/AuthContext';
import { useMessagesContext } from '@/context/MessagesContext';
import { useProfile } from '@/hooks/useProfile';
import { useMessages } from '@/hooks/useMessages';
import { ChatBubble } from '@/components/messaging/ChatBubble';
import { MessageInput } from '@/components/messaging/MessageInput';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorState } from '@/components/ui/ErrorState';
import { MessageBubbleSkeletonList } from '@/components/ui/skeletons/MessageBubbleSkeleton';
import { colors, typography, spacing } from '@/constants/theme';
import { formatSeenTime } from '@/utils/date';
import type { OptimisticMessage } from '@/types/message.types';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

const GROUP_GAP_MS = 5 * 60 * 1000;

interface DisplayMessage extends OptimisticMessage {
  showTimestamp: boolean;
  isLastSeen: boolean;
}

export default function ConversationScreen() {
  const { id: partnerId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthContext();
  const { profile: partner } = useProfile(partnerId);
  const { markRead } = useMessagesContext();
  const isFocused = useIsFocused();

  const {
    messages,
    isLoading,
    error,
    partnerLastReadAt,
    sendMessage,
    retryMessage,
    refetch,
  } = useMessages(user?.id, partnerId);

  useEffect(() => {
    if (!user?.id || !partnerId || !isFocused) return;
    markRead({ kind: 'dm', partnerId });
  }, [user?.id, partnerId, isFocused, messages.length, markRead]);

  const display: DisplayMessage[] = useMemo(() => {
    let lastSeenOwnId: string | null = null;
    if (partnerLastReadAt) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (
          m.sender_id === user?.id &&
          m.status === 'sent' &&
          (m.created_at ?? '') <= partnerLastReadAt
        ) {
          lastSeenOwnId = m.id;
          break;
        }
      }
    }

    const flagged = messages.map<DisplayMessage>((m, i) => {
      const prev = i > 0 ? messages[i - 1] : null;
      const isFirstInGroup =
        !prev ||
        prev.sender_id !== m.sender_id ||
        new Date(m.created_at ?? 0).getTime() - new Date(prev.created_at ?? 0).getTime() > GROUP_GAP_MS;
      return {
        ...m,
        showTimestamp: isFirstInGroup,
        isLastSeen: m.id === lastSeenOwnId,
      };
    });

    return flagged.slice().reverse();
  }, [messages, partnerLastReadAt, user?.id]);

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
        {partner && (
          <TouchableOpacity
            style={styles.partnerInfo}
            onPress={() => router.push(`/user/${partnerId}`)}
            accessibilityRole="button"
            accessibilityHint="Opens their profile"
          >
            <Avatar uri={partner.avatar_url} name={partner.display_name ?? ''} size={THUMB} />
            <View style={styles.headerText}>
              <Text style={styles.partnerName} numberOfLines={1}>
                {partner.display_name ?? partner.username}
              </Text>
              {/* Figma 6298:6104 shows a meta line under the title; the truthful
                  cheap equivalent here is the @handle — skip it when it would
                  just repeat the title (no display_name). */}
              {partner.display_name && partner.username ? (
                <Text style={styles.headerMeta} numberOfLines={1}>
                  @{partner.username}
                </Text>
              ) : null}
            </View>
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
            renderItem={({ item }) => (
              <ChatBubble
                message={item}
                isOwn={item.sender_id === user?.id}
                showTimestamp={item.showTimestamp}
                seenLabel={item.isLastSeen ? formatSeenTime(partnerLastReadAt!) : null}
                onRetry={
                  item.status === 'failed' ? () => retryMessage(item.client_id) : undefined
                }
              />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}

        <MessageInput onSend={sendMessage} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Figma 6298:6104: 48px avatar in the chat header.
const THUMB = 48;

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
  partnerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  headerText: { flex: 1, gap: 2 },
  partnerName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.ink,
  },
  headerMeta: {
    fontSize: 12,
    fontWeight: typography.fontWeight.medium,
    color: '#949494', // Figma neutral-500
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: spacing.base },
});

export const ErrorBoundary = makeRouteErrorBoundary('messages-dm');
