import React, { useMemo, useState } from 'react';
import { FlatList, View, Text, TouchableOpacity, StyleSheet, RefreshControl, Alert, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context/AppContext';
import { useAuthContext } from '@/context/AuthContext';
import { FeedHeader } from '@/components/feed/FeedHeader';
import { EventCard } from '@/components/feed/EventCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EventCardSkeleton } from '@/components/ui/skeletons/EventCardSkeleton';
import { useEvents } from '@/hooks/useEvents';
import { useDebounce } from '@/hooks/useDebounce';
import {
  getSavedEventIds,
  saveEvent,
  unsaveEvent,
} from '@/services/events.service';
import { eventMatchesLocationFilter } from '@/constants/berlinNeighborhoods';
import { haversineKm, NEAR_ME_RADIUS_KM } from '@/utils/geo';
import { applyChipFilters } from '@/utils/event-filters';
import { colors, spacing, typography } from '@/constants/theme';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

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
  const { feedView, setFeedView, feedFilters, setFeedFilters, userCoords, setUserCoords } =
    useAppContext();
  const { user } = useAuthContext();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [nearMeBusy, setNearMeBusy] = useState(false);

  // Search + neighbourhood now live in AppContext so Feed / Map / Mural
  // share filter state. Mural can opt in later — Feed and Map opt in now.
  const searchText = feedFilters.search ?? '';

  // Debounce the raw search input before it hits the service. Typing into
  // the search bar updates AppContext immediately (so the input stays
  // responsive) but the actual Supabase query waits 300ms after the last
  // keystroke — avoids firing one `ilike` per character.
  const debouncedSearch = useDebounce(searchText, 300);

  const { events, isLoading, error, refetch } = useEvents({
    categories: feedFilters.categories,
    search: debouncedSearch.trim() || undefined,
  });

  // Refetch whenever the feed comes back into focus — covers the
  // "just created an activity, come back to feed" case.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Hydrate the local savedIds set from the DB on mount + on focus so the
  // bookmark icons reflect persisted state across reloads.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!user?.id) {
        setSavedIds(new Set());
        return;
      }
      getSavedEventIds(user.id)
        .then((ids) => {
          if (!cancelled) setSavedIds(new Set(ids));
        })
        .catch((err) => console.error('[Feed] load saved ids failed:', err));
      return () => {
        cancelled = true;
      };
    }, [user?.id])
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
    const filtered = base.filter((e) => {
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
        // Two-level hierarchy: try eventMatchesLocationFilter first which
        // understands both Ortsteil and Bezirk semantics (a Bezirk filter
        // matches every event whose neighbourhood is in that Bezirk).
        // Falls through to substring match on the freeform address when
        // the filter string isn't a canonical Berlin name.
        const structured = eventMatchesLocationFilter(feedFilters.neighborhood ?? '', {
          borough: e.borough ?? null,
          neighbourhood: e.neighbourhood ?? null,
        });
        if (structured === true) {
          // pass through
        } else if (structured === false) {
          return false;
        } else {
          const locHaystack = `${e.address ?? ''} ${e.location_name ?? ''}`.toLowerCase();
          if (!locHaystack.includes(hood)) return false;
        }
      }
      // Near me — keep events with valid coords within radius. Events
      // without lat/lng pass through silently (we don't have data to filter
      // them on); flipping the filter to "strict" later means excluding
      // those, but for the demo set it's friendlier to keep them visible.
      if (feedFilters.nearMe && userCoords && e.lat != null && e.lng != null) {
        const d = haversineKm(userCoords, { lat: e.lat, lng: e.lng });
        if (d > NEAR_ME_RADIUS_KM) return false;
      }
      return true;
    });
    // Layer the chip filters (tonight / thisWeekend / isFree) on top of
    // search + hood + near-me. Centralised in event-filters.ts so map +
    // mural can share the exact same predicates.
    return applyChipFilters(filtered, {
      tonight: feedFilters.tonight,
      thisWeekend: feedFilters.thisWeekend,
      isFree: feedFilters.isFree,
    });
  }, [
    events,
    searchText,
    feedFilters.neighborhood,
    feedFilters.nearMe,
    feedFilters.tonight,
    feedFilters.thisWeekend,
    feedFilters.isFree,
    userCoords,
  ]);

  // Tonight ⇄ This weekend are mutually exclusive — turning one on clears
  // the other so they read as "pick one time window". `isFree` stacks
  // freely with either since it's orthogonal.
  function toggleTonight() {
    setFeedFilters({
      ...feedFilters,
      tonight: feedFilters.tonight ? undefined : true,
      thisWeekend: feedFilters.tonight ? feedFilters.thisWeekend : undefined,
    });
  }
  function toggleThisWeekend() {
    setFeedFilters({
      ...feedFilters,
      thisWeekend: feedFilters.thisWeekend ? undefined : true,
      tonight: feedFilters.thisWeekend ? feedFilters.tonight : undefined,
    });
  }
  function toggleIsFree() {
    setFeedFilters({
      ...feedFilters,
      isFree: feedFilters.isFree ? undefined : true,
    });
  }

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

  /**
   * Toggle the "Near me" filter. First time it's enabled we ask for the OS
   * location permission and resolve a single fix — subsequent toggles reuse
   * the cached `userCoords`. On denial we leave the chip un-toggled and
   * show a one-shot alert explaining why; users can grant later via Settings.
   */
  async function toggleNearMe() {
    // Disable — no permission work needed.
    if (feedFilters.nearMe) {
      setFeedFilters({ ...feedFilters, nearMe: undefined });
      return;
    }
    // Enable. If we already have coords, just flip the flag.
    if (userCoords) {
      setFeedFilters({ ...feedFilters, nearMe: true });
      return;
    }
    // Otherwise prompt for location.
    if (nearMeBusy) return;
    setNearMeBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location needed',
          'Enable location access to filter activities within 5 km. You can change this later in Settings.'
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setFeedFilters({ ...feedFilters, nearMe: true });
    } catch (err) {
      console.error('[Feed] near-me location lookup failed:', err);
      Alert.alert(
        'Could not get your location',
        'Try again in a moment, or check your location settings.'
      );
    } finally {
      setNearMeBusy(false);
    }
  }

  async function toggleSave(eventId: string) {
    if (!user?.id) return;
    const wasSaved = savedIds.has(eventId);
    // Optimistic flip — revert on failure so the UI matches DB state.
    setSavedIds((prev) => {
      const next = new Set(prev);
      wasSaved ? next.delete(eventId) : next.add(eventId);
      return next;
    });
    try {
      if (wasSaved) {
        await unsaveEvent(user.id, eventId);
      } else {
        await saveEvent(user.id, eventId);
      }
    } catch (err) {
      console.error('[Feed] toggleSave failed:', err);
      setSavedIds((prev) => {
        const next = new Set(prev);
        wasSaved ? next.add(eventId) : next.delete(eventId);
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
        onSearchChange={setSearch}
        selectedNeighborhood={feedFilters.neighborhood ?? null}
        onNeighborhoodChange={setNeighborhood}
      />

      {/* Quick filter chips — lives between the header and the list so it
          can be dropped in without restructuring the SearchFilterBar layout.
          ScrollView so it scrolls horizontally on narrow screens. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <TouchableOpacity
          onPress={toggleNearMe}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ selected: !!feedFilters.nearMe, busy: nearMeBusy }}
          style={[
            styles.chip,
            feedFilters.nearMe && styles.chipActive,
            nearMeBusy && styles.chipBusy,
          ]}
        >
          <Ionicons
            name="navigate"
            size={12}
            color={feedFilters.nearMe ? colors.white : colors.text.primary}
          />
          <Text
            style={[styles.chipText, feedFilters.nearMe && styles.chipTextActive]}
          >
            {feedFilters.nearMe ? `Within ${NEAR_ME_RADIUS_KM} km` : 'Near me'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleTonight}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ selected: !!feedFilters.tonight }}
          style={[styles.chip, feedFilters.tonight && styles.chipActive]}
        >
          <Ionicons
            name="moon-outline"
            size={12}
            color={feedFilters.tonight ? colors.white : colors.text.primary}
          />
          <Text style={[styles.chipText, feedFilters.tonight && styles.chipTextActive]}>
            Tonight
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleThisWeekend}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ selected: !!feedFilters.thisWeekend }}
          style={[styles.chip, feedFilters.thisWeekend && styles.chipActive]}
        >
          <Ionicons
            name="calendar-outline"
            size={12}
            color={feedFilters.thisWeekend ? colors.white : colors.text.primary}
          />
          <Text style={[styles.chipText, feedFilters.thisWeekend && styles.chipTextActive]}>
            This weekend
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleIsFree}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ selected: !!feedFilters.isFree }}
          style={[styles.chip, feedFilters.isFree && styles.chipActive]}
        >
          <Ionicons
            name="pricetag-outline"
            size={12}
            color={feedFilters.isFree ? colors.white : colors.text.primary}
          />
          <Text style={[styles.chipText, feedFilters.isFree && styles.chipTextActive]}>
            Free
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {isLoading && events.length === 0 ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2, 3].map((i) => (
            <EventCardSkeleton key={i} index={i} />
          ))}
        </View>
      ) : error && events.length === 0 ? (
        <ErrorState
          icon="cloud-offline-outline"
          title="Couldn't load the feed"
          body={error}
          onRetry={refetch}
        />
      ) : visibleEvents.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon={
              feedFilters.tonight || feedFilters.thisWeekend
                ? 'calendar-outline'
                : feedFilters.isFree
                ? 'pricetag-outline'
                : feedFilters.nearMe
                ? 'navigate'
                : 'calendar-outline'
            }
            title={
              feedFilters.tonight
                ? 'Nothing on tonight'
                : feedFilters.thisWeekend
                ? 'Nothing on this weekend'
                : feedFilters.isFree
                ? 'No free events match'
                : feedFilters.nearMe
                ? `Nothing within ${NEAR_ME_RADIUS_KM} km`
                : searchText
                ? `No matches for "${searchText}"`
                : 'Nothing on right now'
            }
            body={
              feedFilters.tonight || feedFilters.thisWeekend || feedFilters.isFree
                ? 'Try clearing the chips above to see everything.'
                : feedFilters.nearMe
                ? 'Try expanding by tapping "Near me" off, or pan around the Map view.'
                : searchText
                ? 'Try a different search, or clear the filter to see everything.'
                : 'Your feed will fill in as artists and circles post events near you. Pull to refresh.'
            }
            centered
            spaced
          />
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
  skeletonList: { paddingTop: spacing.base },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  chipBusy: { opacity: 0.6 },
  chipText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  chipTextActive: {
    color: colors.white,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('feed-list');
