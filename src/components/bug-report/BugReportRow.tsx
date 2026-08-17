import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@/context/AuthContext';
import { useCanReportBug } from '@/hooks/useBugReport';
import { colors, typography, spacing } from '@/constants/theme';

/**
 * "Report a problem or suggest a feature" settings row (design doc "Sphaer
 * Bug System — 2026-08-17"). Self-contained on purpose: it decides its own
 * visibility, so the host settings section needs exactly one JSX line and no
 * state.
 *
 * ⚠️ THE WORDING IS THE FEATURE. This row said "Report a bug" and the screen
 * behind it asked "What went wrong?", which is a closed door to anyone
 * arriving with an idea — Aidan, 2026-08-17: "not everything we want to add
 * is a bug". Renaming it is half of what makes the kind picker reachable;
 * don't quietly shorten it back to "Report a bug".
 *
 * Visible to ANY signed-in user. Signed out, it renders nothing. The ADMIN
 * counterpart is TriageRow, gated on `is_designer`.
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
      accessibilityLabel="Report a problem or suggest a feature"
    >
      <Ionicons name="chatbox-ellipses-outline" size={20} color={colors.text.secondary} />
      <Text style={styles.rowText}>Report a problem or suggest a feature</Text>
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
