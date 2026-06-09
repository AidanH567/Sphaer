import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SphaerIcon } from '@/components/SphaerLogo';
import { Button } from '@/components/ui/Button';
import { colors, typography, spacing } from '@/constants/theme';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

const { height } = Dimensions.get('window');

export default function LandingScreen() {
  const router = useRouter();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoY = useRef(new Animated.Value(20)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(logoY, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 500, delay: 100, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(buttonsOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(buttonsY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Animated.View style={{ opacity: logoOpacity, transform: [{ translateY: logoY }] }}>
          <SphaerIcon size={90} />
        </Animated.View>

        <Animated.View style={[styles.taglineWrap, { opacity: taglineOpacity }]}>
          <Text style={styles.tagline}>
            Your City.{' '}
            <Text style={styles.taglineBold}>Your Sphaer.</Text>
          </Text>
        </Animated.View>
      </View>

      <Animated.View
        style={[styles.buttons, { opacity: buttonsOpacity, transform: [{ translateY: buttonsY }] }]}
      >
        <Button label="Get Started" onPress={() => router.push('/(auth)/signup')} variant="primary" />
        <Button label="Log In" onPress={() => router.push('/(auth)/login')} variant="secondary" />
      </Animated.View>

      <Text style={styles.version}>Version 1.0</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  taglineWrap: { alignItems: 'center' },
  // Figma node 2012:1683 — tagline at 26px, centred, Test Martina Plantijn
  // Regular for "Your City." with Medium for "Your Sphaer." emphasis.
  tagline: {
    fontFamily: typography.fontFamily.display,
    fontSize: 26,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  taglineBold: {
    fontWeight: typography.fontWeight.medium,
  },
  buttons: {
    gap: spacing.md,
  },
  version: {
    textAlign: 'center',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.lg,
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('auth-landing');
