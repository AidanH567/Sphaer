import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { config } from '@/constants/config';

interface Props {
  lat: number;
  lng: number;
  title?: string;
  onOpenInMaps: () => void;
  height?: number;
}

/**
 * Web build of EventMapPreview. Uses @vis.gl/react-google-maps so we get
 * real Google Maps tiles in the browser (matching the native MapView's
 * provider=Google). Picks up the same EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.
 *
 * The `.web.tsx` extension tells Metro to swap this file in over the
 * sibling `EventMapPreview.tsx` when bundling for web.
 *
 * Setup prerequisite: the Maps JavaScript API must be enabled in the
 * Google Cloud project (the Feed Map view requires this too).
 */
export function EventMapPreview({ lat, lng, onOpenInMaps, height = 180 }: Props) {
  return (
    <View style={[styles.wrap, { height }]}>
      <APIProvider apiKey={config.googleMapsApiKey}>
        <Map
          defaultCenter={{ lat, lng }}
          defaultZoom={15}
          gestureHandling="greedy"
          disableDefaultUI
          mapId="sphaer-event-preview"
          style={styles.map as unknown as React.CSSProperties}
        >
          <AdvancedMarker position={{ lat, lng }} />
        </Map>
      </APIProvider>

      <TouchableOpacity
        style={styles.openPill}
        onPress={onOpenInMaps}
        activeOpacity={0.85}
        accessibilityLabel="Open in Maps"
      >
        <Ionicons name="open-outline" size={14} color={colors.white} />
        <Text style={styles.openPillText}>Open in Maps</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  map: { width: '100%', height: '100%' },
  openPill: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(13, 13, 13, 0.85)',
  },
  openPillText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: typography.fontWeight.semibold,
  },
});
