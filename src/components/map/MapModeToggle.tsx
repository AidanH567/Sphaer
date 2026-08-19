import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@/constants/theme';
import { MAP_MODES, type MapMode } from '@/types/venue.types';

/**
 * The map's three viewing options: activities / venues / favourites.
 *
 * Visually this is ViewToggle's language — chocolate active pill, grey
 * inactive, same 30-radius — deliberately, so the map does not grow a
 * second unrelated control idiom. It is a SEPARATE component rather than a
 * generalisation of ViewToggle because ViewToggle switches ROUTES
 * (feed/map/mural) while this switches state within one route; folding them
 * together would couple navigation to a local lens.
 *
 * Floats over the map rather than sitting in FeedHeader: the header is
 * shared with feed and mural, and neither has modes.
 */

const CHOCOLATE = colors.neutral.chocolate;
const INACTIVE = '#6F6F6F';

const MODE_META: Record<MapMode, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  activities: { icon: 'sparkles-outline', label: 'Activities' },
  venues: { icon: 'business-outline', label: 'Venues' },
  favourites: { icon: 'heart-outline', label: 'My city' },
};

interface MapModeToggleProps {
  activeMode: MapMode;
  onModeChange: (mode: MapMode) => void;
}

export function MapModeToggle({ activeMode, onModeChange }: MapModeToggleProps) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {MAP_MODES.map((mode) => {
        const { icon, label } = MODE_META[mode];
        const active = activeMode === mode;

        return (
          <TouchableOpacity
            key={mode}
            onPress={() => onModeChange(mode)}
            style={[styles.pill, active && styles.pillActive]}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Show ${label.toLowerCase()} on the map`}
            testID={`map-mode-${mode}`}
          >
            <Ionicons name={icon} size={18} color={active ? colors.white : INACTIVE} />
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
  },
  pillActive: {
    backgroundColor: CHOCOLATE,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: INACTIVE,
  },
  labelActive: {
    color: colors.white,
  },
});
