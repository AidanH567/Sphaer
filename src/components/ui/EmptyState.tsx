import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '@/constants/theme';

interface EmptyStateProps {
  /** Required copy that explains why the list is empty. */
  body: string;
  /** Optional icon shown above the body. Skip for inline section-level uses. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Optional bold headline above the body. */
  title?: string;
  /** Optional CTA button below the body. */
  cta?: { label: string; onPress: () => void };
  /** Centers content horizontally within its container. */
  centered?: boolean;
  /** Adds vertical breathing room — use for screen-level empties, skip for inline section-level. */
  spaced?: boolean;
  /** Makes the whole body tappable (no CTA button). Used when a section's empty hint should route somewhere. */
  onPress?: () => void;
}

/**
 * Single empty-state primitive for the app. Two implicit variants:
 *   • inline (default): italic body text, no icon, optional onPress tap.
 *     Used inside populated screens for empty sub-sections (e.g. an artist's
 *     gallery when they've uploaded nothing).
 *   • screen (`icon` + `title` + `spaced`): full empty-screen treatment with
 *     icon, headline, body, optional CTA. Used for empty Feed / Map / Inbox.
 *
 * The intent is one component for both so copy + visual treatment stay
 * consistent as the empty-states audit lands more callers.
 */
export function EmptyState({
  body,
  icon,
  title,
  cta,
  centered = false,
  spaced = false,
  onPress,
}: EmptyStateProps) {
  const content = (
    <View
      style={[
        styles.container,
        centered && styles.containerCentered,
        spaced && styles.containerSpaced,
      ]}
    >
      {icon && (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={32} color={colors.text.tertiary} />
        </View>
      )}
      {title && <Text style={styles.title}>{title}</Text>}
      <Text style={[styles.body, !icon && !title && styles.bodyInline, centered && styles.bodyCentered]}>
        {body}
      </Text>
      {cta && (
        <TouchableOpacity
          style={styles.cta}
          onPress={cta.onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.ctaLabel}>{cta.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

const META = '#868579';

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  containerCentered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerSpaced: {
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
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
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  body: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: META,
    lineHeight: 18,
  },
  // Inline use (no icon, no title) — italics make it read as a soft placeholder
  // rather than a section header.
  bodyInline: {
    fontStyle: 'italic',
  },
  bodyCentered: {
    textAlign: 'center',
  },
  cta: {
    marginTop: spacing.sm,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: colors.neutral.chocolate,
    alignSelf: 'center',
  },
  ctaLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
});
