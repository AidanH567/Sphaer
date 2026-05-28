import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SphaerIcon } from '@/components/SphaerLogo';
import {
  AuthField,
  AuthPrimaryButton,
  GoogleButton,
  OrDivider,
} from '@/components/auth/AuthControls';
import { colors, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { signInWithGoogle } from '@/services/auth.service';
import { isValidEmail, isValidPassword } from '@/utils/validators';

// Figma tokens — Sign Up Flow Screen 1.1 (node 5013:10790)
const CHOCOLATE = '#2B2A27';
const META = '#5A5A5A';
const LINK_BLUE = '#367AFF';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, isLoading } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ displayName?: string; email?: string; password?: string }>({});

  function validate(): boolean {
    const next: typeof errors = {};
    const trimmedName = displayName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      next.displayName = 'Name must be 2–50 characters';
    }
    if (!isValidEmail(email)) next.email = 'Enter a valid email address';
    if (!isValidPassword(password)) next.password = 'Password must be at least 8 characters';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSignUp() {
    if (!validate()) return;
    try {
      await signUp(email, password, displayName.trim());
      router.replace('/(auth)/onboarding');
    } catch (e: unknown) {
      Alert.alert('Sign up failed', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function handleGoogle() {
    try {
      await signInWithGoogle();
      // Web: the browser navigates away to Google and returns to the app
      // with a session already populated by Supabase — no explicit route
      // change needed (AuthProvider's onAuthStateChange + (auth) layout
      // redirect handle landing on /(tabs)/feed).
      // Native: signInWithGoogle resolves once the session is set; the
      // same listener flips us to feed.
      // OAuth users skip onboarding (per design) — they land straight on
      // the feed via the (auth) layout's session redirect.
      if (Platform.OS !== 'web') {
        router.replace('/(tabs)/feed');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Google sign-in failed.';
      // Don't show an alert for user-cancelled sign-in — that's not an error.
      if (!message.toLowerCase().includes('cancelled')) {
        Alert.alert('Google sign-in failed', message);
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
          {/* Centered main content */}
          <View style={styles.main}>
            <View style={styles.hero}>
              <SphaerIcon size={78} />
              <Text style={styles.title}>Create Your Account</Text>
              <Text style={styles.subtitle}>Join your neighborhood</Text>
            </View>

            <View style={styles.form}>
              <AuthField
                label="Name"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                autoCapitalize="words"
                autoComplete="name"
                error={errors.displayName}
              />
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
                placeholder="Min. 8 characters"
                secureTextEntry
                autoComplete="password-new"
                error={errors.password}
              />
              <AuthPrimaryButton label="Sign up" onPress={handleSignUp} isLoading={isLoading} />
            </View>

            <View style={styles.social}>
              <OrDivider />
              <GoogleButton onPress={handleGoogle} />
              <Text style={styles.signinPrompt}>
                Already have an account?{' '}
                <Text style={styles.signinLink} onPress={() => router.replace('/(auth)/login')}>
                  Sign in
                </Text>
              </Text>
            </View>
          </View>

          {/* Legal — fixed at the bottom of the scroll content */}
          <View style={styles.legal}>
            <Text style={styles.legalText}>
              By continuing, you agree to Sphaer’s{'\n'}
              <Text style={styles.legalLink} onPress={() => Linking.openURL('https://sphaer.app/terms')}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text style={styles.legalLink} onPress={() => Linking.openURL('https://sphaer.app/privacy')}>
                Privacy Policy
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const MAX_CONTENT_WIDTH = 358;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  // Close (X) row
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
    paddingBottom: 24,
  },

  // Main centered block — uses flex:1 so the centered content fills the
  // available height; the legal block sits below it at the bottom of scroll.
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

  social: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignItems: 'center',
    gap: 20,
  },
  signinPrompt: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: META,
    textAlign: 'center',
  },
  signinLink: {
    color: LINK_BLUE,
  },

  // Legal text — pinned to the bottom of the scroll
  legal: {
    paddingTop: 32,
    paddingBottom: 8,
    alignItems: 'center',
  },
  legalText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: META,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    color: CHOCOLATE,
    textDecorationLine: 'underline',
  },
});
