import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { CircleCard } from './CircleCard';
import { CircleCardSkeleton } from '@/components/ui/skeletons/CircleCardSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { colors, typography, spacing } from '@/constants/theme';
import type { CircleWithCounts } from '@/types/circle.types';

interface MyCirclesSectionProps {
  /** Circles the user is a member of and/or follows. */
  circles: CircleWithCounts[];
  isLoading: boolean;
  /** True once we know there IS a signed-in user. Gates the empty state. */
  hasSession: boolean;
  /**
   * True when a search/category filter is narrowing the page. Changes the
   * empty copy: "none of your circles match this filter" is a different
   * statement from "you haven't joined any circles".
   */
  isFiltered: boolean;
  onSelect: (circle: CircleWithCounts) => void;
}

/**
 * "My circles" — the section that answers Lara #8: a member should be able to
 * find the circles they belong to without hunting through the discovery rows.
 *
 * Sits above the tag-grouped browse rows on the Circles screen and reuses the
 * same CircleCard + section-header vocabulary, so it reads as the first row of
 * the page rather than a foreign widget.
 *
 * Honest degradation, three distinct states:
 *   - no session      → renders nothing (we cannot know whose circles these are)
 *   - session, none   → header + a short empty state pointing at the rows below
 *   - session, filtered to nothing → says so, rather than claiming you have none
 */
export function MyCirclesSection({
  circles,
  isLoading,
  hasSession,
  isFiltered,
  onSelect,
}: MyCirclesSectionProps) {
  // Without a session "my circles" has no meaning. Rendering an empty state
  // here would assert the user has joined nothing, which we don't know.
  if (!hasSession) return null;

  const memberCount = circles.filter((c) => c.is_member).length;
  const followCount = circles.filter((c) => c.is_following && !c.is_member).length;

  return (
    <View style={styles.section} testID="my-circles-section">
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>My circles</Text>
          <Text style={styles.sectionSubtitle}>{buildSubtitle(memberCount, followCount)}</Text>
        </View>
      </View>

      {isLoading && circles.length === 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {[0, 1].map((i) => (
            <CircleCardSkeleton key={i} index={i} />
          ))}
        </ScrollView>
      ) : circles.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState
            body={
              isFiltered
                ? 'None of your circles match this filter.'
                : "You haven't joined a circle yet — browse below and tap one to join."
            }
          />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {circles.map((circle) => (
            <CircleCard
              key={`mine-${circle.id}`}
              circle={circle}
              onPress={() => onSelect(circle)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Member and follower are different relationships, so the subtitle names both
 * rather than merging them into one vague total. Exported for unit tests.
 */
export function buildSubtitle(memberCount: number, followCount: number): string {
  const parts: string[] = [];
  if (memberCount > 0) parts.push(`${memberCount} you're in`);
  if (followCount > 0) parts.push(`${followCount} you follow`);
  if (parts.length === 0) return 'Circles you join or follow show up here';
  return parts.join(' · ');
}

const styles = StyleSheet.create({
  // Mirrors the browse sections below so the page reads as one list.
  section: { marginTop: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md,
  },
  sectionHeaderText: { flex: 1 },
  sectionTitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 20,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  sectionSubtitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  row: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  empty: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
});
