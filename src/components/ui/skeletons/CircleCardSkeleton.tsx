import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { colors } from '@/constants/theme';

interface CircleCardSkeletonProps {
  index?: number;
}

/**
 * Skeleton for a single `CircleCard`. Mirrors its 176×313 box — circular
 * image up top, title + meta counts below.
 */
export function CircleCardSkeleton({ index = 0 }: CircleCardSkeletonProps) {
  return (
    <View style={styles.card}>
      <SkeletonBlock width={148} height={148} radius={74} delay={index} />
      <View style={styles.content}>
        <SkeletonBlock width="90%" height={16} radius={4} delay={index + 0.3} />
        <SkeletonBlock width="60%" height={16} radius={4} delay={index + 0.5} />
        <View style={styles.meta}>
          <SkeletonBlock width={64} height={11} radius={3} delay={index + 0.7} />
          <SkeletonBlock width={56} height={11} radius={3} delay={index + 0.9} />
        </View>
      </View>
    </View>
  );
}

const CARD_WIDTH = 176;
const CARD_HEIGHT = 313;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
  },
  meta: {
    marginTop: 8,
    alignItems: 'center',
    gap: 4,
  },
});
