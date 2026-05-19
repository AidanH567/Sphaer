import { useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthContext } from '@/context/AuthContext';
import { BottomNav } from '@/components/ui/BottomNav';
import { CreateMenuSheet } from '@/components/ui/CreateMenuSheet';
import { colors } from '@/constants/theme';

export default function TabsLayout() {
  const { session, isLoading } = useAuthContext();
  const [createMenuVisible, setCreateMenuVisible] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.black} />
      </View>
    );
  }

  if (!session && !__DEV__) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}
      >
        <Tabs.Screen name="feed" />
        <Tabs.Screen name="circles" />
        <Tabs.Screen name="create" />
        <Tabs.Screen name="messages" />
        <Tabs.Screen name="profile" />
      </Tabs>

      <BottomNav onCreatePress={() => setCreateMenuVisible(true)} />

      <CreateMenuSheet
        visible={createMenuVisible}
        onClose={() => setCreateMenuVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
});
