import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@/context/AuthContext';
import { useCanReportBug } from '@/hooks/useBugReport';
import { colors, typography, spacing } from '@/constants/theme';

/**
 * "Report a bug" settings row (design doc "Sphaer Bug System — 2026-08-17").
 * Self-contained on purpose: it decides its own visibility, so the host
 * settings section needs exactly one JSX line and no state.
 *
 * Visible to ANY signed-in user as of 2026-08-17 (Aidan: "right now let's
 * just open it for everyone" — we are testing with three people, and a
 * per-account flag is friction on the people whose feedback we want).
 * Signed out, it still renders nothing.
 *
 * Planned: this becomes the light USER-facing report, with a separate fuller
 * ADMIN screen for triage — see `useCanReportBug` / `useIsDesigner`.
 */
export function BugReportRow() {
  const router = useRouter();
  const { user } = useAuthContext();
  const canReport = useCanReportBug(user?.id);

  if (!canReport) return null;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push('/bug-report' as never)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Report a bug"
    >
      <Ionicons name="bug-outline" size={20} color={colors.text.secondary} />
      <Text style={styles.rowText}>Report a bug</Text>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.text.tertiary}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
}

// Mirrors the settingsRow styles in app/(tabs)/profile/index.tsx so the row
// is visually indistinguishable from its siblings.
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowText: {
    flex: 1,
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  chevron: {
    marginLeft: 'auto',
  },
});
