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

// Figma tokens (Sign Up Flow Screen 1.1 — login is restyled to match)
const CHOCOLATE = '#2B2A27';
const META = '#5A5A5A';
const LINK_BLUE = '#367AFF';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    try {
      await signIn(email, password);
    } catch (e: unknown) {
      Alert.alert('Login failed', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  function handleGoogle() {
    console.log('[Login] continue with google');
    Alert.alert('Coming soon', 'Continue with Google is not wired up yet.');
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
              />
              <AuthField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                secureTextEntry
                autoComplete="password"
              />

              <TouchableOpacity
                style={styles.forgotWrap}
                onPress={() => Alert.alert('Coming soon', 'Password reset is not wired up yet.')}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              <AuthPrimaryButton label="Log in" onPress={handleLogin} isLoading={isLoading} />
            </View>

            <View style={styles.social}>
              <OrDivider />
              <GoogleButton onPress={handleGoogle} />
              <Text style={styles.signupPrompt}>
                Don’t have an account?{' '}
                <Text style={styles.signupLink} onPress={() => router.replace('/(auth)/signup')}>
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
