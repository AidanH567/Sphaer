import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { colors, spacing } from '@/constants/theme';

interface EventCardSkeletonProps {
  /** Index in the list — staggers the pulse so a column of cards feels alive. */
  index?: number;
}

/**
 * Skeleton for a single `EventCard`. Mirrors its 358×231 footprint with a
 * left content column (title + meta) and a right poster block.
 */
export function EventCardSkeleton({ index = 0 }: EventCardSkeletonProps) {
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <SkeletonBlock width="90%" height={20} radius={4} delay={index} />
        <SkeletonBlock width="70%" height={20} radius={4} delay={index + 0.3} />
        <View style={styles.metaBlock}>
          <SkeletonBlock width={70} height={12} radius={3} delay={index + 0.6} />
          <SkeletonBlock width={90} height={12} radius={3} delay={index + 0.9} />
          <SkeletonBlock width={110} height={12} radius={3} delay={index + 1.2} />
          <SkeletonBlock width={50} height={14} radius={3} delay={index + 1.5} />
        </View>
      </View>
      <SkeletonBlock width={163} height={227} radius={6} delay={index + 0.2} />
    </View>
  );
}

const CARD_HEIGHT = 231;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CARD_HEIGHT,
    backgroundColor: colors.white,
    borderRadius: 8,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    paddingLeft: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    gap: spacing.sm,
  },
  metaBlock: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
});
