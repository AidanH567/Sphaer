import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, usePathname, type Href } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SphaerIcon } from '@/components/SphaerLogo';
import { useAuthContext } from '@/context/AuthContext';
import { useMessagesContext } from '@/context/MessagesContext';
import { colors, spacing, typography } from '@/constants/theme';

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

interface ProfileBits {
  avatarUrl?: string | null;
  displayName?: string | null;
  email?: string | null;
}

function renderIcon(
  segment: string,
  focused: boolean,
  profileBits: ProfileBits,
  messagesUnread: number,
) {
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
          size={ICON_SIZE + 10}
          color={focused ? colors.black : colors.text.tertiary}
        />
      );
    case 'create':
      return (
        <Ionicons name="add" size={32} color={colors.black} />
      );
    case 'messages':
      return (
        <View style={styles.iconWithBadge}>
          <Ionicons
            name={focused ? 'chatbubble' : 'chatbubble-outline'}
            size={ICON_SIZE}
            color={focused ? colors.black : colors.text.tertiary}
          />
          {messagesUnread > 0 && (
            <View
              style={styles.badge}
              accessibilityLabel={`${messagesUnread} unread message${messagesUnread === 1 ? '' : 's'}`}
            >
              <Text style={styles.badgeText}>
                {messagesUnread > 9 ? '9+' : String(messagesUnread)}
              </Text>
            </View>
          )}
        </View>
      );
    case 'profile': {
      const { avatarUrl, displayName, email } = profileBits;
      if (avatarUrl) {
        return (
          <View style={[styles.avatarRing, focused && styles.avatarRingActive]}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          </View>
        );
      }
      const initials = getInitials(displayName, email);
      if (initials) {
        return (
          <View style={[styles.avatarPlaceholder, focused && styles.avatarPlaceholderActive]}>
            <Text style={[styles.initialsText, focused && styles.initialsTextActive]}>
              {initials}
            </Text>
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
    }
    default:
      return null;
  }
}

/**
 * Derive 1–2 character initials from a display name; fall back to the email
 * local-part. Returns '' if nothing usable — caller falls back to a person icon.
 */
function getInitials(displayName?: string | null, email?: string | null): string {
  const name = displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  const local = email?.split('@')[0]?.trim();
  if (local && local.length > 0) {
    return local.slice(0, Math.min(2, local.length)).toUpperCase();
  }
  return '';
}

interface BottomNavProps {
  onCreatePress: () => void;
}

export function BottomNav({ onCreatePress }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuthContext();
  const { totalUnread } = useMessagesContext();

  const profileBits: ProfileBits = {
    avatarUrl: profile?.avatar_url,
    displayName: profile?.display_name,
    email: user?.email,
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || spacing.sm }]}>
      {NAV_ITEMS.map(({ route, segment }) => {
        const focused = pathname.includes(segment);

        return (
          <TouchableOpacity
            key={segment}
            style={styles.tab}
            onPress={
              segment === 'create' ? onCreatePress : () => router.push(route as Href)
            }
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
          >
            {renderIcon(segment, focused, profileBits, totalUnread)}
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
  initialsText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
  },
  initialsTextActive: {
    color: colors.white,
  },

  // Messages tab unread badge — Instagram-style coral pill positioned at
  // the top-right of the chat icon. Caps at "9+" to keep the pill compact.
  iconWithBadge: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.badge.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
    color: colors.badge.redText,
    lineHeight: 13,
  },
});
