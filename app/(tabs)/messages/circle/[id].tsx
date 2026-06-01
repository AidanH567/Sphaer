import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@/context/AuthContext';
import { useMessagesContext } from '@/context/MessagesContext';
import { useCircleMessages } from '@/hooks/useCircleMessages';
import { ChatBubble } from '@/components/messaging/ChatBubble';
import { MessageInput } from '@/components/messaging/MessageInput';
import { supabase } from '@/lib/supabase';
import { colors, typography, spacing } from '@/constants/theme';
import type { OptimisticMessage } from '@/types/message.types';
import type { Circle } from '@/types/circle.types';

const GROUP_GAP_MS = 5 * 60 * 1000;

interface DisplayMessage extends OptimisticMessage {
  showTimestamp: boolean;
  showAttribution: boolean;
}

export default function CircleChatScreen() {
  const { id: circleId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthContext();
  const { markRead, conversations } = useMessagesContext();
  const isFocused = useIsFocused();

  const cachedCircle = useMemo(() => {
    const found = conversations.find(
      (c) => c.kind === 'circle' && c.circle.id === circleId
    );
    return found?.kind === 'circle' ? found.circle : null;
  }, [conversations, circleId]);
  const [circle, setCircle] = useState<Circle | null>(cachedCircle);
  useEffect(() => {
    if (cachedCircle) {
      setCircle(cachedCircle);
      return;
    }
    if (!circleId) return;
    let cancelled = false;
    supabase
      .from('circles')
      .select('*')
      .eq('id', circleId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setCircle(data as Circle);
      });
    return () => {
      cancelled = true;
    };
  }, [circleId, cachedCircle]);

  const { messages, isLoading, sendMessage, retryMessage } = useCircleMessages(
    user?.id,
    circleId
  );

  useEffect(() => {
    if (!user?.id || !circleId || !isFocused) return;
    markRead({ kind: 'circle', circleId });
  }, [user?.id, circleId, isFocused, messages.length, markRead]);

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
        showAttribution: isFirstInGroup,
      };
    });
    return flagged.slice().reverse();
  }, [messages]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        {circle && (
          <TouchableOpacity
            style={styles.circleInfo}
            onPress={() => router.push(`/circles/${circleId}`)}
          >
            {circle.avatar_url ? (
              <Image source={{ uri: circle.avatar_url }} style={styles.circleThumb} />
            ) : (
              <View style={[styles.circleThumb, styles.circleFallback]}>
                <Ionicons name="people" size={16} color={colors.text.tertiary} />
              </View>
            )}
            <Text style={styles.circleTitle} numberOfLines={1}>
              {circle.name}
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
          <View style={styles.center}>
            <ActivityIndicator color={colors.black} />
          </View>
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
                <Ionicons name="people-outline" size={36} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>
                  No messages yet — say hi to the {circle?.name ?? 'circle'} crew.
                </Text>
              </View>
            }
          />
        )}

        <MessageInput onSend={sendMessage} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const THUMB = 32;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { padding: spacing.sm },
  circleInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  circleThumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.surface,
  },
  circleFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleTitle: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: spacing.base, flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    transform: [{ scaleY: -1 }],
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
