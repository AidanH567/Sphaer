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

  // Search + neighbourhood now live in AppContext so Feed / Map / Mural
  // share filter state. Mural can opt in later — Feed and Map opt in now.
  const searchText = feedFilters.search ?? '';

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
  // upcoming server changes shift ordering. Then apply search + neighbourhood
  // filters client-side.
  const visibleEvents = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const hood = (feedFilters.neighborhood ?? '').toLowerCase();
    const base = [...events].sort(
      (a, b) => +new Date(b.created_at ?? 0) - +new Date(a.created_at ?? 0)
    );
    return base.filter((e) => {
      if (q.length > 0) {
        const haystack = [
          e.title,
          e.description ?? '',
          e.location_name ?? '',
          e.address ?? '',
          (e.categories ?? []).join(' '),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (hood.length > 0) {
        // Prefer the structured `neighbourhood` column when present
        // (set by Places autocomplete on Create Activity). Fall back
        // to substring match on address/location for older events
        // that don't have it yet.
        if (e.neighbourhood) {
          if (e.neighbourhood.toLowerCase() !== hood) return false;
        } else {
          const locHaystack = `${e.address ?? ''} ${e.location_name ?? ''}`.toLowerCase();
          if (!locHaystack.includes(hood)) return false;
        }
      }
      return true;
    });
  }, [events, searchText, feedFilters.neighborhood]);

  function toggleCategory(cat: string) {
    const current = feedFilters.categories ?? [];
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    setFeedFilters({ ...feedFilters, categories: next.length ? next : undefined });
  }

  function setSearch(text: string) {
    setFeedFilters({ ...feedFilters, search: text || undefined });
  }

  function setNeighborhood(n: string | null) {
    setFeedFilters({ ...feedFilters, neighborhood: n ?? undefined });
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
        onSearchChange={setSearch}
        selectedNeighborhood={feedFilters.neighborhood ?? null}
        onNeighborhoodChange={setNeighborhood}
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
