import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@/context/AuthContext';
import { useIsDesigner } from '@/hooks/useBugReport';
import { colors, typography, spacing } from '@/constants/theme';

/**
 * "Triage reports" settings row — the ADMIN entry point, and the first thing
 * in the app that `profiles.is_designer` has ever actually gated.
 *
 * Renders nothing for everyone else, including while the flag is still being
 * fetched (useIsDesigner starts false and fails closed), so a normal user
 * never sees an admin row flash past on a slow connection.
 *
 * ⚠️ The flag is FALSE on every account today and a trigger blocks setting it
 * from the client — so this row is invisible to everyone, Aidan included,
 * until the one-line UPDATE in migration 20260817120000's footer is run in
 * the Supabase SQL editor. That is the intended fail-closed state, not a bug.
 * Hiding the row is not the security boundary either; RLS is.
 */
export function TriageRow() {
  const router = useRouter();
  const { user } = useAuthContext();
  const isDesigner = useIsDesigner(user?.id);

  if (!isDesigner) return null;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push('/bug-triage' as never)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Triage reports"
    >
      <Ionicons name="albums-outline" size={20} color={colors.text.secondary} />
      <Text style={styles.rowText}>Triage reports</Text>
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
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  chevron: {
    marginLeft: 'auto',
  },
});
