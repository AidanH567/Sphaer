import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import { useAppContext } from '@/context/AppContext';
import { useEvents } from '@/hooks/useEvents';
import { FeedHeader } from '@/components/feed/FeedHeader';
import { colors, typography, spacing } from '@/constants/theme';
import { config } from '@/constants/config';
import { formatEventDateShort } from '@/utils/date';
import { formatPrice } from '@/utils/format';

/**
 * Web build of the Map view. Uses @vis.gl/react-google-maps so we get the
 * same Google Maps tiles + behaviour as the native iOS/Android map, just
 * via the JS API. Picks up the same EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.
 *
 * Filename suffix `.web.tsx` makes Expo / Metro pick this file over
 * `map.tsx` when bundling for web.
 *
 * Setup prerequisite: the Maps JavaScript API must be enabled in your
 * Google Cloud project (Geocoding API is a separate enablement — used by
 * src/lib/geocoding.ts for resolving addresses).
 */
export default function MapScreenWeb() {
  const router = useRouter();
  const { setFeedView, feedFilters, setFeedFilters } = useAppContext();
  const { events } = useEvents({ categories: feedFilters.categories });
  const [openInfoEventId, setOpenInfoEventId] = useState<string | null>(null);

  // Same filter logic as the native map screen — shared lens on the data.
  const filteredEvents = useMemo(() => {
    const q = (feedFilters.search ?? '').trim().toLowerCase();
    const hood = (feedFilters.neighborhood ?? '').toLowerCase();

    return events.filter((e) => {
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
        const locHaystack = `${e.address ?? ''} ${e.location_name ?? ''}`.toLowerCase();
        if (!locHaystack.includes(hood)) return false;
      }
      return true;
    });
  }, [events, feedFilters.search, feedFilters.neighborhood]);

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

      <View style={styles.mapWrap}>
        {!config.googleMapsApiKey ? (
          <View style={styles.errorState}>
            <Text style={styles.errorTitle}>Map not configured</Text>
            <Text style={styles.errorBody}>
              Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local and reload.
            </Text>
          </View>
        ) : (
          <APIProvider apiKey={config.googleMapsApiKey}>
            <Map
              defaultCenter={{ lat: config.berlin.lat, lng: config.berlin.lng }}
              defaultZoom={12}
              mapId="sphaer-explore"
              gestureHandling="greedy"
              disableDefaultUI={false}
              style={styles.mapStyle as any}
            >
              {eventsWithCoords.map((event) => {
                if (event.lat == null || event.lng == null) return null;
                return (
                  <AdvancedMarker
                    key={event.id}
                    position={{ lat: event.lat, lng: event.lng }}
                    onClick={() => setOpenInfoEventId(event.id)}
                  >
                    {event.poster_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      React.createElement('img', {
                        src: event.poster_url,
                        alt: event.title,
                        style: posterMarkerStyle,
                      })
                    ) : (
                      React.createElement('div', { style: pinMarkerStyle })
                    )}
                    {openInfoEventId === event.id && (
                      <InfoWindow
                        position={{ lat: event.lat, lng: event.lng }}
                        onCloseClick={() => setOpenInfoEventId(null)}
                      >
                        {React.createElement(
                          'div',
                          {
                            style: infoWindowStyle,
                            onClick: () => {
                              setOpenInfoEventId(null);
                              router.push(`/event/${event.id}` as any);
                            },
                          },
                          React.createElement('div', { style: infoTitleStyle }, event.title),
                          React.createElement(
                            'div',
                            { style: infoMetaStyle },
                            formatEventDateShort(event.starts_at),
                          ),
                          React.createElement(
                            'div',
                            { style: infoPriceStyle },
                            formatPrice(event.price, event.is_free),
                          ),
                        )}
                      </InfoWindow>
                    )}
                  </AdvancedMarker>
                );
              })}
            </Map>
          </APIProvider>
        )}
      </View>
    </View>
  );
}

// Inline web styles — these are real DOM elements, RN StyleSheet doesn't apply.
const posterMarkerStyle: React.CSSProperties = {
  width: 52,
  height: 60,
  borderRadius: 8,
  border: '2px solid white',
  boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
  objectFit: 'cover',
  cursor: 'pointer',
};

const pinMarkerStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: '50%',
  background: '#000',
  cursor: 'pointer',
  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
};

const infoWindowStyle: React.CSSProperties = {
  padding: '4px 6px',
  minWidth: 160,
  cursor: 'pointer',
};
const infoTitleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 14,
  marginBottom: 2,
};
const infoMetaStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#666',
};
const infoPriceStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  marginTop: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  mapWrap: { flex: 1 },
  mapStyle: { width: '100%', height: '100%' },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  errorTitle: {
    fontFamily: typography.fontFamily.display,
    fontSize: 18,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  errorBody: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
