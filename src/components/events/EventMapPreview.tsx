import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/constants/theme';

// react-native-maps is iOS/Android-only. Lazy-require so this file is safe
// to import on web too (the .web.tsx sibling is picked up there instead).
const isNative = Platform.OS !== 'web';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Maps = isNative ? require('react-native-maps') : null;
const MapView = Maps?.default ?? View;
const Marker = Maps?.Marker ?? View;
const PROVIDER_GOOGLE = Maps?.PROVIDER_GOOGLE;

interface Props {
  lat: number;
  lng: number;
  /** Optional friendly name displayed on the marker callout. */
  title?: string;
  /** Fires when the user taps the "Open in Maps" pill overlay. */
  onOpenInMaps: () => void;
  /** Container height; defaults to 180px to match prior layout. */
  height?: number;
}

/**
 * Embedded interactive Google Map for an event's location. Real map tiles,
 * pinch-zoom + pan are enabled so the preview is genuinely interactive
 * (rather than a flat screenshot). An "Open in Maps" pill in the corner
 * launches Apple/Google Maps externally — tapping the map itself stays
 * inside the embed because gestures conflict with a whole-widget tap.
 */
export function EventMapPreview({ lat, lng, title, onOpenInMaps, height = 180 }: Props) {
  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        // Interactive but not chatty — no compass, no toolbar buttons that
        // would clash with the overlay pill.
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Marker coordinate={{ latitude: lat, longitude: lng }} title={title} />
      </MapView>

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
