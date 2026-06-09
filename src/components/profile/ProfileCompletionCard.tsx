import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProfileCompletionField } from '@/utils/profile-completion';
import { colors, typography, spacing, radius } from '@/constants/theme';

interface ProfileCompletionCardProps {
  /** 0–100. The card unmounts itself at 100, so callers can render unconditionally. */
  percentage: number;
  /** Fields that are still empty, in display order. */
  missing: ProfileCompletionField[];
  /** Tap → open Edit Profile. */
  onEditPress: () => void;
}

/**
 * Progress card shown on the profile tab while the user's profile is sparse.
 *
 * Replaces the previous "Finish setting up your profile" banner, which kept
 * showing the same nag copy after every field was filled — at demo time it
 * read like a permanent UI bug. The completion-% framing turns the same data
 * into a positive nudge that quietly hides once the user is done.
 */
export function ProfileCompletionCard({
  percentage,
  missing,
  onEditPress,
}: ProfileCompletionCardProps) {
  if (percentage >= 100) return null;

  const subtitle =
    missing.length > 0
      ? `Add ${formatMissing(missing)}.`
      : 'A few small touches make your profile feel like home.';

  // Clamp the bar to a sensible visual range — 0% reads as "nothing at all"
  // which is technically correct but looks like a render bug. 4% keeps a hint
  // of progress visible even on a brand-new profile.
  const fillPercent = Math.max(4, percentage);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onEditPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Profile ${percentage} percent complete. Tap to edit.`}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles-outline" size={18} color={colors.black} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>Profile {percentage}% complete</Text>
          <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${fillPercent}%` }]} />
      </View>
    </TouchableOpacity>
  );
}

/**
 * Human copy for the first 1–2 missing fields. Never lists more than two:
 * a longer list reads as a chore, and the user will see the rest as soon as
 * they tap into Edit Profile.
 */
function formatMissing(missing: ProfileCompletionField[]): string {
  const first = missing[0]?.label;
  const second = missing[1]?.label;
  if (first && second) return `${first} and ${second}`;
  return first ?? 'the rest of your details';
}

const CARD_BG = '#F4F1EA';      // soft cream — matches existing banner
const CARD_BORDER = '#E7E2D5';
const BAR_TRACK = '#E7E2D5';

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: CARD_BG,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  subtitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: BAR_TRACK,
    overflow: 'hidden',
    marginLeft: 40, // align with body, past the icon
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.black,
    borderRadius: 2,
  },
});
