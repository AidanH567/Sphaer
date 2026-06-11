import { Stack, Redirect, useSegments } from 'expo-router';
import { useAuthContext } from '@/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { colors, motion } from '@/constants/theme';

export default function AuthLayout() {
  const { session, profile, isLoading } = useAuthContext();
  const segments = useSegments();
  // Routes inside (auth) that must fall through even when a session is
  // present. `onboarding` is the post-email-signup form (covered above).
  // `update-password` is the password-reset deep-link landing — Supabase
  // populates a temporary recovery session by the time we mount, and we'd
  // otherwise bounce the user to /location or /feed before they could set
  // a new password.
  // Cast to plain string because expo-router's generated route literal type
  // hasn't picked up `update-password` / `verify-email` yet — the dev server
  // regenerates it on the next reload after the file lands.
  const lastSeg = String(segments[segments.length - 1] ?? '');
  const onOnboarding = lastSeg === 'onboarding';
  const onUpdatePassword = lastSeg === 'update-password';
  // verify-email mounts WITHOUT a session — by design (the user has signed
  // up but hasn't confirmed yet). When the email click finally lands and
  // SIGNED_IN fires, the screen itself navigates to onboarding. So the
  // fall-through here exists purely for the brief moment the verify-email
  // screen is active and a session might or might not exist (Supabase's
  // resend helper might briefly populate one).
  const onVerifyEmail = lastSeg === 'verify-email';
  // welcome is the ~1.5s post-signup interstitial (Figma 5013:10915) —
  // it mounts WITH a fresh session and routes itself to onboarding, so it
  // needs the same fall-through or the redirect below would cut it short.
  const onWelcome = lastSeg === 'welcome';

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
    // step 2 and the user never sees the form. update-password and
    // verify-email are also mid-flow auth screens with the same intercept
    // problem — same fall-through.
    if (!onOnboarding && !onUpdatePassword && !onVerifyEmail && !onWelcome) {
      // First-timers (or anyone whose flag isn't set yet) get the flow.
      // `as never` because expo-router's generated route types are stale
      // until the dev server regenerates after we add the new file.
      return <Redirect href={'/location' as never} />;
    }
    // Mid-onboarding or mid-password-recovery — fall through.
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
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="update-password" />
      <Stack.Screen name="verify-email" />
      {/* Cinematic interstitial — fade, not the default slide. */}
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="intro" />
    </Stack>
  );
}
