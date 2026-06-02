import { Stack, Redirect } from 'expo-router';
import { useAuthContext } from '@/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '@/constants/theme';

export default function AuthLayout() {
  const { session, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
        <ActivityIndicator color={colors.black} />
      </View>
    );
  }

  if (session) {
    // Onboarded users skip the location flow via the AsyncStorage flag
    // inside /location itself — sending everyone there is simplest and
    // saves us a duplicate flag check at the layout level.
    // `as never` because expo-router's generated route types are stale
    // until the dev server regenerates after we add the new file.
    return <Redirect href={'/location' as never} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
