import { useEffect, useState } from 'react';
import { Tabs, Redirect, usePathname } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthContext } from '@/context/AuthContext';
import { isDeepLinkablePath, stashPendingDeepLink } from '@/lib/linking';
import { BottomNav } from '@/components/ui/BottomNav';
import { CreateMenuSheet } from '@/components/ui/CreateMenuSheet';
import { colors } from '@/constants/theme';

export default function TabsLayout() {
  const { session, isLoading } = useAuthContext();
  const pathname = usePathname();
  const [createMenuVisible, setCreateMenuVisible] = useState(false);

  // The signed-out redirect below stomps cold-start deep links into this
  // group (sphaer://circles/abc → bounced to (auth), target lost). Stash
  // the target first; the PendingDeepLinkGate in app/_layout replays it
  // after sign-in. Mirrors the redirect condition — in __DEV__ there is
  // no redirect, so nothing needs recovering.
  const stompingDeepLink = !isLoading && !session && !__DEV__;
  useEffect(() => {
    if (stompingDeepLink && isDeepLinkablePath(pathname)) {
      stashPendingDeepLink(pathname);
    }
  }, [stompingDeepLink, pathname]);

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
        {/* Only `feed` is declared: it's the lone child with its own
            _layout, so it's the only flat route name in this navigator —
            and declaring it first pins it as the initial tab. The other
            groups (circles/create/messages/profile) have no _layout, so
            their children register as flat routes (`circles/index`,
            `messages/[id]`, …) automatically; declaring the bare directory
            names here just logs "No route named X exists" and does nothing.
            The visible tab bar is the custom BottomNav below, so screen
            order beyond the initial route is irrelevant. */}
        <Tabs.Screen name="feed" />
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
