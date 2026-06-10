import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { MessagesProvider } from '@/context/MessagesContext';
import { motion } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

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
