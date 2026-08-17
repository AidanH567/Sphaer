import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '@/constants/theme';
import { useCirclePinnedEvents } from '@/hooks/useCirclePinnedEvents';
import { relativeDayLabel } from '@/utils/pinned-events';
import { MiniCalendarStrip } from './MiniCalendarStrip';
import { PinnedEventRow } from './PinnedEventRow';

interface PinnedEventsSectionProps {
  circleId: string | undefined;
  /** Circle name, used only in the empty-state copy. */
  circleName?: string | null;
}

/** How many rows the expanded list shows before "See all in the circle". */
const MAX_ROWS = 4;

/**
 * The pinned-events section that sits between a circle chat's header and its
 * conversation (Lara meeting notes 2026-08-17, point 5: "a section of pinned
 * events, a clear mini-calendar overview so events don't get lost in the
 * conversation").
 *
 * Collapsed by default and one line tall. The collapsed line already answers
 * the actual question — what is next, and when — so the common case costs the
 * conversation ~44pt. Expanding reveals the mini-calendar strip and the list.
 * A section that opened expanded would push the newest messages off screen on
 * a 390x844 phone, which trades one lost thing for another.
 *
 * Nothing is pinned by hand: "pinned" means "an upcoming event of this
 * circle", derived from `events.circle_id`. See getCircleUpcomingEvents.
 */
export function PinnedEventsSection({ circleId, circleName }: PinnedEventsSectionProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const { events, visibleEvents, days, selectedDay, toggleDay, isLoading, error, refetch } =
    useCirclePinnedEvents(circleId);

  // Stay out of the way until we know — a skeleton above a live conversation
  // is noise, and the section is supplementary to the chat, never blocking.
  if (isLoading) return null;

  if (error) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.summaryRow}
          onPress={refetch}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Retry loading upcoming events"
        >
          <Ionicons name="calendar-outline" size={16} color={colors.neutral.neutral400} />
          <Text style={styles.quietText}>Couldn&apos;t load upcoming events. Tap to retry.</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Honest empty state: one quiet line, no icon circle, no CTA, no empty box
  // pretending to be a calendar. It says what is true and takes up 44pt.
  if (events.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.summaryRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.neutral.neutral400} />
          <Text style={styles.quietText} numberOfLines={1}>
            Nothing coming up in {circleName ?? 'this circle'} yet.
          </Text>
        </View>
      </View>
    );
  }

  const next = events[0];
  const rows = visibleEvents.slice(0, MAX_ROWS);
  const hiddenCount = visibleEvents.length - rows.length;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.summaryRow}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${events.length} upcoming ${
          events.length === 1 ? 'event' : 'events'
        }. Next: ${next.title}. ${expanded ? 'Collapse' : 'Expand'}`}
      >
        <Ionicons name="bookmark" size={15} color={colors.neutral.chocolate} />
        <Text style={styles.summaryLabel}>Upcoming</Text>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{events.length}</Text>
        </View>
        <Text style={styles.summaryNext} numberOfLines={1}>
          {next.title} · {relativeDayLabel(next.starts_at, new Date())}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.neutral.neutral400}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expanded}>
          <MiniCalendarStrip days={days} selectedDay={selectedDay} onSelectDay={toggleDay} />

          {rows.length === 0 ? (
            <Text style={styles.quietTextInset}>Nothing on that day.</Text>
          ) : (
            rows.map((event) => (
              <PinnedEventRow
                key={event.id}
                event={event}
                onPress={(id) => router.push(`/event/${id}`)}
              />
            ))
          )}

          {hiddenCount > 0 && circleId && (
            <TouchableOpacity
              style={styles.moreRow}
              onPress={() => router.push(`/circles/${circleId}`)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.moreText}>
                {hiddenCount} more in this circle
              </Text>
              <Ionicons name="arrow-forward" size={14} color={colors.neutral.meta} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.divider,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  summaryLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.chocolate,
  },
  countPill: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.body,
  },
  // Takes the remaining width so the chevron stays pinned right and long
  // titles truncate instead of pushing it off screen.
  summaryNext: {
    flex: 1,
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.neutral.meta,
    textAlign: 'right',
  },
  expanded: {
    paddingBottom: spacing.sm,
  },
  quietText: {
    flex: 1,
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.neutral.neutral400,
  },
  quietTextInset: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    color: colors.neutral.neutral400,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
  },
  moreText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.meta,
  },
});
