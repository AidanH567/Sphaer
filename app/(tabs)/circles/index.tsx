import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CircleCard } from '@/components/circles/CircleCard';
import { CircleJoinSheet } from '@/components/circles/CircleJoinSheet';
import { SearchFilterBar } from '@/components/feed/SearchFilterBar';
import { useCircles } from '@/hooks/useCircles';
import { colors, typography, spacing } from '@/constants/theme';
import type { CircleWithCounts } from '@/types/circle.types';

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

  const { circles, isLoading, refetch } = useCircles();

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
        searchPlaceholder="Find your community"
        selectedCategories={selectedCategories}
        onToggleCategory={toggleCategory}
        style={styles.headerOverride}
      />

      {isLoading && circles.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.black} />
        </View>
      ) : !hasResults ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={32} color={colors.text.tertiary} />
          <Text style={styles.empty}>
            {hasFilters
              ? 'No circles match your filters'
              : 'No circles yet'}
          </Text>
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
                    {tagCircles.length} {tagCircles.length === 1 ? 'circle' : 'circles'} across Berlin
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
  empty: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
