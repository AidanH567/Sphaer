import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthContext } from '@/context/AuthContext';
import { useBugReportSubmit, useCanReportBug } from '@/hooks/useBugReport';
import { KindPicker } from '@/components/bug-report/KindPicker';
import {
  ScreenshotAnnotator,
  type AnnotationResult,
} from '@/components/bug-report/ScreenshotAnnotator';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  SCREEN_OPTIONS,
  SEVERITY_OPTIONS,
  buildReportDetails,
  fieldsForKind,
  primaryAnswer,
  showsScreen,
  showsSeverity,
  type ReportAnswers,
  type ReportFieldKey,
  type ReportKind,
  type ReportSeverity,
} from '@/constants/report-kinds';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

/**
 * Report screen — bugs, feature ideas and changes (design doc "Sphaer Bug
 * System — 2026-08-17", inlet 2, extended the same day: "not everything we
 * want to add is a bug… I want it to be ultra specific so we can fix bugs
 * and suggest features easily").
 *
 * KIND FIRST, then only the questions that kind actually needs. The previous
 * version opened with "What went wrong?" and a box labelled "Describe the
 * bug", which told anyone arriving with an idea that they were on the wrong
 * screen. Reached via the settings row on Profile.
 *
 * Open to ANY signed-in user. The check is repeated here rather than trusted
 * from the entry row, so a deep link from a signed-OUT visitor lands on a
 * dead end instead of a form that cannot submit.
 *
 * ⚠️ This guard is one of several places the reporting permission lives —
 * table policy, storage policy, entry row, and here. Opening the first three
 * and missing this one shipped a screen that rendered "Nothing here." to its
 * own author (2026-08-17). If the rule changes, grep `useCanReportBug` AND
 * both RLS policies.
 *
 * The field spec (which questions per kind, which are required) is NOT in
 * this file — it lives in src/constants/report-kinds.ts so the triage screen
 * reads the answers back under exactly the labels they were asked under.
 */

