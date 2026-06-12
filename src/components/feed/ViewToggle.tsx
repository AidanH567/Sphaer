import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';

type FeedView = 'list' | 'map' | 'mural';

const CHOCOLATE = colors.neutral.chocolate;
const INACTIVE = '#6F6F6F';

const VIEWS: { key: FeedView; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: 'list', icon: 'list-outline', label: 'Feed' },
  { key: 'map', icon: 'map-outline', label: 'Map' },
  { key: 'mural', icon: 'images-outline', label: 'Mural' },
];

interface ViewToggleProps {
  activeView: FeedView;
  onViewChange: (view: FeedView) => void;
}

export function ViewToggle({ activeView, onViewChange }: ViewToggleProps) {
  return (
    <View style={styles.container}>
      {VIEWS.map(({ key, icon, label }) => {
        const active = activeView === key;

        return (
          <TouchableOpacity
            key={key}
            onPress={() => onViewChange(key)}
            style={[styles.pill, active && styles.pillActive]}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={icon}
              size={22}
              color={active ? colors.white : INACTIVE}
            />

            <Text style={[styles.label, active && styles.labelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  pill: {
    width: 100,
    height: 45,
    paddingVertical: 6,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderRadius: 30,
  },

  pillActive: {
    backgroundColor: CHOCOLATE,
  },

  label: {
    fontSize: 17,
    // Figma spec is 510 (one notch between Medium 500 and Semibold 600).
    // RN doesn't accept arbitrary numeric strings, so we round to 500 and
    // let the system font carry the slight extra weight via metrics. Using
    // '500' here instead of the previous `'510' as any`, which RN was
    // silently falling back to 500 anyway.
    fontWeight: '500',
    color: INACTIVE,
  },

  labelActive: {
    color: '#FFF',
    // Figma spec is 510 (one notch between Medium 500 and Semibold 600).
    // RN doesn't accept arbitrary numeric strings, so we round to 500 and
    // let the system font carry the slight extra weight via metrics. Using
    // '500' here instead of the previous `'510' as any`, which RN was
    // silently falling back to 500 anyway.
    fontWeight: '500',
  },
});