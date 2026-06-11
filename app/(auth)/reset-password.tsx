import React, { useState } from 'react';
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
import { requestPasswordReset } from '@/services/auth.service';
import { isValidEmail } from '@/utils/validators';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

// Figma tokens — mirrors the Sign Up / Login chrome (Figma 5013:10790)
const CHOCOLATE = '#2B2A27';
const META = '#5A5A5A';
const LINK_BLUE = '#367AFF';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address');
      return;
    }
    setEmailError(undefined);
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      // Always show the same success state regardless of whether the email
      // matched an account — Supabase returns success either way to avoid
      // leaking which addresses are registered.
      setSent(true);
    } catch (e: unknown) {
      // Real failures (network down, malformed payload) still show through.
      setEmailError(e instanceof Error ? e.message : 'Could not send reset link.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => router.back()}
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
                {sent ? 'Check your inbox' : 'Reset your password'}
              </Text>
              <Text style={styles.subtitle}>
                {sent
                  ? `If an account exists for ${email.trim()}, a reset link is on its way. Tap the link in the email to set a new password.`
                  : 'Enter the email tied to your account and we’ll send you a link to set a new password.'}
              </Text>
            </View>

            {!sent && (
              <View style={styles.form}>
                <AuthField
                  label="Email"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (emailError) setEmailError(undefined);
                  }}
                  placeholder="your@email.com"
                  keyboardType="email-address"
                  autoComplete="email"
                  error={emailError}
                />
                <AuthPrimaryButton
                  label="Send reset link"
                  onPress={handleSubmit}
                  isLoading={submitting}
                />
              </View>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerPrompt}>
                {sent ? 'Done already? ' : 'Remembered it? '}
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

export const ErrorBoundary = makeRouteErrorBoundary('auth-reset-password');
