import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@/context/AuthContext';
import { useIsDesigner } from '@/hooks/useBugReport';
import { useBugTriage } from '@/hooks/useBugTriage';
import { TriageCard } from '@/components/bug-report/TriageCard';
import { KIND_LABEL, REPORT_KIND_OPTIONS, type ReportKind } from '@/constants/report-kinds';
import { STATUS_LABEL, TRIAGE_STATUSES, type BugReportStatus } from '@/types/bug-reports';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

/**
 * Triage — Aidan's answer to "where do I approve this?" (2026-08-17).
 *
 * ADMIN SURFACE. Visible only to `profiles.is_designer`, which until this
 * screen existed gated nothing at all. Reporting stays open to every
 * signed-in user; this is the other half of the split described in
 * useBugReport.ts.
 *
 * ⚠️ THE FLAG IS FALSE ON EVERY ACCOUNT, INCLUDING AIDAN'S, and a trigger
 * blocks setting it from the client. Until this is run once in the Supabase
 * SQL editor, this screen is a dead end for everyone — by design:
 *
 *   update public.profiles set is_designer = true
 *    where id = (select id from auth.users where email = '…');
 *
 * The dead end is not a permission check in any meaningful sense — it hides
 * a screen that would be empty anyway. The real boundary is RLS:
 * `bug_reports_select_designer` / `bug_reports_update_designer` in migration
 * 20260817120000. A non-designer who reaches this route by deep link reads
 * nothing and writes nothing.
 */

export default function BugTriageScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const isDesigner = useIsDesigner(user?.id);
  const {
    reports,
    isLoading,
    loadError,
    pendingId,
    actionError,
    statusFilter,
    setStatusFilter,
    kindFilter,
    setKindFilter,
    refresh,
    approve,
    reject,
    setStatus,
    saveNote,
  } = useBugTriage(isDesigner);

  // ── Not a designer (or signed out) — dead end ────────────────────────────
  if (!isDesigner) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={32} color={colors.text.tertiary} />
          <Text style={styles.deadEndText}>Nothing here.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onBack={() => router.back()} />

      <View style={styles.filters}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterChip
            label="All"
            selected={statusFilter === null}
            onPress={() => setStatusFilter(null)}
          />
          {TRIAGE_STATUSES.map((status: BugReportStatus) => (
            <FilterChip
              key={status}
              label={STATUS_LABEL[status]}
              selected={statusFilter === status}
              onPress={() => setStatusFilter(statusFilter === status ? null : status)}
            />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterChip
            label="Any kind"
            selected={kindFilter === null}
            onPress={() => setKindFilter(null)}
          />
          {REPORT_KIND_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              label={KIND_LABEL[option.value as ReportKind]}
              selected={kindFilter === option.value}
              onPress={() => setKindFilter(kindFilter === option.value ? null : option.value)}
            />
          ))}
        </ScrollView>
      </View>

      {actionError && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.badge.red} />
          <Text style={styles.errorText}>{actionError}</Text>
        </View>
      )}

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => void refresh()} />
        }
        renderItem={({ item }) => (
          <TriageCard
            report={item}
            isPending={pendingId === item.id}
            onApprove={() => void approve(item.id)}
            onReject={(reason) => void reject(item.id, reason)}
            onSetStatus={(status) => void setStatus(item.id, status)}
            onSaveNote={(note) => void saveNote(item.id, note)}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={styles.listSpinner} color={colors.text.secondary} />
          ) : (
            <View style={styles.center}>
              <Ionicons
                name={loadError ? 'cloud-offline-outline' : 'checkmark-done-outline'}
                size={32}
                color={colors.text.tertiary}
              />
              <Text style={styles.deadEndText}>
                {loadError ?? 'Nothing in the queue for this filter.'}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────────

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Filter: ${label}`}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Triage</Text>
      <View style={styles.backButton} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  filters: { gap: spacing.xs, paddingBottom: spacing.xs },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.neutral.hiddenLines,
    backgroundColor: colors.white,
  },
  chipSelected: {
    backgroundColor: colors.neutral.chocolate,
    borderColor: colors.neutral.chocolate,
  },
  chipText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  chipTextSelected: { color: colors.white },

  listContent: {
    padding: spacing.base,
    gap: spacing.md,
    flexGrow: 1,
  },
  listSpinner: { marginTop: spacing['3xl'] },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginHorizontal: spacing.base,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  errorText: {
    flex: 1,
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.badge.red,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
  },
  deadEndText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('bug-triage');
