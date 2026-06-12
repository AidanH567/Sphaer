import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography, radius, motion } from '@/constants/theme';
import { useAuthContext } from '@/context/AuthContext';
import {
  submitReport,
  ModerationUnavailableError,
  type ReportReason,
  type ReportTargetType,
} from '@/services/moderation.service';

interface ReportSheetProps {
  visible: boolean;
  /** Drives the title ("Report event") and the reports.target_type column.
   *  'profile' and 'message' both read as "user" in the UI copy. */
  targetType: ReportTargetType;
  /** Id of the reported event/circle/profile/message. Sheet stays inert
   *  (submit no-ops) while null — callers pass null until the target loads. */
  targetId: string | null;
  onClose: () => void;
}

const SHEET_OFFSET = 600; // off-screen translate distance (taller sheet)
const ANIMATION_DURATION = motion.duration.standard;
const SUCCESS_DISMISS_MS = 2200;

const TARGET_NOUN: Record<ReportTargetType, string> = {
  event: 'event',
  circle: 'circle',
  profile: 'user',
  message: 'user',
};

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or hate' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'other', label: 'Other' },
];

/**
 * Bottom sheet for filing a content/user report (App Store Guideline 1.2).
 * Same animate-out-before-unmount Modal chrome as ConfirmSheet. Picks one
 * of five reasons, optional free-text details (required for "Other"),
 * then a success state that auto-dismisses.
 *
 * If the reports table doesn't exist yet (migration not pushed), submit
 * surfaces the ModerationUnavailableError message inline instead of
 * crashing or sticking the spinner.
 */
export function ReportSheet({ visible, targetType, targetId, onClose }: ReportSheetProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const translateY = useRef(new Animated.Value(SHEET_OFFSET)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Keeps the Modal mounted while the close animation finishes.
  const [modalMounted, setModalMounted] = useState(false);

  const [phase, setPhase] = useState<'form' | 'done'>('form');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      // Fresh form every time the sheet opens.
      setPhase('form');
      setReason(null);
      setDetails('');
      setErrorText(null);
      setSubmitting(false);
      setModalMounted(true);
      translateY.setValue(SHEET_OFFSET);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          ...motion.spring.sheet,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (modalMounted) {
      // `else if (modalMounted)` + the `finished` guard both matter: the
      // open branch's setValue() STOPS any in-flight close animation and
      // fires its end callback with finished:false — without the guards a
      // reopen-during-close (or the initial mount's no-op close) unmounts
      // the Modal right after it mounts.
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SHEET_OFFSET,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setModalMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate on visibility flips only; Animated refs are stable, modalMounted read for the close guard
  }, [visible]);

  // Success state lingers long enough to read, then dismisses itself.
  useEffect(() => {
    if (phase !== 'done' || !visible) return;
    const timer = setTimeout(onClose, SUCCESS_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [phase, visible, onClose]);

  const noun = TARGET_NOUN[targetType];
  const detailsRequired = reason === 'other';
  const canSubmit =
    reason !== null && targetId !== null && (!detailsRequired || details.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || !reason || !targetId || submitting) return;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to report content.');
      return;
    }
    setSubmitting(true);
    setErrorText(null);
    try {
      await submitReport(user.id, {
        targetType,
        targetId,
        reason,
        details: details.trim() || undefined,
      });
      setPhase('done');
    } catch (e: unknown) {
      setErrorText(
        e instanceof ModerationUnavailableError
          ? e.message
          : 'Could not send your report. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Backdrop tap is disabled while submitting so the report can't be
  // abandoned in-flight.
  function handleDismiss() {
    if (submitting) return;
    onClose();
  }

  return (
    <Modal
      visible={modalMounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        style={styles.flexEnd}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.45],
                }),
              },
            ]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom || spacing.lg, transform: [{ translateY }] },
          ]}
        >
          <View style={styles.handle} />

          {phase === 'done' ? (
            <View style={styles.successArea}>
              <Ionicons name="checkmark-circle" size={48} color={colors.neutral.chocolate} />
              <Text style={styles.successText}>
                Thanks — we&apos;ll review this within 24 hours.
              </Text>
            </View>
          ) : (
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.title}>Report {noun}</Text>
              <Text style={styles.subtitle}>
                Your report is confidential — the {noun} won&apos;t know.
              </Text>

              <View style={styles.reasons}>
                {REASONS.map((r) => {
                  const selected = reason === r.value;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      style={styles.reasonRow}
                      onPress={() => setReason(r.value)}
                      activeOpacity={0.7}
                      accessibilityRole="radio"
                      accessibilityLabel={r.label}
                      accessibilityState={{ checked: selected }}
                    >
                      <Ionicons
                        name={selected ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        color={selected ? colors.neutral.chocolate : colors.neutral.neutral400}
                      />
                      <Text style={[styles.reasonLabel, selected && styles.reasonLabelSelected]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Plain TextInput rather than ui/Input: the Input container is
                  a fixed 50px row and clips multiline content. Chrome matches
                  the create-screen textarea (hiddenLines border, radius.sm). */}
              <Text style={styles.detailsLabel}>
                {detailsRequired ? 'Details (required)' : 'Details (optional)'}
              </Text>
              <TextInput
                style={styles.textarea}
                value={details}
                onChangeText={setDetails}
                multiline
                numberOfLines={3}
                maxLength={500}
                placeholder="Anything that helps us understand what happened"
                placeholderTextColor={colors.text.placeholder}
                accessibilityLabel="Report details"
              />

              {errorText && <Text style={styles.errorText}>{errorText}</Text>}

              <Button
                label="Submit report"
                onPress={handleSubmit}
                isLoading={submitting}
                disabled={!canSubmit}
                style={styles.submitButton}
              />
            </ScrollView>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flexEnd: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  reasons: {
    marginBottom: spacing.base,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  reasonLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  reasonLabelSelected: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.chocolate,
  },
  detailsLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  textarea: {
    borderWidth: 1,
    borderColor: colors.neutral.hiddenLines,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    textAlignVertical: 'top',
  },
  errorText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.badge.red,
    marginTop: spacing.sm,
  },
  submitButton: {
    marginTop: spacing.base,
  },
  successArea: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing['2xl'],
  },
  successText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
});
