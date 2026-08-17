import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { useScreenshotUrl } from '@/hooks/useBugTriage';
import {
  KIND_LABEL,
  SEVERITY_LABEL,
  detailEntriesForRow,
  primaryLabel,
} from '@/constants/report-kinds';
import { STATUS_LABEL, type BugReportStatus, type TriageReport } from '@/types/bug-reports';
import { formatMessageTime } from '@/utils/date';
import { colors, typography, spacing, radius } from '@/constants/theme';

/**
 * One report in the triage queue (app/bug-triage.tsx).
 *
 * Renders the STRUCTURED answers as labelled fields — under exactly the
 * labels the reporter was asked, because both sides read
 * constants/report-kinds.ts. That is the whole reason `details` is a
 * structured JSONB rather than more prose glued onto `description`.
 *
 * Rejection deliberately costs an extra tap: the reason box has to be filled
 * in before "Reject" will commit, matching the service and the pipeline
 * design ("rejected reports keep their reason"). Approving is one tap,
 * because approving is the common case.
 */
export function TriageCard({
  report,
  isPending,
  onApprove,
  onReject,
  onSetStatus,
  onSaveNote,
}: {
  report: TriageReport;
  isPending: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onSetStatus: (status: BugReportStatus) => void;
  onSaveNote: (note: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [note, setNote] = useState(report.triage_note ?? '');
  const [noteOpen, setNoteOpen] = useState(false);

  const screenshotUrl = useScreenshotUrl(report.screenshot_path);
  const details = detailEntriesForRow(report.kind, report.details);
  const noteDirty = note.trim() !== (report.triage_note ?? '').trim();

  function commitReject() {
    if (!reason.trim()) {
      setReasonError('Say why — the reporter sees this.');
      return;
    }
    setReasonError(null);
    onReject(reason);
    setRejecting(false);
  }

  return (
    <View style={styles.card}>
      {/* ── Badges ─────────────────────────────────────────────────────── */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, styles.badgeKind]}>
          <Text style={styles.badgeKindText}>{KIND_LABEL[report.kind]}</Text>
        </View>
        {report.severity && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{SEVERITY_LABEL[report.severity]}</Text>
          </View>
        )}
        {report.screen && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{report.screen}</Text>
          </View>
        )}
        <View style={[styles.badge, styles.badgeStatus]}>
          <Text style={styles.badgeText}>{STATUS_LABEL[report.status]}</Text>
        </View>
        <Text style={styles.timestamp}>{formatMessageTime(report.created_at)}</Text>
      </View>

      <Text style={styles.reporter}>
        {report.reporterName}
        {report.app_version ? ` · v${report.app_version}` : ''}
      </Text>

      {/* ── The structured answers ─────────────────────────────────────── */}
      <Text style={styles.fieldLabel}>{primaryLabel(report.kind)}</Text>
      <Text style={styles.fieldValue}>{report.description}</Text>

      {details.map((entry) => (
        <View key={entry.key}>
          <Text style={styles.fieldLabel}>{entry.label}</Text>
          <Text style={styles.fieldValue}>{entry.value}</Text>
        </View>
      ))}

      {report.screenshot_path && (
        <View style={styles.screenshotWrap}>
          {screenshotUrl ? (
            <Image
              source={{ uri: screenshotUrl }}
              style={styles.screenshot}
              accessibilityLabel="Attached screenshot"
            />
          ) : (
            <View style={[styles.screenshot, styles.screenshotPlaceholder]}>
              <ActivityIndicator color={colors.text.tertiary} />
            </View>
          )}
        </View>
      )}

      {report.status === 'rejected' && report.status_reason && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Rejected because</Text>
          <Text style={styles.fieldValue}>{report.status_reason}</Text>
        </View>
      )}

      {/* ── Note ───────────────────────────────────────────────────────── */}
      {noteOpen || report.triage_note ? (
        <View style={styles.noteBlock}>
          <Input
            label="Note"
            placeholder="Dupe of the mural one · needs a design call first"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          {noteDirty && (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => onSaveNote(note)}
              disabled={isPending}
              accessibilityRole="button"
              accessibilityLabel={`Save note on ${report.description.slice(0, 40)}`}
            >
              <Text style={styles.linkButtonText}>Save note</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => setNoteOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Add a note"
        >
          <Ionicons name="create-outline" size={16} color={colors.text.secondary} />
          <Text style={styles.linkButtonText}>Add a note</Text>
        </TouchableOpacity>
      )}

      {/* ── Actions ────────────────────────────────────────────────────── */}
      {rejecting ? (
        <View style={styles.rejectBlock}>
          <Input
            label="Reason for rejecting"
            placeholder="Working as designed — the feed is chronological on purpose."
            value={reason}
            onChangeText={(text) => {
              setReason(text);
              if (reasonError && text.trim()) setReasonError(null);
            }}
            error={reasonError ?? undefined}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.action, styles.actionGhost]}
              onPress={() => {
                setRejecting(false);
                setReasonError(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel rejection"
            >
              <Text style={styles.actionGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.action, styles.actionDanger]}
              onPress={commitReject}
              disabled={isPending}
              accessibilityRole="button"
              accessibilityLabel="Confirm rejection"
            >
              <Text style={styles.actionDangerText}>Confirm reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.actionRow}>
          {isPending && <ActivityIndicator color={colors.text.secondary} />}
          {report.status !== 'approved' && (
            <TouchableOpacity
              style={[styles.action, styles.actionPrimary]}
              onPress={onApprove}
              disabled={isPending}
              accessibilityRole="button"
              accessibilityLabel={`Approve report: ${report.description.slice(0, 40)}`}
            >
              <Text style={styles.actionPrimaryText}>Approve</Text>
            </TouchableOpacity>
          )}
          {report.status !== 'rejected' && (
            <TouchableOpacity
              style={[styles.action, styles.actionGhost]}
              onPress={() => setRejecting(true)}
              disabled={isPending}
              accessibilityRole="button"
              accessibilityLabel={`Reject report: ${report.description.slice(0, 40)}`}
            >
              <Text style={styles.actionGhostText}>Reject</Text>
            </TouchableOpacity>
          )}
          {report.status === 'approved' && (
            <TouchableOpacity
              style={[styles.action, styles.actionGhost]}
              onPress={() => onSetStatus('fixed')}
              disabled={isPending}
              accessibilityRole="button"
              accessibilityLabel={`Mark fixed: ${report.description.slice(0, 40)}`}
            >
              <Text style={styles.actionGhostText}>Mark fixed</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral.hiddenLines,
    backgroundColor: colors.white,
  },

  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.neutral.divider,
  },
  badgeKind: {
    backgroundColor: colors.neutral.chocolate,
    borderColor: colors.neutral.chocolate,
  },
  badgeStatus: {
    backgroundColor: colors.surface,
  },
  badgeText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.xs,
    color: colors.neutral.cardMeta,
  },
  badgeKindText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.white,
  },
  timestamp: {
    marginLeft: 'auto',
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.xs,
    color: colors.neutral.meta,
  },

  reporter: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.xs,
    color: colors.neutral.meta,
  },

  fieldLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.meta,
    marginTop: spacing.sm,
  },
  fieldValue: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: colors.neutral.body,
  },

  screenshotWrap: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  screenshot: {
    width: 110,
    height: 190,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  screenshotPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  reasonBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  reasonLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.badge.red,
  },

  noteBlock: { marginTop: spacing.sm, gap: spacing.xs },
  rejectBlock: { marginTop: spacing.sm, gap: spacing.sm },

  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
  linkButtonText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  action: {
    height: 36,
    paddingHorizontal: spacing.base,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: { backgroundColor: colors.neutral.chocolate },
  actionPrimaryText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.white,
  },
  actionGhost: {
    borderWidth: 1,
    borderColor: colors.neutral.hiddenLines,
    backgroundColor: colors.white,
  },
  actionGhostText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.chocolate,
  },
  actionDanger: { backgroundColor: colors.badge.red },
  actionDangerText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.badge.redText,
  },
});
