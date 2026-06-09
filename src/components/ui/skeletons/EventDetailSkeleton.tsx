import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { colors, spacing } from '@/constants/theme';

/**
 * Skeleton for the event detail screen — hero poster, title, meta line,
 * organiser row, body paragraph. Mirrors `EventDetail` enough that the swap
 * to real content lands without a jump.
 */
export function EventDetailSkeleton() {
  return (
    <View style={styles.container}>
      <SkeletonBlock width="100%" height={320} radius={0} delay={0} />

      <View style={styles.body}>
        <SkeletonBlock width="85%" height={28} radius={6} delay={0.5} />
        <SkeletonBlock width="55%" height={28} radius={6} delay={0.7} />

        <View style={styles.metaRow}>
          <SkeletonBlock width={120} height={14} radius={3} delay={0.9} />
          <SkeletonBlock width={100} height={14} radius={3} delay={1.1} />
        </View>

        <View style={styles.organiser}>
          <SkeletonBlock width={42} height={42} radius={21} delay={1.3} />
          <View style={styles.organiserText}>
            <SkeletonBlock width={140} height={14} radius={3} delay={1.5} />
            <SkeletonBlock width={90} height={12} radius={3} delay={1.7} />
          </View>
        </View>

        <View style={styles.paragraph}>
          <SkeletonBlock width="100%" height={14} radius={3} delay={1.9} />
          <SkeletonBlock width="100%" height={14} radius={3} delay={2.1} />
          <SkeletonBlock width="100%" height={14} radius={3} delay={2.3} />
          <SkeletonBlock width="75%" height={14} radius={3} delay={2.5} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  body: {
    padding: spacing.base,
    gap: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  organiser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  organiserText: {
    flex: 1,
    gap: 6,
  },
  paragraph: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
});
