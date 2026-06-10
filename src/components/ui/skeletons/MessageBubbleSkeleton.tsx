import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { spacing } from '@/constants/theme';

interface MessageBubbleSkeletonProps {
  /** Render the bubble on the left (other-person, default) or right (own). */
  side?: 'left' | 'right';
  /** Approximate bubble width — mirrors the variable bubble widths in real
   * conversations so the loading state doesn't look like a perfectly aligned
   * grid. Defaults to 'medium'. */
  width?: 'short' | 'medium' | 'long';
  /** Stagger the shimmer pulse so a column of bubbles feels alive. */
  index?: number;
}

/**
 * Skeleton placeholder for a single chat bubble. Mirrors the rounded-pill
 * silhouette of `ChatBubble`. Use a vertical stack of these (alternating
 * sides + widths) inside chat screens while `useMessages` / `useEventMessages`
 * / `useCircleMessages` are still in their initial-fetch state.
 */
export function MessageBubbleSkeleton({
  side = 'left',
  width = 'medium',
  index = 0,
}: MessageBubbleSkeletonProps) {
  const pixelWidth = WIDTH_PRESETS[width];
  return (
    <View
      style={[
        styles.row,
        side === 'right' && styles.rowOwn,
      ]}
    >
      <SkeletonBlock width={pixelWidth} height={36} radius={18} delay={index} />
    </View>
  );
}

/**
 * Convenience: a vertical stack of bubble skeletons that mimics a live chat
 * loading in. Alternates sides and widths so the skeleton has the same
 * visual rhythm as a real conversation.
 */
export function MessageBubbleSkeletonList() {
  return (
    <View style={styles.list}>
      <MessageBubbleSkeleton side="left" width="long" index={0} />
      <MessageBubbleSkeleton side="right" width="short" index={0.3} />
      <MessageBubbleSkeleton side="left" width="medium" index={0.6} />
      <MessageBubbleSkeleton side="right" width="medium" index={0.9} />
      <MessageBubbleSkeleton side="left" width="short" index={1.2} />
      <MessageBubbleSkeleton side="right" width="long" index={1.5} />
    </View>
  );
}

const WIDTH_PRESETS = { short: 110, medium: 170, long: 240 };

const styles = StyleSheet.create({
  list: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
});
