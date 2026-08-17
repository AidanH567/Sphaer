import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '@/constants/theme';
import { formatEventDateShort } from '@/utils/date';
import type { EventWithRelations } from '@/types/event.types';

export const POSTER_THUMB = 48;

interface ActivityRowProps {
  event: EventWithRelations;
  onPress: () => void;
  showDivider: boolean;
  /** Optional trailing tag, e.g. "Ticket" or "Hosting". */
  badge?: string;
}

/**
 * One compact activity row: 48px poster thumb, title, short date.
 *
 * Lifted out of the deleted UserEventsSheet unchanged so the inline tab
 * lists on both profile screens keep the exact row treatment users already
 * know — the restructure moved WHERE the list lives, not what a row looks
 * like.
 */
function ActivityRowImpl({ event, onPress, showDivider, badge }: ActivityRowProps) {
  const dateLabel = formatEventDateShort(event.starts_at);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${dateLabel}`}
    >
      <View style={styles.row}>
        {event.poster_url ? (
          <Image source={{ uri: event.poster_url }} style={styles.posterThumb} />
        ) : (
          <View style={[styles.posterThumb, styles.posterPlaceholder]}>
            <Ionicons name="calendar-outline" size={18} color={colors.text.tertiary} />
          </View>
        )}
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={styles.rowDate} numberOfLines={1}>
            {dateLabel}
          </Text>
        </View>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </View>
      {showDivider && <View style={styles.divider} />}
    </TouchableOpacity>
  );
}

export const ActivityRow = React.memo(ActivityRowImpl);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.chocolate,
  },
  rowDate: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: colors.neutral.neutral600,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    // Align with the text column after the poster thumb.
    marginLeft: POSTER_THUMB + spacing.md,
  },
  posterThumb: {
    width: POSTER_THUMB,
    height: POSTER_THUMB,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  badgeText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.neutral600,
  },
});
