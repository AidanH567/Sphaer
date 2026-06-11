import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppContext } from '@/context/AppContext';
import { useAuthContext } from '@/context/AuthContext';
import { reverseGeocodeBerlinLocation } from '@/lib/geocoding';
import { updateProfile } from '@/services/profile.service';
import { colors, typography, spacing } from '@/constants/theme';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

// State-machine view for the location-onboarding flow. The same screen
// transitions through four visual phases via fade-in/out animations so
// the captured location stays in component state (no router params).
//
// prompt        → permission ask. "Share Location" or "Continue".
// searching     → invisible bridge while we wait on the OS prompt + reverse
//                 geocoder; reuses the prompt visuals so there's no flash.
// found         → "We Found You" — centered serif, auto-advances.
// reveal        → "What's happening in {neighbourhood}?" + circular CTA.
// blackout      → solid backdrop wipe before handing off to the feed.
type Phase = 'prompt' | 'searching' | 'found' | 'reveal' | 'blackout';

const FADE_MS = 600;
const FOUND_HOLD_MS = 1500;
const BLACKOUT_MS = 500;

/** Per-user AsyncStorage flag so we never run the onboarding twice. */
function storageKey(userId: string) {
  return `sphaer.location_onboarded.${userId}`;
}

export default function LocationOnboardingScreen() {
  const router = useRouter();
  const { user, profile, setProfile } = useAuthContext();
  const { feedFilters, setFeedFilters } = useAppContext();

  const [phase, setPhase] = useState<Phase>('prompt');
  const [neighbourhood, setNeighbourhood] = useState<string | null>(null);

  // Single opacity drives the fade transitions between phases.
  const opacity = useRef(new Animated.Value(0)).current;
  const blackoutOpacity = useRef(new Animated.Value(0)).current;

  // Fade content in on every phase change.
  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [phase, opacity]);

  // Bail to feed if the user has already completed onboarding once. We
  // accept either signal as proof:
  //   - DB column `profile.onboarding_completed` — the source of truth
  //     since the 2026-06-08 migration. Lets a reinstalled user skip
  //     the prompt without re-doing it on a wiped device.
  //   - Legacy AsyncStorage flag — pre-migration users have only this.
  //     When we find it set but the DB column isn't, we upgrade the DB
  //     so the next session's (auth) layout can skip /location entirely
  //     without ever mounting it.
  //
  // The (auth) layout's gate is the first line of defense; this hook is
  // belt-and-braces for the brief window during a fresh SIGNED_IN where
  // the layout might have routed here against a not-yet-loaded profile.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const flag = await AsyncStorage.getItem(storageKey(user.id));
      if (cancelled) return;
      const localOnboarded = flag === '1';
      const dbOnboarded = !!profile?.onboarding_completed;
      if (!localOnboarded && !dbOnboarded) return;
      // Migrate the legacy local flag to the DB if it hasn't already.
      if (localOnboarded && !dbOnboarded) {
        try {
          const updated = await updateProfile(user.id, { onboarding_completed: true });
          if (!cancelled) setProfile(updated);
        } catch {
          // Non-fatal — the user still gets routed to feed below.
        }
      }
      if (!cancelled) router.replace('/(tabs)/feed');
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, router, profile?.onboarding_completed, setProfile]);

  const finishAndGoToFeed = useCallback(async () => {
    if (user?.id) {
      await AsyncStorage.setItem(storageKey(user.id), '1');
      // Persist server-side so this user never sees /location again,
      // even from a fresh install. Save neighbourhood at the same time
      // so it survives the AppContext (which is in-memory only).
      try {
        const updated = await updateProfile(user.id, {
          onboarding_completed: true,
          neighborhood: neighbourhood || profile?.neighborhood || null,
        });
        setProfile(updated);
      } catch {
        // Non-fatal — AsyncStorage flag is the legacy fallback, and the
        // next session will retry the write via the migration block above.
      }
    }
    setPhase('blackout');
    // Fade backdrop to full black, then navigate.
    Animated.timing(blackoutOpacity, {
      toValue: 1,
      duration: BLACKOUT_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      router.replace('/(tabs)/feed');
    });
  }, [user?.id, router, blackoutOpacity, neighbourhood, profile?.neighborhood, setProfile]);

  // "We Found You" auto-advances to the reveal after a brief hold.
  useEffect(() => {
    if (phase !== 'found') return;
    const t = setTimeout(() => setPhase('reveal'), FOUND_HOLD_MS + FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const handleShareLocation = useCallback(async () => {
    setPhase('searching');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Permission denied — skip the reveal flourish entirely, just
        // drop them on the feed with no neighbourhood filter.
        await finishAndGoToFeed();
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const resolved = await reverseGeocodeBerlinLocation(
        pos.coords.latitude,
        pos.coords.longitude
      );
      // Prefer the Ortsteil ("Kreuzberg"); fall back to Bezirk
      // ("Friedrichshain-Kreuzberg") when Google only knew that level.
      // Don't pretend we have an Ortsteil when we don't — the
      // eventMatchesLocationFilter logic handles either kind.
      const label = resolved.neighbourhood ?? resolved.borough;
      if (!label) {
        await finishAndGoToFeed();
        return;
      }
      setNeighbourhood(label);
      setFeedFilters({ ...feedFilters, neighborhood: label });
      setPhase('found');
    } catch (err) {
      console.error('[LocationOnboarding] capture failed:', err);
      await finishAndGoToFeed();
    }
  }, [feedFilters, setFeedFilters, finishAndGoToFeed]);

  const handleSkip = useCallback(() => {
    finishAndGoToFeed();
  }, [finishAndGoToFeed]);

  const handleRevealContinue = useCallback(() => {
    finishAndGoToFeed();
  }, [finishAndGoToFeed]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Back arrow visible on prompt + reveal only (matches Figma) */}
      {(phase === 'prompt' || phase === 'reveal') && (
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      )}

      <Animated.View style={[styles.body, { opacity }]}>
        {(phase === 'prompt' || phase === 'searching') && (
          <PromptView
            onShare={handleShareLocation}
            onSkip={handleSkip}
            disabled={phase === 'searching'}
          />
        )}
        {phase === 'found' && <FoundView />}
        {phase === 'reveal' && (
          <RevealView neighbourhood={neighbourhood ?? ''} onContinue={handleRevealContinue} />
        )}
      </Animated.View>

      {/* Blackout overlay fades in on top of everything when we hand off
          to the feed — gives the cinematic wipe the Figma calls for. */}
      <Animated.View
        pointerEvents={phase === 'blackout' ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, styles.blackout, { opacity: blackoutOpacity }]}
      />
    </SafeAreaView>
  );
}

