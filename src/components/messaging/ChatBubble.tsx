import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { formatMessageTime } from '@/utils/date';
import type { MessageWithSender } from '@/types/message.types';

interface ChatBubbleProps {
  message: MessageWithSender;
  isOwn: boolean;
}

export function ChatBubble({ message, isOwn }: ChatBubbleProps) {
  return (
    <View style={[styles.wrapper, isOwn && styles.wrapperOwn]}>
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        <Text style={[styles.text, isOwn && styles.textOwn]}>{message.content}</Text>
      </View>
      <Text style={[styles.time, isOwn && styles.timeOwn]}>
        {formatMessageTime(message.created_at)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 2,
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
    backgroundColor: colors.surface,
  },
  bubbleOwn: {
    backgroundColor: colors.black,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
  },
  text: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: typography.fontSize.base * 1.4,
  },
  textOwn: { color: colors.white },
  time: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
    marginHorizontal: spacing.xs,
  },
  timeOwn: {},
});
