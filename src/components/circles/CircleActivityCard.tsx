import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';
import type { MockCircleActivity } from '@/data/mockCircles';

interface CircleActivityCardProps {
  activity: MockCircleActivity;
}

/**
 * Compact activity card used in the Circle detail "Upcoming Activities"
 * section — title + date/time on the left, square image on the right.
 */
export function CircleActivityCard({ activity }: CircleActivityCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={3}>
          {activity.title}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.metaLine}>{activity.dateLabel}</Text>
          <Text style={styles.metaLine}>{activity.timeLabel}</Text>
          {activity.location && (
            <Text style={styles.metaLine} numberOfLines={1}>
              {activity.location}
            </Text>
          )}
        </View>
      </View>

      <Image source={{ uri: activity.image }} style={styles.image} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    minHeight: 116,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  content: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 17,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    lineHeight: 22,
  },
  meta: {
    marginTop: spacing.sm,
  },
  metaLine: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: colors.text.tertiary,
    lineHeight: 18,
  },
  image: {
    width: 116,
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
  },
});
