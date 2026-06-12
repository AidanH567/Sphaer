import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { useMessagesContext } from '@/context/MessagesContext';
import { useProfile } from '@/hooks/useProfile';
import { useMessages } from '@/hooks/useMessages';
import { ChatBubble } from '@/components/messaging/ChatBubble';
import { MessageInput } from '@/components/messaging/MessageInput';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { ErrorState } from '@/components/ui/ErrorState';
import { OverflowMenuSheet } from '@/components/ui/OverflowMenuSheet';
import { ReportSheet } from '@/components/moderation/ReportSheet';
import { MessageBubbleSkeletonList } from '@/components/ui/skeletons/MessageBubbleSkeleton';
import {
  blockUser,
  unblockUser,
  ModerationUnavailableError,
} from '@/services/moderation.service';
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
  const { blockedIds, refreshBlocked } = useAppContext();
  const { profile: partner } = useProfile(partnerId);
  const { markRead } = useMessagesContext();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  // Moderation entry point (App Store 1.2): overflow → report / block.
  // While the partner is blocked the composer is replaced by an inline
  // unblock bar — history stays readable, sending is off.
  const partnerBlocked = Boolean(partnerId && blockedIds.has(partnerId));
  const partnerName = partner?.display_name ?? partner?.username ?? 'this user';
  const [overflowVisible, setOverflowVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [blockConfirmVisible, setBlockConfirmVisible] = useState(false);
  const [unblockBusy, setUnblockBusy] = useState(false);

  async function handleBlock() {
    if (!user?.id || !partnerId) return;
    try {
      await blockUser(user.id, partnerId);
      await refreshBlocked(); // swaps the composer for the unblock bar
      setBlockConfirmVisible(false);
    } catch (e: unknown) {
      if (e instanceof ModerationUnavailableError) {
        setBlockConfirmVisible(false);
        Alert.alert('Not available yet', e.message);
        return;
      }
      throw e; // ConfirmSheet alerts and keeps the sheet open for retry
    }
  }

  async function handleUnblock() {
    if (!user?.id || !partnerId || unblockBusy) return;
    setUnblockBusy(true);
    try {
      await unblockUser(user.id, partnerId);
      await refreshBlocked();
    } catch (e: unknown) {
      Alert.alert(
        'Could not unblock',
        e instanceof ModerationUnavailableError ? e.message : 'Please try again.'
      );
    } finally {
      setUnblockBusy(false);
    }
  }

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
        {/* Same footprint as the back button, so partnerInfo stays centered
            (this slot was a width-40 spacer before the overflow landed). */}
        <TouchableOpacity
          onPress={() => setOverflowVisible(true)}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.text.primary} />
        </TouchableOpacity>
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

        {partnerBlocked ? (
          <View style={[styles.blockedBar, { paddingBottom: insets.bottom + spacing.sm }]}>
            <Text style={styles.blockedBarText} numberOfLines={2}>
              You blocked {partnerName} — Unblock to message
            </Text>
            <TouchableOpacity
              onPress={handleUnblock}
              disabled={unblockBusy}
              accessibilityRole="button"
              accessibilityLabel={`Unblock ${partnerName}`}
            >
              <Text style={[styles.blockedBarAction, unblockBusy && styles.blockedBarActionBusy]}>
                {unblockBusy ? 'Unblocking…' : 'Unblock'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <MessageInput onSend={sendMessage} />
        )}
      </KeyboardAvoidingView>

      {/* Moderation sheets */}
      <OverflowMenuSheet
        visible={overflowVisible}
        actions={[
          {
            label: 'Report user',
            icon: 'flag-outline',
            onPress: () => setReportVisible(true),
          },
          partnerBlocked
            ? { label: 'Unblock', icon: 'person-add-outline', onPress: handleUnblock }
            : {
                label: 'Block',
                icon: 'person-remove-outline',
                destructive: true,
                onPress: () => setBlockConfirmVisible(true),
              },
        ]}
        onClose={() => setOverflowVisible(false)}
      />
      <ReportSheet
        visible={reportVisible}
        targetType="profile"
        targetId={partnerId ?? null}
        onClose={() => setReportVisible(false)}
      />
      <ConfirmSheet
        visible={blockConfirmVisible}
        title={`Block ${partnerName}?`}
        message="They won't be able to message you, and you won't see their activities or messages. They won't be notified."
        confirmLabel="Block"
        destructive
        onConfirm={handleBlock}
        onClose={() => setBlockConfirmVisible(false)}
      />
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
  // Replaces MessageInput while the partner is blocked — same top border
  // and bottom inset so the layout doesn't jump when toggling block state.
  blockedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },
  blockedBarText: {
    flex: 1,
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  blockedBarAction: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.chocolate,
    padding: spacing.xs,
  },
  blockedBarActionBusy: {
    opacity: 0.5,
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('messages-dm');
