import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  /**
   * Names the right-icon action for screen readers (the icon is otherwise
   * unlabeled), e.g. "Show password" or "Clear text".
   */
  rightIconAccessibilityLabel?: string;
}

export function Input({
  label,
  icon,
  error,
  rightIcon,
  onRightIconPress,
  rightIconAccessibilityLabel,
  style,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  // Multiline inputs (e.g. the About paragraph) can't use the single-line
  // box: a fixed 50px container with alignItems:'center' centres a taller
  // textarea and lets it overflow ABOVE the border (the placeholder ended up
  // sitting on top of the label). When multiline, the box grows to fit and
  // top-aligns its text instead.
  const isMultiline = Boolean(props.multiline);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.container,
          isMultiline && styles.containerMultiline,
          isFocused && styles.containerFocused,
          error ? styles.containerError : null,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={isFocused ? colors.black : colors.text.tertiary}
            style={styles.icon}
          />
        )}
        <TextInput
          style={[styles.input, isMultiline && styles.inputMultiline, style]}
          placeholderTextColor={colors.text.placeholder}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIconButton}
            accessibilityRole="button"
            accessibilityLabel={rightIconAccessibilityLabel}
          >
            <Ionicons name={rightIcon} size={18} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.hiddenLines,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  // Multiline: drop the fixed single-line height, top-align, and pad so the
  // box grows to fit its text and the placeholder/value sit INSIDE the border.
  containerMultiline: {
    height: 'auto',
    minHeight: 50,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  inputMultiline: {
    height: 'auto',
    textAlignVertical: 'top',
  },
  containerFocused: {
    borderColor: colors.black,
  },
  containerError: {
    borderColor: colors.badge.red,
  },
  icon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    height: '100%',
  },
  rightIconButton: { padding: spacing.xs },
  error: {
    fontSize: typography.fontSize.xs,
    color: colors.badge.red,
  },
});