// ── Phase views ──────────────────────────────────────────────────────────────

function PromptView({
  onShare,
  onSkip,
  disabled,
}: {
  onShare: () => void;
  onSkip: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.promptInner}>
      <View style={styles.promptCopy}>
        <Text style={styles.titleSerif}>
          To show you what&apos;s happening nearby, we need your location.
        </Text>
        <Text style={styles.subtitle}>
          We only use it to show local content. Never shared, never stored beyond your session.
        </Text>
      </View>

      <View style={styles.promptActions}>
        <TouchableOpacity
          style={[styles.primaryButton, disabled && styles.buttonDisabled]}
          onPress={onShare}
          activeOpacity={0.85}
          disabled={disabled}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Share Location</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onSkip}
          activeOpacity={0.85}
          disabled={disabled}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FoundView() {
  return (
    <View style={styles.centerFill}>
      <Text style={styles.foundText}>We Found You</Text>
    </View>
  );
}

function RevealView({
  neighbourhood,
  onContinue,
}: {
  neighbourhood: string;
  onContinue: () => void;
}) {
  // Figma 2012:1797 spreads the title (upper third, ~33%) and the circular
  // Continue button (lower third, ~78%) apart rather than centring them as a
  // group. Flex spacers reproduce that distribution resolution-independently
  // (RN percentage vertical padding is parent-WIDTH-relative, so unusable
  // here). Ratios ~1.4 / 1.9 / 1.0 put the title at ~⅓ and the button at ~¾.
  return (
    <View style={styles.revealInner}>
      <View style={styles.revealSpacerTop} />
      <Text style={styles.revealTitle}>What&apos;s happening in {neighbourhood}?</Text>
      <View style={styles.revealSpacerMid} />
      <TouchableOpacity
        style={styles.revealCircleButton}
        onPress={onContinue}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <Text style={styles.revealCircleText}>Continue</Text>
      </TouchableOpacity>
      <View style={styles.revealSpacerBottom} />
    </View>
  );
}

// ── Styles — Figma 2012:1787 / 5108:8379 / 2012:1797 / 2012:1808 ─────────────

const INK = colors.neutral.ink;
const META = '#6F6E6A';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  navBar: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { flex: 1 },

  // Prompt
  promptInner: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  promptCopy: {
    marginTop: spacing['3xl'],
    gap: spacing.base,
  },
  titleSerif: {
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'Georgia',
    }),
    fontSize: 28,
    lineHeight: 34,
    color: INK,
    textAlign: 'center',
    fontWeight: typography.fontWeight.regular,
  },
  subtitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    lineHeight: 20,
    color: META,
    textAlign: 'center',
  },
  promptActions: {
    gap: spacing.md,
  },
  primaryButton: {
    height: 56,
    borderRadius: 36,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  secondaryButton: {
    height: 56,
    borderRadius: 36,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#D7D6D1',
  },
  secondaryButtonText: {
    color: INK,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  buttonDisabled: { opacity: 0.5 },

  // Found view — centered serif text only, very minimal per Figma.
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  foundText: {
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'Georgia',
    }),
    fontSize: 28,
    color: INK,
    textAlign: 'center',
    fontWeight: typography.fontWeight.regular,
  },

  // Reveal view — title in the upper third, big circular Continue button in
  // the lower third (Figma 2012:1797 distribution), via flex spacers below.
  revealInner: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  revealSpacerTop: { flex: 1.4 },
  revealSpacerMid: { flex: 1.9 },
  revealSpacerBottom: { flex: 1 },
  revealTitle: {
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'Georgia',
    }),
    fontSize: 28,
    lineHeight: 34,
    color: INK,
    textAlign: 'center',
    fontWeight: typography.fontWeight.regular,
  },
  revealCircleButton: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealCircleText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },

  blackout: { backgroundColor: INK },
});

export const ErrorBoundary = makeRouteErrorBoundary('location-onboarding');
