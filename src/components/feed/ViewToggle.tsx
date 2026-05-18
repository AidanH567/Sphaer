import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '@/constants/theme';

type FeedView = 'list' | 'map' | 'mural';

const VIEWS: { key: FeedView; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'list', icon: 'list-outline' },
  { key: 'map', icon: 'map-outline' },
  { key: 'mural', icon: 'images-outline' },
];

interface ViewToggleProps {
  activeView: FeedView;
  onViewChange: (view: FeedView) => void;
}

export function ViewToggle({ activeView, onViewChange }: ViewToggleProps) {
  return (
    <View style={styles.container}>
      {VIEWS.map(({ key, icon }) => (
        <TouchableOpacity
          key={key}
          onPress={() => onViewChange(key)}
          style={[styles.button, activeView === key && styles.buttonActive]}
          activeOpacity={0.7}
        >
          <Ionicons
            name={icon}
            size={18}
            color={activeView === key ? colors.white : colors.text.secondary}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 3,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.full,
  },
  buttonActive: {
    backgroundColor: colors.black,
  },
});
