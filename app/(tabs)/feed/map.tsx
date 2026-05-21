import React from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { MOCK_EVENTS } from '@/data/mockEvents';
import { FeedHeader } from '@/components/feed/FeedHeader';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { config } from '@/constants/config';
import type { EventWithRelations } from '@/types/event.types';
import { formatEventDateShort } from '@/utils/date';
import { formatPrice } from '@/utils/format';

// react-native-maps does not support web — lazy-require on native only
const isNative = Platform.OS !== 'web';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Maps = isNative ? require('react-native-maps') : null;
const MapView = Maps?.default ?? View;
const Marker = Maps?.Marker ?? View;
const Callout = Maps?.Callout ?? View;
const PROVIDER_GOOGLE = Maps?.PROVIDER_GOOGLE;

export default function MapScreen() {
  const router = useRouter();
  const { setFeedView, feedFilters, setFeedFilters } = useAppContext();

  const events = useMemo(() => {
    const selected = feedFilters.categories ?? [];
    return MOCK_EVENTS.filter(
      (e) =>
        selected.length === 0 ||
        (e.categories ?? []).some((c) => selected.includes(c))
    );
  }, [feedFilters.categories]);

  const eventsWithCoords = events.filter((e) => e.lat !== null && e.lng !== null);

  function toggleCategory(cat: string) {
    const current = feedFilters.categories ?? [];
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    setFeedFilters({ ...feedFilters, categories: next.length ? next : undefined });
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
      />

      {Platform.OS === 'web' ? (
        <View style={styles.webFallback}>
          <Text style={styles.webFallbackText}>Map view available on mobile</Text>
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
              <View style={styles.pin}>
                <Text style={styles.pinText}>●</Text>
              </View>
              <Callout style={styles.callout}>
                <Text style={styles.calloutTitle} numberOfLines={2}>{event.title}</Text>
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
