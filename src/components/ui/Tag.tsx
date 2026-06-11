import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';

interface TagProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Tag({ label, selected = false, onPress, style }: TagProps) {
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.tag, selected && styles.tagSelected, style]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.tag, selected && styles.tagSelected, style]}>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.black,
    backgroundColor: colors.white,
  },
  tagSelected: {
    backgroundColor: colors.black,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  labelSelected: {
    color: colors.white,
  },
});
