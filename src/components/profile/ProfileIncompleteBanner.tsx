import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '@/constants/theme';

interface ProfileIncompleteBannerProps {
  /** Tap to dismiss for this session. */
  onDismiss: () => void;
  /** Tap the body / CTA to navigate to Edit Profile. */
  onEditPress: () => void;
  /** Optional: list specific missing fields to call out. */
  missing?: string[];
}

/**
 * Soft-gate nudge shown on the profile tab when the user's profile is sparse
 * (no bio / no avatar / etc). Dismissible per session — reappears next
 * launch until the profile is complete.
 *
 * The "soft gate" approach was chosen in design (Q7 of the profile/auth
 * planning grilling) over a hard redirect to onboarding — hard gates kill
 * early retention.
 */
export function ProfileIncompleteBanner({
  onDismiss,
  onEditPress,
  missing,
}: ProfileIncompleteBannerProps) {
  const subtitle =
    missing && missing.length > 0
      ? `Add ${formatList(missing)} so people can find you.`
      : 'A few small touches make your profile feel like home.';

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="sparkles-outline" size={18} color={colors.black} />
      </View>

      <TouchableOpacity style={styles.body} onPress={onEditPress} activeOpacity={0.7}>
        <Text style={styles.title}>Finish setting up your profile</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onDismiss}
        style={styles.dismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={18} color={colors.text.tertiary} />
      </TouchableOpacity>
    </View>
  );
}

function formatList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#F4F1EA', // soft cream
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E7E2D5',
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
  dismiss: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
