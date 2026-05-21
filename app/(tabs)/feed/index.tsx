import React, { useMemo, useState } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppContext } from '@/context/AppContext';
import { FeedHeader } from '@/components/feed/FeedHeader';
import { EventCard } from '@/components/feed/EventCard';
import { colors, spacing, typography } from '@/constants/theme';
import { MOCK_EVENTS } from '@/data/mockEvents';

// NOTE: the Feed currently renders mock data from src/data/mockEvents.ts.
// To switch to live Supabase data, replace MOCK_EVENTS with the useEvents()
// hook (src/hooks/useEvents.ts) — the EventCard props are already compatible.

export default function FeedScreen() {
  const router = useRouter();
  const { feedView, setFeedView, feedFilters, setFeedFilters } = useAppContext();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Feed is always chronological — sort by start date, then filter by category.
  const events = useMemo(() => {
    const selected = feedFilters.categories ?? [];
    return [...MOCK_EVENTS]
      .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))
      .filter(
        (e) =>
          selected.length === 0 ||
          (e.categories ?? []).some((c) => selected.includes(c))
      );
  }, [feedFilters.categories]);

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
      />

      {events.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No events found</Text>
        </View>
      ) : (
        <FlatList
          data={events}
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
  },
  empty: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
  },
});
