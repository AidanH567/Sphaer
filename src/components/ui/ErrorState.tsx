import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '@/constants/theme';

interface ErrorStateProps {
  /** Required short headline ("Event not found", "Couldn't load chat"). */
  title: string;
  /** Required body copy describing what went wrong + the next step. */
  body: string;
  /** Optional icon — defaults to a soft alert-circle. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** When provided, renders a primary "Try again" / "Retry" button. */
  onRetry?: () => void;
  /** When provided, renders a secondary "Back" outline button below retry. */
  onBack?: () => void;
  /** Custom labels for the two CTAs — defaults to "Try again" + "Back". */
  retryLabel?: string;
  backLabel?: string;
  /** Pad vertically so it reads as a mid-screen state rather than a section. */
  spaced?: boolean;
}

/**
 * Single mid-screen error primitive — used for failed fetches AND
 * "not found" states across the app. Keeps copy + CTA layout consistent.
 *
 * Visual: icon-in-circle → headline → body → primary Retry button →
 * optional secondary Back outline. Always centred.
 *
 * Pair with hook-exposed error state (useMessages.error / useEventMessages
 * .error / useCircleMessages.error etc.) for chat screens; or with the
 * generic 404 path on detail screens (`event not found`, `profile not
 * found`). The top-level route ErrorBoundary still catches unhandled
 * throws — this component is for *graceful* errors the hook surfaces.
 */
export function ErrorState({
  title,
  body,
  icon = 'alert-circle-outline',
  onRetry,
  onBack,
  retryLabel = 'Try again',
  backLabel = 'Back',
  spaced = true,
}: ErrorStateProps) {
  return (
    <View style={[styles.container, spaced && styles.containerSpaced]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={32} color={colors.text.tertiary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {(onRetry || onBack) && (
        <View style={styles.actions}>
          {onRetry && (
            <TouchableOpacity
              onPress={onRetry}
              style={styles.retryButton}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={retryLabel}
            >
              <Text style={styles.retryLabel}>{retryLabel}</Text>
            </TouchableOpacity>
          )}
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backButton}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
            >
              <Text style={styles.backLabel}>{backLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const META = '#868579';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  containerSpaced: {
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    flex: 1,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  body: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    lineHeight: 22,
    color: META,
    textAlign: 'center',
    maxWidth: 320,
  },

  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    width: '100%',
    maxWidth: 280,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: colors.neutral.chocolate,
    alignItems: 'center',
  },
  retryLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  backLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
});
