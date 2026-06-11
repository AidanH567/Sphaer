import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SphaerIcon } from '@/components/SphaerLogo';
import { AuthPrimaryButton } from '@/components/auth/AuthControls';
import { colors, typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/services/auth.service';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

const CHOCOLATE = colors.neutral.chocolate;
const META = colors.neutral.neutral600;
const LINK_BLUE = '#367AFF';
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Email-confirmation interstitial — sits between signup and onboarding when
 * the Supabase project has email confirmation turned ON.
 *
 * Lifecycle:
 *   1. signup.tsx routes here with ?email=<typed email> when the
 *      supabase.auth.signUp() response had `data.session === null` (i.e.
 *      Supabase deferred session creation pending email click).
 *   2. The user opens the confirmation email and taps the link, which hits
 *      a Supabase verify URL that redirects back into the app with the
 *      session-bearing URL fragment.
 *   3. `detectSessionInUrl: true` in src/lib/supabase.ts parses the fragment
 *      and fires SIGNED_IN through onAuthStateChange.
 *   4. The subscription below catches that event and routes to onboarding.
 *
 * If confirmation is OFF in the dashboard, signup.tsx routes straight to
 * onboarding instead — this screen never mounts.
 */
export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const typedEmail = (Array.isArray(params.email) ? params.email[0] : params.email) ?? '';

  const [resendCountdown, setResendCountdown] = useState(0);
  const [resending, setResending] = useState(false);

  // Watch for the SIGNED_IN that follows the email click. When it arrives,
  // the user is now authenticated — show the "Welcome {name}" interstitial
  // (it reads the name from user_metadata and routes on to onboarding).
  // Replace so the back stack doesn't keep this screen reachable.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace('/(auth)/welcome' as never);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  // Cooldown timer for the resend button — prevents the user from
  // hammering Supabase if delivery is slow.
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  async function handleResend() {
    if (!typedEmail || resending || resendCountdown > 0) return;
    setResending(true);
    try {
      // Supabase's `resend` helper re-sends the same confirmation email.
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: typedEmail,
      });
      if (error) throw error;
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
    } catch (e: unknown) {
      Alert.alert(
        'Could not resend',
        e instanceof Error ? e.message : 'Please try again in a minute.',
      );
    } finally {
      setResending(false);
    }
  }

  async function handleBackToLogin() {
    // The signup call left a pending unverified-user record on Supabase;
    // signOut() clears any local session bits and bounces them back to the
    // landing flow cleanly.
    try {
      await signOut();
    } catch {
      // tolerated — no session is normal here
    }
    router.replace('/(auth)');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={handleBackToLogin}
          style={styles.closeButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back to login"
        >
          <Ionicons name="close" size={24} color={CHOCOLATE} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.main}>
            <View style={styles.hero}>
              <SphaerIcon size={78} />
              <Text style={styles.title}>Confirm your email</Text>
              <Text style={styles.subtitle}>
                {typedEmail
                  ? `We sent a confirmation link to ${typedEmail}. Tap it to finish creating your Sphaer account — we’ll bring you back automatically.`
                  : 'We sent a confirmation link to the email you signed up with. Tap it to finish creating your Sphaer account — we’ll bring you back automatically.'}
              </Text>
            </View>

            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={META} />
              <Text style={styles.statusText}>Waiting for confirmation…</Text>
            </View>

            <View style={styles.form}>
              <AuthPrimaryButton
                label={
                  resendCountdown > 0
                    ? `Resend email in ${resendCountdown}s`
                    : resending
                    ? 'Sending…'
                    : 'Resend email'
                }
                onPress={handleResend}
                isLoading={resending}
                disabled={resending || resendCountdown > 0 || !typedEmail}
              />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerPrompt}>
                Wrong email?{' '}
                <Text
                  style={styles.footerLink}
                  onPress={handleBackToLogin}
                  accessibilityRole="link"
                >
                  Start over
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const MAX_CONTENT_WIDTH = 358;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  navBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  keyboardView: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  main: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },

  hero: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 26,
    lineHeight: 28,
    color: CHOCOLATE,
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    lineHeight: 20,
    color: META,
    textAlign: 'center',
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: META,
  },

  form: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    gap: 16,
  },

  footer: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignItems: 'center',
  },
  footerPrompt: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: META,
    textAlign: 'center',
  },
  footerLink: {
    color: LINK_BLUE,
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('auth-verify-email');
