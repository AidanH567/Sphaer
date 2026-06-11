import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SphaerIcon } from '@/components/SphaerLogo';
import { AuthField, AuthPrimaryButton } from '@/components/auth/AuthControls';
import { colors, typography } from '@/constants/theme';
import { signOut, updatePassword } from '@/services/auth.service';
import { supabase } from '@/lib/supabase';
import { isValidPassword } from '@/utils/validators';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

const CHOCOLATE = '#2B2A27';
const META = '#5A5A5A';
const LINK_BLUE = '#367AFF';

/**
 * Landing screen for the password-reset email deep link.
 *
 * How the user arrives here:
 *   - Web: Supabase redirects to `<origin>/update-password#access_token=...&type=recovery`.
 *     `detectSessionInUrl: true` (configured in src/lib/supabase.ts) parses the
 *     hash, stores a temporary session, fires SIGNED_IN, and clears the URL.
 *   - Native: Supabase redirects to `sphaer://auth/update-password` with the
 *     same fragment. The deep-link handler in supabase-js handles the rest.
 *
 * Either way, by the time this component mounts we may already have a session
 * (the recovery one). After the user sets a new password we explicitly sign
 * them out so the recovery session isn't persisted — they then log in
 * normally with the new password. This is intentional: silently signing the
 * user in via a recovery flow is surprising and means a stolen email link
 * grants persistent access.
 */
export default function UpdatePasswordScreen() {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  // Wait briefly for supabase-js to parse the hash on web / deep link on
  // native. If after one tick there's still no session, the user almost
  // certainly hit this URL directly without a valid recovery token — show
  // the "link expired" state instead of an inscrutable error.
  useEffect(() => {
    let active = true;

    async function check() {
      // First check the current session.
      const { data: initial } = await supabase.auth.getSession();
      if (initial?.session) {
        if (active) setHasRecoverySession(true);
        return;
      }
      // If empty on first read, give the SDK a single auth-event window to
      // hydrate from the URL hash (web) or deep link (native) before we
      // give up.
      const sub = supabase.auth.onAuthStateChange((event, sess) => {
        if (!active) return;
        if (sess) {
          setHasRecoverySession(true);
          sub.data.subscription.unsubscribe();
        }
      });
      // After ~1.5s, if nothing populated, assume there's no token.
      setTimeout(() => {
        if (!active) return;
        if (hasRecoverySession === null) {
          setHasRecoverySession(false);
          sub.data.subscription.unsubscribe();
        }
      }, 1500);
    }
    check();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Run-once on mount; we intentionally don't re-run when
    // hasRecoverySession flips because the effect itself is what flips it.
    // Adding it as a dep would cause an infinite loop.
  }, []);

  function validate(): boolean {
    let ok = true;
    if (!isValidPassword(password)) {
      setPasswordError('Password must be at least 8 characters');
      ok = false;
    } else {
      setPasswordError(undefined);
    }
    if (confirm !== password) {
      setConfirmError('Passwords do not match');
      ok = false;
    } else {
      setConfirmError(undefined);
    }
    return ok;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await updatePassword(password);
      // Sign out the recovery session — see comment above.
      try {
        await signOut();
      } catch {
        // tolerated
      }
      setDone(true);
    } catch (e: unknown) {
      setPasswordError(e instanceof Error ? e.message : 'Could not update password.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => router.replace('/(auth)/login')}
          style={styles.closeButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Close"
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
              <Text style={styles.title}>
                {done
                  ? 'Password updated'
                  : hasRecoverySession === false
                  ? 'Link expired'
                  : 'Set a new password'}
              </Text>
              <Text style={styles.subtitle}>
                {done
                  ? 'You can now log in with your new password.'
                  : hasRecoverySession === false
                  ? 'Reset links expire after one hour. Request a new one to try again.'
                  : 'Pick a new password for your Sphaer account. We recommend at least 12 characters.'}
              </Text>
            </View>

            {!done && hasRecoverySession === true && (
              <View style={styles.form}>
                <AuthField
                  label="New password"
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (passwordError) setPasswordError(undefined);
                  }}
                  placeholder="Min. 8 characters"
                  secureTextEntry
                  autoComplete="password-new"
                  error={passwordError}
                />
                <AuthField
                  label="Confirm password"
                  value={confirm}
                  onChangeText={(t) => {
                    setConfirm(t);
                    if (confirmError) setConfirmError(undefined);
                  }}
                  placeholder="Re-enter your password"
                  secureTextEntry
                  autoComplete="password-new"
                  error={confirmError}
                />
                <AuthPrimaryButton
                  label="Update password"
                  onPress={handleSubmit}
                  isLoading={submitting}
                />
              </View>
            )}

            {(done || hasRecoverySession === false) && (
              <View style={styles.form}>
                <AuthPrimaryButton
                  label={done ? 'Back to log in' : 'Request new link'}
                  onPress={() =>
                    done
                      ? router.replace('/(auth)/login')
                      : router.replace('/(auth)/reset-password' as never)
                  }
                />
              </View>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerPrompt}>
                <Text
                  style={styles.footerLink}
                  onPress={() => router.replace('/(auth)/login')}
                  accessibilityRole="link"
                >
                  Back to log in
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

export const ErrorBoundary = makeRouteErrorBoundary('auth-update-password');
