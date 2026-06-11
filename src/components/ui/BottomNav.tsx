import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, usePathname, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ExploreGlyph,
  CirclesGlyph,
  PlusGlyph,
  ChatsGlyph,
} from '@/components/ui/icons/NavGlyphs';
import { useAuthContext } from '@/context/AuthContext';
import { useMessagesContext } from '@/context/MessagesContext';
import { colors, spacing, typography, radius } from '@/constants/theme';

// Figma menu-bar (6279:10543): 40px circular items, edge inset 21,
// pt 12 / pb 8 above the home-indicator area. Glyphs 26px (rings 24×17).
const ITEM_SIZE = 40;
const GLYPH_SIZE = 26;
// Figma: inactive profile ring is a one-off grey not in the Neutral ramp.
const PROFILE_RING_INACTIVE = '#8F8F8F';

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

// Screen-reader names for the icon-only tab items.
const TAB_LABELS: Record<string, string> = {
  feed: 'Feed',
  circles: 'Circles',
  create: 'Create',
  messages: 'Messages',
  profile: 'Profile',
};

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
  // Figma active state: glyph flips to white on the filled chocolate circle.
  const glyphColor = focused ? colors.white : colors.neutral.chocolate;

  switch (segment) {
    case 'feed':
      return <ExploreGlyph size={GLYPH_SIZE} color={glyphColor} />;
    case 'circles':
      return <CirclesGlyph size={24} color={glyphColor} />;
    case 'create':
      return <PlusGlyph size={GLYPH_SIZE} color={glyphColor} />;
    case 'messages':
      return (
        <View style={styles.iconWithBadge}>
          <ChatsGlyph size={GLYPH_SIZE} color={glyphColor} />
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
        return <Image source={{ uri: avatarUrl }} style={styles.avatar} />;
      }
      const initials = getInitials(displayName, email);
      return <Text style={styles.initialsText}>{initials || '•'}</Text>;
    }
    default:
      return null;
  }
}

/**
 * Derive 1–2 character initials from a display name; fall back to the email
 * local-part. Returns '' if nothing usable — caller falls back to a dot.
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
    <View style={[styles.container, { paddingBottom: spacing.sm + (insets.bottom || 0) }]}>
      {NAV_ITEMS.map(({ route, segment }) => {
        const focused = pathname.includes(segment);
        const isProfile = segment === 'profile';

        return (
          <TouchableOpacity
            key={segment}
            style={[
              styles.tab,
              // Figma: active tab = filled chocolate circle (white glyph);
              // profile is ALWAYS a bordered appleMail circle, the border
              // flipping grey → chocolate when active.
              !isProfile && focused && styles.tabActive,
              isProfile && styles.profileTab,
              isProfile && focused && styles.profileTabActive,
            ]}
            onPress={
              segment === 'create' ? onCreatePress : () => router.push(route as Href)
            }
            activeOpacity={0.7}
            // 40px visual circle + 4px slop on every side = 48pt target.
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={TAB_LABELS[segment]}
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
  // Figma 6279:10544: white bar, pt 12 / pb 8 / px 21, justify-between,
  // soft ambient shadow 0 0 4.5 @ 4% — no top border.
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: colors.white,
    paddingTop: spacing.md,
    paddingHorizontal: 21,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 4.5,
    elevation: 8,
  },
  tab: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.neutral.chocolate,
  },
  profileTab: {
    backgroundColor: colors.appleMail,
    borderWidth: 1,
    borderColor: PROFILE_RING_INACTIVE,
    overflow: 'hidden',
  },
  profileTabActive: {
    borderColor: colors.neutral.chocolate,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  initialsText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.chocolate,
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
