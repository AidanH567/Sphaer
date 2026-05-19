import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '@/constants/theme';

type FeedView = 'list' | 'map' | 'mural';

const CHOCOLATE = '#2B2A27';
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
    fontWeight: '510' as any,
    color: INACTIVE,
  },

  labelActive: {
    color: '#FFF',
    fontWeight: '510' as any,
  },
});