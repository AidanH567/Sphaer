import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, radius } from '@/constants/theme';

interface TagProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  /**
   * 'filter' — 35px pill with chocolate outline + selected ✕ (feed/circles).
   * 'choice' — Figma "One pressed_button" (create-flow topic chips,
   * 6277:10010): 49px, 1.7px neutral-700 outline, Medium 17, no ✕.
   */
  variant?: 'filter' | 'choice';
}

/**
 * Filter pill — Figma design-system component 6298:6251.
 * Off: 35px pill, 1px chocolate outline, chocolate SF Pro Regular 14.
 * On:  chocolate fill, white label + trailing ✕ (the pill doubles as its
 *      own "remove" affordance once selected).
 */
export function Tag({ label, selected = false, onPress, style, variant = 'filter' }: TagProps) {
  const isChoice = variant === 'choice';
  const content = (
    <>
      <Text
        style={[
          styles.label,
          isChoice && styles.labelChoice,
          selected && styles.labelSelected,
        ]}
      >
        {label}
      </Text>
      {selected && !isChoice && (
        <Ionicons name="close" size={14} color={colors.white} style={styles.clearIcon} />
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.tag, isChoice && styles.tagChoice, selected && styles.tagSelected, style]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.tag, isChoice && styles.tagChoice, selected && styles.tagSelected, style]}>{content}</View>
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
  tagChoice: {
    height: 49,
    paddingHorizontal: 16,
    borderWidth: 1.7,
    borderColor: colors.neutral.neutral700,
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
  labelChoice: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
  },
  labelSelected: {
    color: colors.white,
  },
  clearIcon: {
    marginLeft: 6,
  },
});
