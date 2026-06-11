import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CircleCard } from '@/components/circles/CircleCard';
import { CircleJoinSheet } from '@/components/circles/CircleJoinSheet';
import { SearchFilterBar } from '@/components/feed/SearchFilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CircleCardSkeleton } from '@/components/ui/skeletons/CircleCardSkeleton';
import { useCircles } from '@/hooks/useCircles';
import { colors, typography, spacing } from '@/constants/theme';
import type { CircleWithCounts } from '@/types/circle.types';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

/**
 * Browse circles. Uses the same SearchFilterBar component as the Activity
 * Feed so search + category filtering behave identically across both pages.
 *
 * Filter semantics:
 *   - searchText:  client-side match against name, description, tags
 *   - categories:  intersection — show circles whose `tags[]` includes at
 *                  least one of the selected categories
 *
 * After filtering, surviving circles are grouped by tag for the standard
 * "category rows" layout. Sections with zero circles don't render, so
 * selecting "Music" naturally collapses the page to a single Music row.
 */
export default function CirclesScreen() {
  const [searchText, setSearchText] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<CircleWithCounts | null>(null);

  const { circles, isLoading, error, refetch } = useCircles();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  // 1. Search filter, 2. Category filter, 3. Group by tag.
  const groupedByTag = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    const textFiltered = q
      ? circles.filter((c) => {
          const haystack = [c.name, c.description ?? '', (c.tags ?? []).join(' ')]
            .join(' ')
            .toLowerCase();
          return haystack.includes(q);
        })
      : circles;

    const categoryFiltered = selectedCategories.length === 0
      ? textFiltered
      : textFiltered.filter((c) =>
          (c.tags ?? []).some((t) => selectedCategories.includes(t))
        );

    // Bucket each circle into each of its tags. A circle with two tags
    // appears in two groups — fine for browsing.
    const groups = new Map<string, CircleWithCounts[]>();
    for (const circle of categoryFiltered) {
      const tags = circle.tags ?? [];
      if (tags.length === 0) {
        const key = 'Other';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(circle);
      } else {
        for (const tag of tags) {
          // When the user has filtered by category, only render groups for
          // those categories — otherwise unrelated tags from multi-tag
          // circles would clutter the result.
          if (selectedCategories.length > 0 && !selectedCategories.includes(tag)) {
            continue;
          }
          if (!groups.has(tag)) groups.set(tag, []);
          groups.get(tag)!.push(circle);
        }
      }
    }

    return Array.from(groups.entries())
      .sort((a, b) => b[1].length - a[1].length);
  }, [circles, searchText, selectedCategories]);

  const hasResults = groupedByTag.length > 0;
  const hasFilters = searchText.length > 0 || selectedCategories.length > 0;

  return (
    <View style={styles.container}>
      <SearchFilterBar
        searchText={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Find your scene, find your thing!"
        selectedCategories={selectedCategories}
        onToggleCategory={toggleCategory}
        style={styles.headerOverride}
      />

      {isLoading && circles.length === 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {[0, 1].map((sectionIdx) => (
            <View key={sectionIdx} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderText}>
                  <View style={styles.skeletonHeaderTitle} />
                  <View style={styles.skeletonHeaderSub} />
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}
              >
                {[0, 1, 2].map((cardIdx) => (
                  <CircleCardSkeleton key={cardIdx} index={sectionIdx * 3 + cardIdx} />
                ))}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      ) : error && circles.length === 0 ? (
        <ErrorState
          icon="cloud-offline-outline"
          title="Couldn't load circles"
          body={error}
          onRetry={refetch}
        />
      ) : !hasResults ? (
        <View style={styles.center}>
          <EmptyState
            icon="people-outline"
            title={hasFilters ? 'No matches' : 'No circles yet'}
            body={
              hasFilters
                ? 'Try clearing a filter or searching for a different name.'
                : 'Circles are how artists and crews stay connected. Start one or follow an artist who runs one.'
            }
            centered
            spaced
          />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.black} />
          }
        >
          {groupedByTag.map(([tag, tagCircles]) => (
            <View key={tag} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>{tag}</Text>
                  <Text style={styles.sectionSubtitle}>
                    {/* Figma 2665:12253 subtitle format: "Join 24 Film circles
                        across Berlin" — includes the category name. */}
                    Join {tagCircles.length} {tag}{' '}
                    {tagCircles.length === 1 ? 'circle' : 'circles'} across Berlin
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.text.secondary} />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}
              >
                {tagCircles.map((circle) => (
                  <CircleCard
                    key={`${tag}-${circle.id}`}
                    circle={circle}
                    onPress={() => setSelectedCircle(circle)}
                  />
                ))}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      )}

      <CircleJoinSheet
        circle={selectedCircle}
        onClose={() => setSelectedCircle(null)}
        onJoined={() => {
          refetch();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  // Override SearchFilterBar's default appleMail background to match the
  // Circles page surface colour.
  headerOverride: { backgroundColor: colors.surface },

  scroll: { paddingBottom: 110 },
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
    marginTop: 2,
  },
  row: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  // Skeleton-only header placeholders (no shimmer — just a sized block so
  // the section header has the same visual mass as the populated one).
  skeletonHeaderTitle: {
    width: 120,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#E7E2D5',
    marginBottom: 4,
  },
  skeletonHeaderSub: {
    width: 90,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#EFEAE0',
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('circles-browse');
