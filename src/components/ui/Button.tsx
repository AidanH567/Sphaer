import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, typography, radius, spacing } from '@/constants/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  isLoading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      style={[
        styles.base,
        styles[size],
        variant === 'primary' ? styles.primary : styles.secondary,
        (disabled || isLoading) && styles.disabled,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.black} />
      ) : (
        <Text
          style={[
            styles.label,
            styles[`label_${size}`],
            variant === 'primary' ? styles.labelPrimary : styles.labelSecondary,
            textStyle,
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { height: 36, paddingHorizontal: spacing.base },
  md: { height: 44, paddingHorizontal: spacing.xl },
  lg: { height: 52, paddingHorizontal: spacing.xl },

  primary: {
    backgroundColor: colors.black,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.black,
  },
  disabled: { opacity: 0.4 },

  label: {
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.2,
  },
  label_sm: { fontSize: typography.fontSize.sm },
  label_md: { fontSize: typography.fontSize.base },
  label_lg: { fontSize: typography.fontSize.base },
  labelPrimary: { color: colors.white },
  labelSecondary: { color: colors.black },
});
