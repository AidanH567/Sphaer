import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { SphaerIcon } from '@/components/SphaerLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors, typography, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { isValidEmail, isValidPassword, isValidUsername } from '@/utils/validators';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, isLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; email?: string; password?: string }>({});

  function validate() {
    const newErrors: typeof errors = {};
    if (!isValidUsername(username)) newErrors.username = 'Username must be 3–30 chars, letters/numbers/underscore only';
    if (!isValidEmail(email)) newErrors.email = 'Enter a valid email address';
    if (!isValidPassword(password)) newErrors.password = 'Password must be at least 8 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSignUp() {
    if (!validate()) return;
    try {
      await signUp(email, password, username);
      router.replace('/(auth)/onboarding');
    } catch (e: unknown) {
      Alert.alert('Sign up failed', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoWrap}>
            <SphaerIcon size={68} />
          </View>

          <View style={styles.heading}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Join your neighborhood.</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Name"
              icon="person-outline"
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.username}
            />
            <Input
              label="Email"
              icon="mail-outline"
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              error={errors.email}
            />
            <Input
              label="Password"
              icon="lock-closed-outline"
              placeholder="Min. 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowPassword((v) => !v)}
              error={errors.password}
            />
          </View>

          <Button
            label="Sign up"
            onPress={handleSignUp}
            isLoading={isLoading}
            style={styles.submitButton}
          />

          <Text style={styles.loginPrompt}>
            Already have an account?{' '}
            <Text style={styles.loginLink} onPress={() => router.replace('/(auth)/login')}>
              Log in
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  back: { padding: spacing.base },
  keyboardView: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
  },
  logoWrap: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  heading: { alignItems: 'center', marginBottom: spacing['2xl'], gap: spacing.xs },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  form: { gap: spacing.base, marginBottom: spacing.xl },
  submitButton: { marginBottom: spacing.lg },
  loginPrompt: {
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  loginLink: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
    textDecorationLine: 'underline',
  },
});
