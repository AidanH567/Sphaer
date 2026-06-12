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
import {
  AuthField,
  AuthPrimaryButton,
  FormErrorText,
  GoogleButton,
  OrDivider,
} from '@/components/auth/AuthControls';
import { isInvalidCredentialsError } from '@/utils/auth-errors';
import { colors, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { signInWithGoogle } from '@/services/auth.service';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

// Figma tokens (Sign Up Flow Screen 1.1 — login is restyled to match)
const CHOCOLATE = colors.neutral.chocolate;
const META = colors.neutral.neutral600;
const LINK_BLUE = '#367AFF';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  // Non-field submit failures, rendered inline — Alert.alert is a no-op on
  // react-native-web, so alerting here left web users with a silently dead
  // Log in button on bad credentials.
  const [formError, setFormError] = useState<string | null>(null);

  async function handleLogin() {
    setFormError(null);
    const next: typeof errors = {};
    if (!email) next.email = 'Enter your email';
    if (!password) next.password = 'Enter your password';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    try {
      await signIn(email, password);
    } catch (e: unknown) {
      if (isInvalidCredentialsError(e)) {
        setFormError('Email or password is incorrect.');
      } else {
        setFormError(
          e instanceof Error ? e.message : 'Something went wrong — please try again.'
        );
      }
    }
  }

  async function handleGoogle() {
    try {
      await signInWithGoogle();
      // Web: browser navigates away to Google and returns with a session
      // — (auth) layout redirects to /(tabs)/feed automatically. Native:
      // explicit replace after the in-app browser closes.
      if (Platform.OS !== 'web') {
        router.replace('/(tabs)/feed');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Google sign-in failed.';
      if (!message.toLowerCase().includes('cancelled')) {
        setFormError(message);
      }
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Close (X) — top right */}
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
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Log in to your account</Text>
            </View>

            <View style={styles.form}>
              <AuthField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoComplete="email"
                error={errors.email}
              />
              <AuthField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                secureTextEntry
                autoComplete="password"
                error={errors.password}
              />

              <TouchableOpacity
                style={styles.forgotWrap}
                onPress={() => router.push('/(auth)/reset-password' as never)}
                accessibilityRole="link"
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              <FormErrorText message={formError} />
              <AuthPrimaryButton label="Log in" onPress={handleLogin} isLoading={isLoading} />
            </View>

            <View style={styles.social}>
              <OrDivider />
              <GoogleButton onPress={handleGoogle} />
              <Text style={styles.signupPrompt}>
                Don’t have an account?{' '}
                <Text
                  style={styles.signupLink}
                  onPress={() => router.replace('/(auth)/signup')}
                  accessibilityRole="link"
                >
                  Sign up
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
    color: META,
    textAlign: 'center',
  },

  form: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    gap: 16,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: CHOCOLATE,
    textDecorationLine: 'underline',
  },

  social: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignItems: 'center',
    gap: 20,
  },
  signupPrompt: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: META,
    textAlign: 'center',
  },
  signupLink: {
    color: LINK_BLUE,
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('auth-login');
