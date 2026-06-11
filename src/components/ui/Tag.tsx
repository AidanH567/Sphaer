import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, radius } from '@/constants/theme';

interface TagProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

/**
 * Filter pill — Figma design-system component 6298:6251.
 * Off: 35px pill, 1px chocolate outline, chocolate SF Pro Regular 14.
 * On:  chocolate fill, white label + trailing ✕ (the pill doubles as its
 *      own "remove" affordance once selected).
 */
export function Tag({ label, selected = false, onPress, style }: TagProps) {
  const content = (
    <>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      {selected && (
        <Ionicons name="close" size={14} color={colors.white} style={styles.clearIcon} />
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.tag, selected && styles.tagSelected, style]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.tag, selected && styles.tagSelected, style]}>{content}</View>
  );
}

const styles = StyleSheet.create({
  tag: {
    height: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.neutral.chocolate,
  },
  tagSelected: {
    backgroundColor: colors.neutral.chocolate,
    borderColor: colors.neutral.chocolate,
  },
  label: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.regular,
    color: colors.neutral.chocolate,
  },
  labelSelected: {
    color: colors.white,
  },
  clearIcon: {
    marginLeft: 6,
  },
});
