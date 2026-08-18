import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context/AppContext';
import { useEvents, useSavedEventIds } from '@/hooks/useEvents';
import { useVenues } from '@/hooks/useVenues';
import { FeedHeader } from '@/components/feed/FeedHeader';
import { MapModeToggle } from '@/components/map/MapModeToggle';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { config } from '@/constants/config';
import { eventMatchesLocationFilter } from '@/constants/berlinNeighborhoods';
import { applyChipFilters } from '@/utils/event-filters';
import type { EventWithRelations } from '@/types/event.types';
import type { MapMode } from '@/types/venue.types';
import { selectMapPins, filterVenues, emptyMapMessage, type MapPin } from '@/utils/map-modes';
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
 * Native Map view, with three viewing options (Lara, 2026-08-18):
 *
 *   Activities — every filtered event with coordinates. Unchanged.
 *   Venues     — the places themselves, one pin each, whether or not
 *                anything is on tonight.
 *   My city    — only what this user saved: hearted venues and bookmarked
 *                activities together.
 *
 * Filters (categories, search, neighbourhood) still come from AppContext so
 * Feed + Map + Mural share one lens on the data. The mode is LOCAL state,
 * not AppContext: it describes what this screen is showing, and feed and
 * mural have no equivalent.
 *
 * Which pins each mode yields is decided by selectMapPins in
 * src/utils/map-modes.ts — pure, and tested there. This file only decides
 * how a pin looks.
 *
 * Events (and venues) without coordinates are silently dropped from the map
 * — they still appear in Feed. Users get a non-blocking warning at creation
 * time if they don't supply an address.
 */
export default function MapScreen() {
  const router = useRouter();
  const { feedFilters, setFeedFilters } = useAppContext();
  const [mapMode, setMapMode] = useState<MapMode>('activities');

  const { events, error, refetch } = useEvents({ categories: feedFilters.categories });
  const { venues, savedVenueIds, toggleSaved, canSave } = useVenues();
  const { savedEventIds } = useSavedEventIds();

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
      origin: feedFilters.origin,
    });
  }, [
    events,
    feedFilters.search,
    feedFilters.neighborhood,
    feedFilters.tonight,
    feedFilters.thisWeekend,
    feedFilters.isFree,
    feedFilters.origin,
  ]);

  // Venues take only the parts of the lens that mean something for a place
  // — a building is not "free" or "on tonight". See filterVenues.
  const filteredVenues = useMemo(
    () =>
      filterVenues(venues, {
        search: feedFilters.search,
        neighborhood: feedFilters.neighborhood ?? null,
      }),
    [venues, feedFilters.search, feedFilters.neighborhood],
  );

  const pins = useMemo(
    () =>
      selectMapPins(mapMode, {
        events: filteredEvents,
        venues: filteredVenues,
        savedVenueIds,
        savedEventIds,
      }),
    [mapMode, filteredEvents, filteredVenues, savedVenueIds, savedEventIds],
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

  /** Marker press target. Events open their detail page; venues toggle the
   *  heart. Nested touchables inside a react-native-maps Callout are
   *  unreliable on Android, so the whole callout is the hit area and the
   *  callout copy says what tapping does. */
  function onPinPress(pin: MapPin) {
    if (pin.kind === 'event') {
      router.push(`/event/${pin.id}`);
    } else if (canSave) {
      toggleSaved(pin.id);
    }
  }

  const empty = emptyMapMessage(mapMode);

  return (
    <View style={styles.container}>
      <FeedHeader
        activeView="map"
        onViewChange={(v) => {
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
        <View style={styles.mapWrap}>
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
            {pins.map((pin) =>
              pin.kind === 'event' ? (
                <EventMarker
                  key={pin.key}
                  event={pin.event}
                  lat={pin.lat}
                  lng={pin.lng}
                  onPress={() => onPinPress(pin)}
                />
              ) : (
                <VenueMarker
                  key={pin.key}
                  pin={pin}
                  showCount={mapMode === 'venues'}
                  onPress={() => onPinPress(pin)}
                />
              ),
            )}
          </MapView>

          {/* Floating over the map rather than in FeedHeader — the header is
              shared with feed and mural, and neither has modes. */}
          <View style={styles.modeBar} pointerEvents="box-none">
            <MapModeToggle activeMode={mapMode} onModeChange={setMapMode} />
          </View>

          {pins.length === 0 && (
            <View style={styles.emptyCard} pointerEvents="none">
              <Text style={styles.emptyTitle}>{empty.title}</Text>
              <Text style={styles.emptyBody}>{empty.body}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/** Poster-as-marker — unchanged from the original activities map. */
function EventMarker({
  event,
  lat,
  lng,
  onPress,
}: {
  event: EventWithRelations;
  lat: number;
  lng: number;
  onPress: () => void;
}) {
  return (
    <Marker coordinate={{ latitude: lat, longitude: lng }} onCalloutPress={onPress}>
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
  );
}

/**
 * A place. Reads as a heart when saved — the Google-Maps-favourite idiom
 * Lara asked for — and as a neutral dot when not.
 */
function VenueMarker({
  pin,
  showCount,
  onPress,
}: {
  pin: Extract<MapPin, { kind: 'venue' }>;
  showCount: boolean;
  onPress: () => void;
}) {
  const saved = pin.venue.is_saved === true;
  const count = pin.venue.event_count ?? 0;

  return (
    <Marker coordinate={{ latitude: pin.lat, longitude: pin.lng }} onCalloutPress={onPress}>
      <View style={[styles.venuePin, saved && styles.venuePinSaved]}>
        <Ionicons
          name={saved ? 'heart' : 'location'}
          size={16}
          color={saved ? colors.white : colors.neutral.chocolate}
        />
      </View>
      <Callout style={styles.callout}>
        <Text style={styles.calloutTitle} numberOfLines={2}>
          {pin.venue.name}
        </Text>
        {showCount && (
          <Text style={styles.calloutMeta}>
            {count === 0 ? 'Nothing on right now' : count === 1 ? '1 activity on' : `${count} activities on`}
          </Text>
        )}
        <Text style={styles.calloutAction}>{saved ? 'Tap to remove' : 'Tap to save'}</Text>
      </Callout>
    </Marker>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  modeBar: {
    position: 'absolute',
    top: spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  emptyCard: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  emptyTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  emptyBody: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
    textAlign: 'center',
  },
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
  venuePin: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  venuePinSaved: {
    backgroundColor: colors.neutral.chocolate,
  },
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
  calloutAction: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.chocolate,
    marginTop: 4,
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('feed-map');
