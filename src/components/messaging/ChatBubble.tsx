import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { formatMessageTime } from '@/utils/date';
import type { OptimisticMessage } from '@/types/message.types';

interface ChatBubbleProps {
  message: OptimisticMessage;
  isOwn: boolean;
  showTimestamp: boolean;
  seenLabel?: string | null;
  onRetry?: () => void;
}

export function ChatBubble({
  message,
  isOwn,
  showTimestamp,
  seenLabel,
  onRetry,
}: ChatBubbleProps) {
  const isFailed = message.status === 'failed';
  const isPending = message.status === 'pending';

  return (
    <View style={styles.outer}>
      {showTimestamp && (
        <Text style={styles.groupTime}>{formatMessageTime(message.created_at)}</Text>
      )}
      <View style={[styles.wrapper, isOwn && styles.wrapperOwn]}>
        <TouchableOpacity
          activeOpacity={isFailed ? 0.6 : 1}
          disabled={!isFailed}
          onPress={onRetry}
        >
          <View
            style={[
              styles.bubble,
              isOwn ? styles.bubbleOwn : styles.bubbleOther,
              isFailed && styles.bubbleFailed,
              isPending && styles.bubblePending,
            ]}
          >
            <Text style={[styles.text, isOwn && styles.textOwn]}>{message.content}</Text>
          </View>
        </TouchableOpacity>
        {isFailed && (
          <Text style={styles.failedLabel}>Not delivered. Tap to retry.</Text>
        )}
      </View>
      {isOwn && seenLabel && <Text style={styles.seenLabel}>{seenLabel}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { marginVertical: 1 },
  groupTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  wrapper: {
    marginHorizontal: spacing.base,
    alignItems: 'flex-start',
    maxWidth: '80%',
  },
  wrapperOwn: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleOwn: { backgroundColor: colors.black },
  bubbleOther: { backgroundColor: colors.surface },
  bubbleFailed: { backgroundColor: colors.badge.red },
  bubblePending: { opacity: 0.6 },
  text: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: typography.fontSize.base * 1.4,
  },
  textOwn: { color: colors.white },
  failedLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.badge.red,
    marginTop: 2,
    marginHorizontal: spacing.xs,
  },
  seenLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    alignSelf: 'flex-end',
    marginTop: 2,
    marginRight: spacing.base,
  },
});
