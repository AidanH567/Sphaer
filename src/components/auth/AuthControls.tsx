import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '@/constants/theme';

// Figma tokens (Sign Up Flow Screen 1.1 — node 5013:10790)
const CHOCOLATE = colors.neutral.chocolate;
const INK = colors.neutral.ink;
const META = colors.neutral.neutral600;
// Figma 2012:1711: placeholder is neutral-500; textfield border is
// the `--hidden-lines` token (a light blue-grey, not the darker
// #C1C1C1 we shipped first pass).
const PLACEHOLDER = colors.neutral.neutral500;
const INPUT_BORDER = colors.neutral.hiddenLines;
const ERROR_RED = '#E53935';
const GOOGLE_BORDER = '#E6E8E7';
const GOOGLE_BLUE = '#4285F4';
const OR_GREY = '#6E6E6E';

/* ── AuthField ──────────────────────────────────────────── */

type AuthFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

/**
 * Auth form field — label on top, 44px input with thin grey border. If
 * `secureTextEntry` is set, an eye icon appears on the right that toggles
 * password visibility.
 */
export function AuthField({ label, error, secureTextEntry, style, ...props }: AuthFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = !!secureTextEntry;

  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={[fieldStyles.box, !!error && fieldStyles.boxError]}>
        <TextInput
          placeholderTextColor={PLACEHOLDER}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
          secureTextEntry={isPassword && !revealed}
          style={[fieldStyles.input, style]}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setRevealed((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={META}
            />
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={fieldStyles.errorText}>{error}</Text>}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { gap: 4, width: '100%' },
  label: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.semibold,
    color: CHOCOLATE,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    backgroundColor: colors.white,
  },
  boxError: { borderColor: ERROR_RED },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: INK,
    paddingVertical: 0,
  },
  errorText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 12,
    color: ERROR_RED,
  },
});

/* ── FormErrorText ──────────────────────────────────────── */

/**
 * Form-level (non-field) auth error. Replaces `Alert.alert` for submit
 * failures — RN-web doesn't implement Alert, so alerts are silently
 * dropped in the browser and the user sees nothing happen.
 */
export function FormErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text
      style={formErrorStyles.text}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {message}
    </Text>
  );
}

const formErrorStyles = StyleSheet.create({
  text: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    lineHeight: 17,
    color: ERROR_RED,
    textAlign: 'center',
  },
});

/* ── AuthPrimaryButton ──────────────────────────────────── */

interface AuthPrimaryButtonProps {
  label: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

/** Dark chocolate pill — Figma "Sign up" / "Log in" CTA. */
export function AuthPrimaryButton({
  label,
  onPress,
  isLoading,
  disabled,
  style,
}: AuthPrimaryButtonProps) {
  return (
    <TouchableOpacity
      style={[
        primaryStyles.button,
        (disabled || isLoading) && primaryStyles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Text style={primaryStyles.label}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const primaryStyles = StyleSheet.create({
  button: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14.5,
    borderRadius: 30,
    backgroundColor: CHOCOLATE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  label: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 17,
    fontWeight: typography.fontWeight.medium,
    color: colors.white,
  },
});

/* ── GoogleButton ───────────────────────────────────────── */

interface GoogleButtonProps {
  onPress: () => void;
}

/** White rounded "Continue with Google" button with the brand G mark. */
export function GoogleButton({ onPress }: GoogleButtonProps) {
  return (
    <TouchableOpacity
      style={googleStyles.button}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      <Text style={googleStyles.label}>Continue with Google</Text>
      <Ionicons name="logo-google" size={24} color={GOOGLE_BLUE} />
    </TouchableOpacity>
  );
}

const googleStyles = StyleSheet.create({
  button: {
    width: '100%',
    height: 49,
    paddingHorizontal: 16,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: GOOGLE_BORDER,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // tiny figma drop-shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 1,
    elevation: 1,
  },
  label: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 17,
    fontWeight: typography.fontWeight.medium,
    color: CHOCOLATE,
  },
});

/* ── OrDivider ──────────────────────────────────────────── */

/** Centered "or" divider with hairline lines on each side. */
export function OrDivider() {
  return (
    <View style={orStyles.row}>
      <View style={orStyles.line} />
      <Text style={orStyles.label}>or</Text>
      <View style={orStyles.line} />
    </View>
  );
}

const orStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: GOOGLE_BORDER,
  },
  label: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: OR_GREY,
  },
});
