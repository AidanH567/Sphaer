import { Stack, Redirect, useSegments } from 'expo-router';
import { useAuthContext } from '@/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { colors, motion } from '@/constants/theme';

export default function AuthLayout() {
  const { session, profile, isLoading } = useAuthContext();
  const segments = useSegments();
  // True when the active route within this (auth) group is `onboarding`.
  // Email signup explicitly navigates here after `signUp()` resolves; without
  // this guard the session-redirect below would unmount the form before it
  // ever painted, and the user would land on /location with only their
  // display_name set (no bio, about, disciplines, location, or experiences).
  const onOnboarding = segments[segments.length - 1] === 'onboarding';

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
        <ActivityIndicator color={colors.black} />
      </View>
    );
  }

  if (session) {
    // Returning users who already completed onboarding skip /location
    // entirely. The previous behaviour sent every session through the
    // prompt and relied on an AsyncStorage flag inside /location to bail
    // — but that flag was local to one install, so reinstalls / second
    // devices / web-after-native silently re-routed users through the
    // location screen. profile.onboarding_completed is the server-side
    // truth that survives any of that.
    if (profile?.onboarding_completed) {
      return <Redirect href="/(tabs)/feed" />;
    }
    // The first-time email signup flow is signup → onboarding form →
    // /location. Without this fall-through, the redirect below intercepts
    // step 2 and the user never sees the form.
    if (!onOnboarding) {
      // First-timers (or anyone whose flag isn't set yet) get the flow.
      // `as never` because expo-router's generated route types are stale
      // until the dev server regenerates after we add the new file.
      return <Redirect href={'/location' as never} />;
    }
    // Mid-onboarding — fall through to the Stack below.
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: motion.duration.standard,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
