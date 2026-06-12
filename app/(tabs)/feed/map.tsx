import React, { useMemo } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAppContext } from '@/context/AppContext';
import { useEvents } from '@/hooks/useEvents';
import { FeedHeader } from '@/components/feed/FeedHeader';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { config } from '@/constants/config';
import { eventMatchesLocationFilter } from '@/constants/berlinNeighborhoods';
import { applyChipFilters } from '@/utils/event-filters';
import type { EventWithRelations } from '@/types/event.types';
import { formatEventDateShort } from '@/utils/date';
import { formatPrice } from '@/utils/format';
import { ErrorState } from '@/components/ui/ErrorState';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

// react-native-maps is iOS/Android only — lazy-require so the web bundle
// doesn't choke. (The web build is provided by map.web.tsx alongside this.)
const isNative = Platform.OS !== 'web';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Maps = isNative ? require('react-native-maps') : null;
const MapView = Maps?.default ?? View;
const Marker = Maps?.Marker ?? View;
const Callout = Maps?.Callout ?? View;
const PROVIDER_GOOGLE = Maps?.PROVIDER_GOOGLE;

/**
 * Native Map view. Renders activities with valid lat/lng on a Google Map,
 * using the event poster as the marker. Filters (categories, search,
 * neighbourhood) are pulled from AppContext so Feed + Map + Mural share
 * the same lens on the data.
 *
 * Events without coordinates are silently dropped from the map — they
 * still appear in Feed. Users get a non-blocking warning at creation time
 * if they don't supply an address.
 */
export default function MapScreen() {
  const router = useRouter();
  const { setFeedView, feedFilters, setFeedFilters } = useAppContext();

  const { events, error, refetch } = useEvents({ categories: feedFilters.categories });

  // Apply search + neighbourhood + category filters client-side. Matches
  // the same logic feed/index.tsx uses, so both views always show the same
  // filtered set (just with different render layers).
  const filteredEvents = useMemo(() => {
    const q = (feedFilters.search ?? '').trim().toLowerCase();
    const hood = (feedFilters.neighborhood ?? '').toLowerCase();

    const filtered = events.filter((e) => {
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
        // Two-level Berlin hierarchy — see app/(tabs)/feed/index.tsx for
        // the prose. Bezirk-level filters match every event in any of
        // the borough's constituent Ortsteils.
        const structured = eventMatchesLocationFilter(feedFilters.neighborhood ?? '', {
          borough: e.borough ?? null,
          neighbourhood: e.neighbourhood ?? null,
        });
        if (structured === false) return false;
        if (structured === null) {
          const locHaystack = `${e.address ?? ''} ${e.location_name ?? ''}`.toLowerCase();
          if (!locHaystack.includes(hood)) return false;
        }
      }
      return true;
    });
    return applyChipFilters(filtered, {
      tonight: feedFilters.tonight,
      thisWeekend: feedFilters.thisWeekend,
      isFree: feedFilters.isFree,
    });
  }, [
    events,
    feedFilters.search,
    feedFilters.neighborhood,
    feedFilters.tonight,
    feedFilters.thisWeekend,
    feedFilters.isFree,
  ]);

  // Only mappable events
  const eventsWithCoords = filteredEvents.filter(
    (e) => e.lat !== null && e.lng !== null,
  );

  function toggleCategory(cat: string) {
    const current = feedFilters.categories ?? [];
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    setFeedFilters({ ...feedFilters, categories: next.length ? next : undefined });
  }

  function setNeighborhood(n: string | null) {
    setFeedFilters({ ...feedFilters, neighborhood: n ?? undefined });
  }

  function setSearch(text: string) {
    setFeedFilters({ ...feedFilters, search: text || undefined });
  }

  return (
    <View style={styles.container}>
      <FeedHeader
        activeView="map"
        onViewChange={(v) => {
          setFeedView(v);
          if (v === 'list') router.push('/(tabs)/feed');
          else if (v === 'mural') router.push('/(tabs)/feed/mural');
        }}
        selectedCategories={feedFilters.categories ?? []}
        onToggleCategory={toggleCategory}
        onSearchChange={setSearch}
        selectedNeighborhood={feedFilters.neighborhood ?? null}
        onNeighborhoodChange={setNeighborhood}
      />

      {/* Failed fetch with nothing cached: keep the header (so the user can
          switch back to list view) but replace the pin-less map with a
          retryable error instead of zero feedback. */}
      {error && events.length === 0 ? (
        <ErrorState
          icon="cloud-offline-outline"
          title="Couldn't load the map"
          body={error}
          onRetry={refetch}
        />
      ) : Platform.OS === 'web' ? (
        <View style={styles.webFallback}>
          <Text style={styles.webFallbackText}>Loading map…</Text>
        </View>
      ) : (
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: config.berlin.lat,
            longitude: config.berlin.lng,
            latitudeDelta: config.berlin.latitudeDelta,
            longitudeDelta: config.berlin.longitudeDelta,
          }}
        >
          {eventsWithCoords.map((event: EventWithRelations) => (
            <Marker
              key={event.id}
              coordinate={{ latitude: event.lat!, longitude: event.lng! }}
              onCalloutPress={() => router.push(`/event/${event.id}`)}
            >
              {/* Poster-as-marker. Falls back to a small pin if no poster. */}
              {event.poster_url ? (
                <View style={styles.posterMarker}>
                  <Image source={{ uri: event.poster_url }} style={styles.posterImage} />
                </View>
              ) : (
                <View style={styles.pin}>
                  <Text style={styles.pinText}>●</Text>
                </View>
              )}
              <Callout style={styles.callout}>
                <Text style={styles.calloutTitle} numberOfLines={2}>
                  {event.title}
                </Text>
                <Text style={styles.calloutMeta}>{formatEventDateShort(event.starts_at)}</Text>
                <Text style={styles.calloutPrice}>{formatPrice(event.price, event.is_free)}</Text>
              </Callout>
            </Marker>
          ))}
        </MapView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  map: { flex: 1 },
  webFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  webFallbackText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
  },
  pin: {
    backgroundColor: colors.black,
    borderRadius: radius.full,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinText: { color: colors.white, fontSize: 8 },
  posterMarker: {
    width: 52,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  posterImage: { width: '100%', height: '100%' },
  callout: {
    width: 180,
    padding: spacing.sm,
  },
  calloutTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  calloutMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  calloutPrice: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: 2,
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('feed-map');
