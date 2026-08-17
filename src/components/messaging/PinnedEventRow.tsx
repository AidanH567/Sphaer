import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { formatEventTimeRange } from '@/utils/date';
import type { EventWithRelations } from '@/types/event.types';

interface PinnedEventRowProps {
  event: EventWithRelations;
  onPress: (eventId: string) => void;
}

/**
 * One compact line in the pinned-events list: a date block, the title, and
 * the time + place. 56pt thumbnail on the right when the event has a poster.
 *
 * Not `CircleActivityCard` — that one is a 116pt card built for the circle
 * profile page, which would push the conversation off screen if three of them
 * stacked above it. This is the same information at chat density.
 */
export function PinnedEventRow({ event, onPress }: PinnedEventRowProps) {
  const start = new Date(event.starts_at);
  const dayNumber = start.toLocaleDateString('en-GB', { day: 'numeric' });
  const monthLabel = start.toLocaleDateString('en-GB', { month: 'short' });
  const timeLabel = formatEventTimeRange(event.starts_at, event.ends_at);
  const place = event.location_name ?? event.address ?? null;

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => onPress(event.id)}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${dayNumber} ${monthLabel}, ${timeLabel}`}
    >
      <View style={styles.dateBlock}>
        <Text style={styles.dateDay}>{dayNumber}</Text>
        <Text style={styles.dateMonth}>{monthLabel.toUpperCase()}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {place ? `${timeLabel} · ${place}` : timeLabel}
        </Text>
      </View>

      {event.poster_url ? (
        <Image source={{ uri: event.poster_url }} style={styles.thumb} contentFit="cover" />
      ) : null}

      <Ionicons name="chevron-forward" size={16} color={colors.neutral.neutral400} />
    </TouchableOpacity>
  );
}

const THUMB = 40;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  dateBlock: {
    width: 34,
    alignItems: 'center',
  },
  dateDay: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.ink,
    lineHeight: 20,
  },
  dateMonth: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.meta,
    letterSpacing: 0.5,
  },
  body: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.chocolate,
  },
  meta: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.neutral.cardMeta,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
});