export default function BugReportScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const canReport = useCanReportBug(user?.id);
  const { state, errorMessage, submit } = useBugReportSubmit(user?.id);

  const [kind, setKind] = useState<ReportKind>('bug');
  // ONE answers map across every kind. Switching bug → feature → bug keeps
  // what you typed; `buildReportDetails` is what stops a kind's leftovers
  // riding along on a report of a different kind.
  const [answers, setAnswers] = useState<ReportAnswers>({});
  const [primaryError, setPrimaryError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<ReportSeverity | null>(null);
  const [screen, setScreen] = useState<string | null>(null);
  /**
   * The attached screenshot, with the pixel size the picker reported.
   *
   * The size is kept because the annotator needs it twice: to flatten the
   * marks at the screenshot's REAL resolution rather than the phone's display
   * size, and to scale the stroke width. Without it the annotated image would
   * be a downscaled screenshot — legible strokes over an unreadable UI.
   */
  const [screenshot, setScreenshot] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);
  /** Bare base64 of the FLATTENED annotated image, once the user has drawn. */
  const [annotatedBase64, setAnnotatedBase64] = useState<string | null>(null);
  const [isAnnotating, setIsAnnotating] = useState(false);

  const fields = useMemo(() => fieldsForKind(kind), [kind]);

  const annotatedDataUri = annotatedBase64
    ? `data:image/png;base64,${annotatedBase64}`
    : null;
  /**
   * Annotation needs the source's real dimensions to place marks correctly. A
   * picker that reported none (rare, but it is an optional field on the asset)
   * leaves the screenshot attachable and the pen disabled — an honest dead
   * button beats marks silently landing in the wrong place.
   */
  const canAnnotate = Boolean(screenshot && screenshot.width > 0 && screenshot.height > 0);

  const setAnswer = useCallback((key: ReportFieldKey, text: string) => {
    setAnswers((prev) => ({ ...prev, [key]: text }));
  }, []);

  async function pickScreenshot() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to attach a screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setScreenshot({
        uri: asset.uri,
        // The picker reports these for every asset. Falling back to 0 rather
        // than a guess means `fitContain` returns an empty rect and the
        // annotator declines to draw, instead of laying marks against
        // invented dimensions and misplacing every one of them.
        width: asset.width ?? 0,
        height: asset.height ?? 0,
      });
      setAnnotatedBase64(null);
    }
  }

  function removeScreenshot() {
    setScreenshot(null);
    setAnnotatedBase64(null);
  }

  function handleAnnotationSaved(result: AnnotationResult) {
    setAnnotatedBase64(result.base64);
    setIsAnnotating(false);
  }

  function handleSubmit() {
    const description = primaryAnswer(kind, answers);
    if (!description) {
      setPrimaryError(`Please answer "${fields[0].label}".`);
      return;
    }
    setPrimaryError(null);
    void submit({
      description,
      kind,
      severity: showsSeverity(kind) ? severity : null,
      details: buildReportDetails(kind, answers),
      screen: showsScreen(kind) ? screen : null,
      screenshotUri: screenshot?.uri ?? null,
      // The flattened image wins when there is one — it IS the screenshot,
      // plus the marks. The service enforces the same precedence.
      screenshotBase64: annotatedBase64,
    });
  }

  // ── Signed out (deep link) — dead end, no form ───────────────────────────
  if (!canReport) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="construct-outline" size={32} color={colors.text.tertiary} />
          <Text style={styles.deadEndText}>Nothing here.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (state === 'success') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={48} color={colors.black} />
          <Text style={styles.successTitle}>Filed.</Text>
          <Text style={styles.successBody}>
            Thanks — it&apos;s in the queue. You can send another anytime.
          </Text>
          <Button label="Done" onPress={() => router.back()} style={styles.doneButton} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <KindPicker
            value={kind}
            onChange={(next) => {
              setKind(next);
              setPrimaryError(null);
            }}
          />

          {fields.map((field, index) => (
            <View key={field.key} style={styles.field}>
              <Input
                label={field.required ? field.label : `${field.label} (optional)`}
                placeholder={field.placeholder}
                value={answers[field.key] ?? ''}
                onChangeText={(text) => {
                  setAnswer(field.key, text);
                  if (index === 0 && primaryError && text.trim()) setPrimaryError(null);
                }}
                error={index === 0 ? (primaryError ?? undefined) : undefined}
                multiline
                numberOfLines={field.lines}
                textAlignVertical="top"
              />
            </View>
          ))}

          {showsSeverity(kind) && (
            <>
              <Text style={styles.sectionLabel}>How bad is it?</Text>
              <View style={styles.chipWrap}>
                {SEVERITY_OPTIONS.map((option) => {
                  const selected = severity === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setSeverity(selected ? null : option.value)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Severity: ${option.label}`}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {showsScreen(kind) && (
            <>
              <Text style={styles.sectionLabel}>Which screen?</Text>
              <View style={styles.chipWrap}>
                {SCREEN_OPTIONS.map((option) => {
                  const selected = screen === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setScreen(selected ? null : option)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Screen: ${option}`}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Screenshots stay available for all three kinds — a mockup or a
              reference from another app is as useful on a feature request as
              a broken screen is on a bug. */}
          <Text style={styles.sectionLabel}>Screenshot</Text>
          {screenshot ? (
            <View style={styles.screenshotRow}>
              <View style={styles.screenshotWrap}>
                <Image
                  // Once annotated, show the FLATTENED result — the thumbnail
                  // on the form is then the same picture that gets sent, so
                  // there is no way to believe you attached marks you didn't.
                  source={{ uri: annotatedDataUri ?? screenshot.uri }}
                  style={styles.screenshot}
                />
                <TouchableOpacity
                  style={styles.screenshotRemove}
                  onPress={removeScreenshot}
                  accessibilityRole="button"
                  accessibilityLabel="Remove screenshot"
                >
                  <Ionicons name="close" size={16} color={colors.white} />
                </TouchableOpacity>
              </View>

              <View style={styles.screenshotActions}>
                {/* The whole point of the feature, so it is a labelled button
                    rather than an icon: a designer who does not notice this
                    files the vague report we were trying to stop. */}
                <TouchableOpacity
                  style={styles.annotateButton}
                  onPress={() => setIsAnnotating(true)}
                  disabled={!canAnnotate}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={
                    annotatedBase64 ? 'Edit your marks' : 'Circle what is wrong'
                  }
                  accessibilityState={{ disabled: !canAnnotate }}
                >
                  <Ionicons
                    name="brush-outline"
                    size={18}
                    color={canAnnotate ? colors.text.primary : colors.text.tertiary}
                  />
                  <Text
                    style={[
                      styles.annotateButtonText,
                      !canAnnotate && styles.annotateButtonTextDisabled,
                    ]}
                  >
                    {annotatedBase64 ? 'Edit marks' : "Circle what's wrong"}
                  </Text>
                </TouchableOpacity>

                {annotatedBase64 && (
                  <View style={styles.annotatedBadge}>
                    <Ionicons name="checkmark" size={14} color={colors.text.secondary} />
                    <Text style={styles.annotatedBadgeText}>Marked up</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.attachButton}
              onPress={pickScreenshot}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Attach a screenshot"
            >
              <Ionicons name="image-outline" size={20} color={colors.text.secondary} />
              <Text style={styles.attachButtonText}>Attach a screenshot</Text>
            </TouchableOpacity>
          )}

          {errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.badge.red} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <Button
            label="Send report"
            onPress={handleSubmit}
            isLoading={state === 'submitting'}
            disabled={state === 'submitting'}
            style={styles.submitButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Mounted only while open: the annotator holds a full-resolution
          offscreen canvas, which is not something to keep alive behind a form
          the user may never annotate from. */}
      {screenshot && canAnnotate && isAnnotating && (
        <ScreenshotAnnotator
          visible
          uri={screenshot.uri}
          sourceWidth={screenshot.width}
          sourceHeight={screenshot.height}
          onCancel={() => setIsAnnotating(false)}
          onSave={handleAnnotationSaved}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

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
      <Text style={styles.headerTitle}>Report or suggest</Text>
      <View style={styles.backButton} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },

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

  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
  },

  field: { marginTop: spacing.base },

  sectionLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginTop: spacing.base,
    marginBottom: spacing.xs,
  },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.tag.border,
    backgroundColor: colors.tag.background,
  },
  chipSelected: {
    backgroundColor: colors.tag.backgroundSelected,
  },
  chipText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  chipTextSelected: {
    color: colors.tag.textSelected,
  },

  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignSelf: 'flex-start',
  },
  attachButtonText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  screenshotRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.base,
  },
  screenshotWrap: {
    alignSelf: 'flex-start',
  },
  screenshotActions: {
    flex: 1,
    gap: spacing.sm,
    // Nudged clear of the thumbnail's absolute remove button.
    paddingTop: spacing.xs,
  },
  annotateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  annotateButtonText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  annotateButtonTextDisabled: {
    color: colors.text.tertiary,
  },
  annotatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'center',
  },
  annotatedBadgeText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  screenshot: {
    width: 120,
    height: 200,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  screenshotRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.base,
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

  submitButton: {
    marginTop: spacing.lg,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  deadEndText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
  },
  successTitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  successBody: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  doneButton: {
    marginTop: spacing.base,
    alignSelf: 'stretch',
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('bug-report');
