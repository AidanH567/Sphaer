import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';

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
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="event/[id]"
              options={{ presentation: 'card', headerShown: false }}
            />
            <Stack.Screen
              name="user/[id]"
              options={{ presentation: 'card', headerShown: false }}
            />
          </Stack>
        </AppProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
