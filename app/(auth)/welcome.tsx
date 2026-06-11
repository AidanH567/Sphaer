import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthContext } from '@/context/AuthContext';
import { colors, motion, typography } from '@/constants/theme';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

/**
 * "Welcome {name}" post-signup interstitial — Figma 5013:10915
 * ("We Found You"). Shows for ~1.5s right after a successful email
 * signup, then routes on to onboarding. Matches the serif treatment of
 * the tagline / location-reveal screens: Test Martina Plantijn 26px on
 * white, the name in Medium.
 *
 * Name precedence: route param (signup passes the form value, available
 * before any network round-trip) → auth user_metadata.display_name →
 * profiles row. All empty → the screen greets with a bare "Welcome".
 *
 * Tap anywhere to skip the dwell (HIG: never block input on animation).
 */
const DWELL_MS = 1600;

export default function WelcomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string }>();
  const { session, profile } = useAuthContext();

  const paramName = Array.isArray(params.name) ? params.name[0] : params.name;
  const meta = session?.user?.user_metadata as { display_name?: string } | undefined;
  const displayName = paramName || meta?.display_name || profile?.display_name || '';
  const firstName = displayName.trim().split(/\s+/)[0] ?? '';

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      fade.setValue(1);
      return;
    }
    Animated.timing(fade, {
      toValue: 1,
      duration: motion.duration.slow,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [fade, reduceMotion]);

  // Route exactly once — either the dwell timer or a skip-tap, whichever
  // fires first.
  const navigated = useRef(false);
  function continueToOnboarding() {
    if (navigated.current) return;
    navigated.current = true;
    router.replace('/(auth)/onboarding');
  }

  useEffect(() => {
    const timer = setTimeout(continueToOnboarding, DWELL_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run-once dwell timer
  }, []);

  return (
    <Pressable style={styles.container} onPress={continueToOnboarding}>
      <Animated.Text
        style={[styles.welcome, { opacity: fade }]}
        accessibilityRole="header"
      >
        Welcome{firstName ? ' ' : ''}
        {firstName ? <Animated.Text style={styles.name}>{firstName}</Animated.Text> : null}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcome: {
    fontFamily: typography.fontFamily.display,
    fontSize: 26,
    color: colors.neutral.ink,
    textAlign: 'center',
  },
  // Figma: the first name is Test Martina Plantijn Medium.
  name: {
    fontWeight: typography.fontWeight.medium,
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('auth-welcome');
