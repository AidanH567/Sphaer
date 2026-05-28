import React, { useMemo, useState } from 'react';
import { FlatList, View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { FeedHeader } from '@/components/feed/FeedHeader';
import { EventCard } from '@/components/feed/EventCard';
import { useEvents } from '@/hooks/useEvents';
import { colors, spacing, typography } from '@/constants/theme';

/**
 * Activity feed. Pulls real `events` rows from Supabase via useEvents().
 * Mock data was retired when we moved to the seeded-demo strategy (see
 * scripts/seed-demo-data.ts) — the database always has content.
 *
 * Filtering: category multi-select is sent to the service query (overlaps
 * on `events.categories[]`). Search is client-side across title/description/
 * location_name/address/categories — small data set, see grilling Q6c.
 */
export default function FeedScreen() {
  const router = useRouter();
  const { feedView, setFeedView, feedFilters, setFeedFilters } = useAppContext();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');

  const { events, isLoading, refetch } = useEvents({
    categories: feedFilters.categories,
  });

  // Refetch whenever the feed comes back into focus — covers the
  // "just created an activity, come back to feed" case.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Newest first so freshly published activities land on top. Service query
  // already orders by created_at desc; the client sort is defensive in case
  // upcoming server changes shift ordering. Then apply client-side search.
  const visibleEvents = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const base = [...events].sort(
      (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
    );
    if (q.length === 0) return base;
    return base.filter((e) => {
      const haystack = [
        e.title,
        e.description ?? '',
        e.location_name ?? '',
        e.address ?? '',
        (e.categories ?? []).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [events, searchText]);

  function toggleCategory(cat: string) {
    const current = feedFilters.categories ?? [];
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    setFeedFilters({ ...feedFilters, categories: next.length ? next : undefined });
  }

  function toggleSave(eventId: string) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.has(eventId) ? next.delete(eventId) : next.add(eventId);
      return next;
    });
  }

  return (
    <View style={styles.container}>
      <FeedHeader
        activeView={feedView}
        onViewChange={(v) => {
          setFeedView(v);
          if (v === 'map') router.push('/(tabs)/feed/map');
          else if (v === 'mural') router.push('/(tabs)/feed/mural');
        }}
        selectedCategories={feedFilters.categories ?? []}
        onToggleCategory={toggleCategory}
        onSearchChange={setSearchText}
      />

      {isLoading && events.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.black} />
        </View>
      ) : visibleEvents.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>
            {searchText ? `No activities match "${searchText}"` : 'No activities yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              isSaved={savedIds.has(item.id)}
              onSave={() => toggleSave(item.id)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.black} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appleMail },
  list: { paddingTop: spacing.base, paddingBottom: spacing['4xl'] },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  empty: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
