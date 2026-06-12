import '../global.css';
import { useEffect, useRef } from 'react';
import { Stack, usePathname, useRouter, useSegments, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuthContext } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { MessagesProvider } from '@/context/MessagesContext';
import { consumePendingDeepLink, isDeepLinkablePath } from '@/lib/linking';
import { motion } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

/**
 * Replays a deep link that was stashed while the user was signed out.
 *
 * expo-router itself turns cold-start / warm URLs into routes; the one
 * thing it can't survive is the (tabs) auth gate redirecting to (auth)
 * before a session exists. (tabs)/_layout stashes the target, and this
 * gate consumes it the moment the user lands anywhere inside (tabs).
 * "Inside (tabs)" is deliberately the trigger: every sign-in path ends
 * with a replace into the group — the (auth) layout's redirect to
 * /(tabs)/feed, login.tsx's explicit replace, /location's post-onboarding
 * replace — so consuming here runs strictly after those navigations and
 * can't be stomped by them or double-navigate.
 *
 * The converse also holds: when expo-router already routed a deep link
 * natively (signed-in cold start to /circles/x), the gate consumes any
 * stale stash but does NOT navigate, so the fresh link is never stomped.
 */
function PendingDeepLinkGate() {
  const { session } = useAuthContext();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const hasSession = Boolean(session);
  const inTabs = segments[0] === '(tabs)';

  // Latest pathname, readable from the consume effect without being one of
  // its triggers — consuming should fire on tabs-entry / sign-in
  // transitions, not re-hit storage on every in-tabs navigation. Synced in
  // its own effect (declared first, so it runs before the consumer below
  // whenever both fire in one commit).
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!inTabs || !hasSession) return;
    let alive = true;
    consumePendingDeepLink().then((path) => {
      if (!alive || !path) return;
      // If the user is already sitting ON a deep-linkable path, expo-router
      // delivered a fresh link natively (signed-in cold start) — the stash
      // is stale by definition. consumePendingDeepLink() above already
      // cleared it; replaying would stomp the fresh target or pointlessly
      // remount the same screen. Never double-navigate.
      if (isDeepLinkablePath(pathnameRef.current)) return;
      // Cast: the stash is allowlist-validated in linking.ts; typed routes
      // can't type a runtime string.
      router.replace(path as Href);
    });
    return () => {
      alive = false;
    };
  }, [inTabs, hasSession, router]);

  return null;
}

export default function RootLayout() {
  // ─── Custom fonts ────────────────────────────────────────────────────────────
  // Once you have the font files, place them in assets/fonts/ and uncomment:
  //
  // import { useFonts } from 'expo-font';
  //
  // const [fontsLoaded, fontError] = useFonts({
  //   'TestMartinaPlantijn-Regular': require('../assets/fonts/TestMartinaPlantijn-Regular.otf'),
  //   'TestMartinaPlantijn-Italic':  require('../assets/fonts/TestMartinaPlantijn-Italic.otf'),
  // });
  //
  // Then replace the useEffect below with:
  // useEffect(() => {
  //   if (fontsLoaded || fontError) SplashScreen.hideAsync();
  // }, [fontsLoaded, fontError]);
  //
  // And add before the return:
  // if (!fontsLoaded && !fontError) return null;
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppProvider>
          <MessagesProvider>
            <StatusBar style="dark" />
            <PendingDeepLinkGate />
            {/*
              Stack-level screenOptions = the swift defaults for every push:
              slide_from_right matches iOS/Android conventions, and
              animationDuration pulls from the shared motion token so the
              entire app changes pace from one place.

              Per-screen overrides:
              - location onboarding slides up from the bottom — semantically
                modal, signals "complete this before continuing"
              - (auth) / (tabs) are group entries; they keep the same
                slide direction, but the initial mount is animationless
                by default (RN never animates the very first screen)
            */}
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                animationDuration: motion.duration.standard,
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="event/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="user/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="ticket/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="legal/privacy" options={{ presentation: 'card' }} />
              <Stack.Screen name="legal/terms" options={{ presentation: 'card' }} />
              <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
              <Stack.Screen
                name="location"
                options={{
                  presentation: 'card',
                  gestureEnabled: false,
                  animation: 'slide_from_bottom',
                }}
              />
            </Stack>
          </MessagesProvider>
        </AppProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
