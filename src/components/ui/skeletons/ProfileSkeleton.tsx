import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { colors, spacing } from '@/constants/theme';

/**
 * Skeleton for the profile screen — avatar circle, name, role/location lines,
 * stats row, action button, then a section block (about) and a 3-up image
 * grid. Mirrors `ProfileView`'s hero + first-section + gallery so the
 * transition into the real data lands without a layout shift.
 */
export function ProfileSkeleton() {
  return (
    <View style={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <SkeletonBlock width={90} height={90} radius={45} delay={0} />
        <SkeletonBlock width={180} height={26} radius={6} delay={0.3} />
        <SkeletonBlock width={220} height={14} radius={4} delay={0.5} />
        <SkeletonBlock width={120} height={14} radius={4} delay={0.7} />

        <View style={styles.stats}>
          <SkeletonStatItem delay={0.9} />
          <SkeletonStatItem delay={1.1} />
          <SkeletonStatItem delay={1.3} />
          <SkeletonStatItem delay={1.5} />
        </View>

        <SkeletonBlock width="100%" height={48} radius={24} delay={1.7} />
      </View>

      {/* About */}
      <View style={styles.section}>
        <SkeletonBlock width={70} height={18} radius={4} delay={2.0} />
        <SkeletonBlock width="100%" height={14} radius={3} delay={2.2} />
        <SkeletonBlock width="100%" height={14} radius={3} delay={2.4} />
        <SkeletonBlock width="65%" height={14} radius={3} delay={2.6} />
      </View>

      {/* Image grid */}
      <View style={styles.section}>
        <SkeletonBlock width={70} height={18} radius={4} delay={2.8} />
        <View style={styles.imageRow}>
          <SkeletonBlock width="31.5%" height={108} radius={7} delay={3.0} />
          <SkeletonBlock width="31.5%" height={108} radius={7} delay={3.2} />
          <SkeletonBlock width="31.5%" height={108} radius={7} delay={3.4} />
        </View>
      </View>
    </View>
  );
}

function SkeletonStatItem({ delay }: { delay: number }) {
  return (
    <View style={styles.statItem}>
      <SkeletonBlock width={50} height={12} radius={3} delay={delay} />
      <SkeletonBlock width={36} height={18} radius={4} delay={delay + 0.1} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  statItem: {
    alignItems: 'center',
    gap: 6,
    minWidth: 60,
  },
  section: {
    gap: spacing.sm,
  },
  imageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
