import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';
import type { CalendarDay } from '@/utils/pinned-events';

interface MiniCalendarStripProps {
  days: CalendarDay[];
  /** Local `YYYY-MM-DD` currently filtering the list, or null. */
  selectedDay: string | null;
  onSelectDay: (key: string) => void;
}

/**
 * The mini-calendar: a horizontally scrolling two-week strip of day cells,
 * one dot under any day something starts on. Tapping a marked day filters
 * the pinned list to it; tapping it again clears the filter.
 *
 * Kept deliberately small — this sits on top of a conversation, so it is a
 * 64pt-tall strip, not a month grid. Days with nothing on them stay in the
 * strip (so the shape of the fortnight is readable) but are not tappable and
 * are dimmed, which is what makes the marked days pop without any colour.
 */
export function MiniCalendarStrip({ days, selectedDay, onSelectDay }: MiniCalendarStripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      accessibilityLabel="Upcoming two weeks"
    >
      {days.map((day) => {
        const hasEvents = day.eventCount > 0;
        const isSelected = selectedDay === day.key;
        return (
          <TouchableOpacity
            key={day.key}
            style={[
              styles.cell,
              day.isToday && styles.cellToday,
              isSelected && styles.cellSelected,
            ]}
            disabled={!hasEvents}
            activeOpacity={0.7}
            onPress={() => onSelectDay(day.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled: !hasEvents }}
            accessibilityLabel={
              hasEvents
                ? `${day.weekdayLabel} ${day.dayOfMonth}, ${day.eventCount} ${
                    day.eventCount === 1 ? 'event' : 'events'
                  }`
                : `${day.weekdayLabel} ${day.dayOfMonth}, nothing on`
            }
          >
            <Text
              style={[
                styles.weekday,
                !hasEvents && styles.dim,
                isSelected && styles.textSelected,
              ]}
            >
              {day.weekdayLabel}
            </Text>
            <Text
              style={[
                styles.dayNumber,
                !hasEvents && styles.dim,
                isSelected && styles.textSelected,
              ]}
            >
              {day.dayOfMonth}
            </Text>
            <View
              style={[
                styles.dot,
                hasEvents && styles.dotOn,
                isSelected && styles.dotSelected,
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const CELL_WIDTH = 40;

const styles = StyleSheet.create({
  strip: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  cell: {
    width: CELL_WIDTH,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  // Today gets an outline rather than a fill so selection stays the only
  // filled state and the two never read as the same thing.
  cellToday: {
    borderColor: colors.neutral.divider,
  },
  cellSelected: {
    backgroundColor: colors.neutral.chocolate,
    borderColor: colors.neutral.chocolate,
  },
  weekday: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.meta,
  },
  dayNumber: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.chocolate,
  },
  dim: {
    color: colors.neutral.neutral400,
    fontWeight: typography.fontWeight.regular,
  },
  textSelected: {
    color: colors.white,
  },
  // Always laid out, even when off — otherwise cells with and without events
  // would be different heights and the strip would look ragged.
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  dotOn: {
    backgroundColor: colors.neutral.chocolate,
  },
  dotSelected: {
    backgroundColor: colors.white,
  },
});
