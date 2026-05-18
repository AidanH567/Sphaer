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
    return <Redirect href="/(tabs)/feed" />;
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
