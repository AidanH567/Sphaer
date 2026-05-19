import React, { useState } from 'react';
import { FlatList, View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppContext } from '@/context/AppContext';
import { useEvents } from '@/hooks/useEvents';
import { useAuthContext } from '@/context/AuthContext';
import { FeedHeader } from '@/components/feed/FeedHeader';
import { EventCard } from '@/components/feed/EventCard';
import { colors, spacing, typography } from '@/constants/theme';
import { saveEvent, unsaveEvent } from '@/services/events.service';
import type { EventWithRelations } from '@/types/event.types';

export default function FeedScreen() {
  const router = useRouter();
  const { feedView, setFeedView, feedFilters, setFeedFilters } = useAppContext();
  const { user } = useAuthContext();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const { events, isLoading, refetch } = useEvents(feedFilters);

  function toggleCategory(cat: string) {
    const current = feedFilters.categories ?? [];
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    setFeedFilters({ ...feedFilters, categories: next.length ? next : undefined });
  }

  async function toggleSave(event: EventWithRelations) {
    if (!user) return;
    const isSaved = savedIds.has(event.id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      isSaved ? next.delete(event.id) : next.add(event.id);
      return next;
    });
    try {
      if (isSaved) {
        await unsaveEvent(user.id, event.id);
      } else {
        await saveEvent(user.id, event.id);
      }
    } catch {
      setSavedIds((prev) => {
        const next = new Set(prev);
        isSaved ? next.add(event.id) : next.delete(event.id);
        return next;
      });
    }
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

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.black} />
        </View>
      ) : events.length === 0 ? (
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
              onSave={() => toggleSave(item)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={colors.black}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
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
