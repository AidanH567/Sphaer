import React, { useState } from 'react';
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
import { useBugReportSubmit, useIsDesigner } from '@/hooks/useBugReport';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

/**
 * Hidden designer bug-report screen (design doc "Sphaer Bug System —
 * 2026-08-17", inlet 2). Reached only via the "Report a bug" row in the
 * profile settings section, which renders solely for profiles flagged
 * is_designer — but the flag is re-checked here too, so a deep link from
 * a non-designer lands on a dead end, not a working form.
 *
 * Fields: description (required), screen picker (fixed list of app
 * surfaces — the entry point lives on Profile, so auto-capturing the
 * current route would always say "Profile"; an explicit picker is more
 * honest), optional screenshot via the standard expo-image-picker flow.
 * Submit files a `bug_reports` row with status 'new'.
 */

// Fixed list of app surfaces. Deliberately human names, not route paths —
// these end up in triage and in auto-drafted fix prompts.
const SCREEN_OPTIONS = [
  'Feed',
  'Map',
  'Mural',
  'Circles',
  'Create',
  'Messages',
  'Profile',
  'Event detail',
  'Onboarding',
  'Other',
] as const;

export default function BugReportScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const isDesigner = useIsDesigner(user?.id);
  const { state, errorMessage, submit } = useBugReportSubmit(user?.id);

  const [description, setDescription] = useState('');
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [screen, setScreen] = useState<string | null>(null);
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);

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
      setScreenshotUri(result.assets[0].uri);
    }
  }

  function handleSubmit() {
    if (!description.trim()) {
      setDescriptionError('Please describe the bug.');
      return;
    }
    setDescriptionError(null);
    void submit({ description, screen, screenshotUri });
  }

  // ── Not a designer (deep link) — dead end, no form ───────────────────────
  if (!isDesigner) {
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
            Thanks — the report is in the queue. You can file another anytime.
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
          <Input
            label="What went wrong?"
            placeholder="Describe the bug — what you did, what you expected, what happened."
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              if (descriptionError && text.trim()) setDescriptionError(null);
            }}
            error={descriptionError ?? undefined}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

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

          <Text style={styles.sectionLabel}>Screenshot</Text>
          {screenshotUri ? (
            <View style={styles.screenshotWrap}>
              <Image source={{ uri: screenshotUri }} style={styles.screenshot} />
              <TouchableOpacity
                style={styles.screenshotRemove}
                onPress={() => setScreenshotUri(null)}
                accessibilityRole="button"
                accessibilityLabel="Remove screenshot"
              >
                <Ionicons name="close" size={16} color={colors.white} />
              </TouchableOpacity>
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
      <Text style={styles.headerTitle}>Report a bug</Text>
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
    fontSize: 17,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
  },

  sectionLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
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
    fontSize: 13,
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
    fontSize: 14,
    color: colors.text.secondary,
  },
  screenshotWrap: {
    alignSelf: 'flex-start',
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
    fontSize: 13,
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
    fontSize: 15,
    color: colors.text.tertiary,
  },
  successTitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 20,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  successBody: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  doneButton: {
    marginTop: spacing.base,
    alignSelf: 'stretch',
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('bug-report');
