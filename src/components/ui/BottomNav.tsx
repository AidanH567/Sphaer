import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SphaerIcon } from '@/components/SphaerLogo';
import { useAuthContext } from '@/context/AuthContext';
import { colors, spacing } from '@/constants/theme';

const ICON_SIZE = 24;
const AVATAR_SIZE = 28;

interface NavItem {
  route: string;
  segment: string; // used to detect active tab from pathname
}

const NAV_ITEMS: NavItem[] = [
  { route: '/(tabs)/feed',     segment: 'feed'     },
  { route: '/(tabs)/circles',  segment: 'circles'  },
  { route: '/(tabs)/create',   segment: 'create'   },
  { route: '/(tabs)/messages', segment: 'messages' },
  { route: '/(tabs)/profile',  segment: 'profile'  },
];

function renderIcon(segment: string, focused: boolean, avatarUrl?: string | null) {
  switch (segment) {
    case 'feed':
      return (
        <MaterialCommunityIcons
          name="binoculars"
          size={ICON_SIZE}
          color={focused ? colors.black : colors.text.tertiary}
        />
      );
    case 'circles':
      return (
        <SphaerIcon
          size={ICON_SIZE + 2}
          color={focused ? colors.black : colors.text.tertiary}
        />
      );
    case 'create':
      return (
        <Ionicons name="add" size={32} color={colors.black} />
      );
    case 'messages':
      return (
        <Ionicons
          name={focused ? 'chatbubble' : 'chatbubble-outline'}
          size={ICON_SIZE}
          color={focused ? colors.black : colors.text.tertiary}
        />
      );
    case 'profile':
      if (avatarUrl) {
        return (
          <View style={[styles.avatarRing, focused && styles.avatarRingActive]}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          </View>
        );
      }
      return (
        <View style={[styles.avatarPlaceholder, focused && styles.avatarPlaceholderActive]}>
          <Ionicons
            name="person"
            size={16}
            color={focused ? colors.white : colors.text.tertiary}
          />
        </View>
      );
    default:
      return null;
  }
}

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthContext();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || spacing.sm }]}>
      {NAV_ITEMS.map(({ route, segment }) => {
        const focused = pathname.includes(segment);

        return (
          <TouchableOpacity
            key={segment}
            style={styles.tab}
            onPress={() => router.push(route as any)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
          >
            {renderIcon(segment, focused, profile?.avatar_url)}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  avatarRingActive: {
    borderColor: colors.black,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  avatarPlaceholderActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
});
