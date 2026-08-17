import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@/context/AuthContext';
import { useIsDesigner } from '@/hooks/useBugReport';
import { colors, typography, spacing } from '@/constants/theme';

/**
 * Hidden "Report a bug" settings row (design doc "Sphaer Bug System —
 * 2026-08-17"). Fully self-contained on purpose: it checks the server-set
 * profiles.is_designer flag itself and renders NOTHING for everyone else,
 * so the host settings section needs exactly one JSX line and no state.
 * Fails closed — no session, no flag, or schema not yet migrated all
 * mean the row simply doesn't exist.
 */
export function BugReportRow() {
  const router = useRouter();
  const { user } = useAuthContext();
  const isDesigner = useIsDesigner(user?.id);

  if (!isDesigner) return null;

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
