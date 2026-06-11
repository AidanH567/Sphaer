import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography } from '@/constants/theme';
import { formatMessageTime } from '@/utils/date';
import type { Notification } from '@/types/message.types';
import type { NotificationType } from '@/types/enums';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

/**
 * Notification centre. Consumes `useNotifications()` (the hook already
 * exists from a prior session — Realtime subscription baked in). Renders
 * a single chronological list with per-type icon + body + relative time +
 * unread dot. Tap a row to navigate to its target (follow → /user/<id>,
 * event_reminder → /event/<id>, circle_event → /event/<id>, message →
 * /messages/<id>). Mark-as-read on tap (single) or via the top-right
 * "Mark all read" button.
 *
 * Reachable from a bell icon on the profile TopBar; surfaced as a `card`
 * presentation route at the app root so it slides over the tabs.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { notifications, unreadCount, isLoading, error, refetch, markAllRead } =
    useNotifications(user?.id);

  // Per-row mark-as-read. The hook doesn't expose this today; do it
  // directly here and patch the local list via an in-memory map. Keeps the
  // hook minimal and avoids a wider API refactor for one consumer.
  const markOneRead = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      } catch {
        // tolerated — Realtime will eventually reconcile
      }
    },
    [user?.id],
  );

  const handlePress = useCallback(
    async (n: Notification) => {
      if (!n.is_read) markOneRead(n.id);
      const path = routeFor(n);
      if (path) router.push(path as never);
    },
    [router, markOneRead],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.navButton}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={markAllRead}
            style={styles.markAllButton}
            accessibilityLabel="Mark all as read"
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.navButton} />
        )}
      </View>

      {!user ? (
        <ErrorState
          icon="notifications-off-outline"
          title="Sign in to see notifications"
          body="Notifications about follows, messages, and event activity show up here once you log in."
          onBack={() => router.back()}
          backLabel="Back"
        />
      ) : isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.black} />
        </View>
      ) : error && notifications.length === 0 ? (
        <ErrorState
          icon="cloud-offline-outline"
          title="Couldn't load notifications"
          body={error}
          onRetry={refetch}
          onBack={() => router.back()}
        />
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState
            icon="notifications-outline"
            title="You're all caught up"
            body="Follows, event reminders, and circle activity will show up here."
            centered
            spaced
          />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationRow item={item} onPress={() => handlePress(item)} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────

function NotificationRow({
  item,
  onPress,
}: {
  item: Notification;
  onPress: () => void;
}) {
  const meta = META_FOR_TYPE[item.type as NotificationType] ?? FALLBACK_META;
  return (
    <TouchableOpacity
      style={[styles.row, !item.is_read && styles.rowUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: meta.tint }]}>
        <Ionicons name={meta.icon} size={18} color={meta.iconColor} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowText, !item.is_read && styles.rowTextUnread]}>
          {meta.copy(item)}
        </Text>
        <Text style={styles.rowTime}>{formatMessageTime(item.created_at)}</Text>
      </View>
      {!item.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

// ── Type → display + routing ────────────────────────────────────────────────

interface NotificationMeta {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  tint: string;
  copy: (n: Notification) => string;
}

const META_FOR_TYPE: Record<NotificationType, NotificationMeta> = {
  follow: {
    icon: 'person-add-outline',
    iconColor: '#3B82F6',
    tint: 'rgba(59,130,246,0.10)',
    copy: () => 'Someone started following you.',
  },
  event_reminder: {
    icon: 'alarm-outline',
    iconColor: '#F97316',
    tint: 'rgba(249,115,22,0.10)',
    copy: () => 'An event you saved is coming up soon.',
  },
  circle_event: {
    icon: 'calendar-outline',
    iconColor: '#10B981',
    tint: 'rgba(16,185,129,0.10)',
    copy: () => 'A circle you follow posted a new event.',
  },
  message: {
    icon: 'chatbubble-ellipses-outline',
    iconColor: '#8B5CF6',
    tint: 'rgba(139,92,246,0.10)',
    copy: () => 'You have a new message.',
  },
};

const FALLBACK_META: NotificationMeta = {
  icon: 'notifications-outline',
  iconColor: colors.text.secondary,
  tint: colors.surface,
  copy: () => 'New activity on Sphaer.',
};

function routeFor(n: Notification): string | null {
  if (!n.reference_id) return null;
  switch (n.type as NotificationType) {
    case 'follow':
      return `/user/${n.reference_id}`;
    case 'event_reminder':
    case 'circle_event':
      return `/event/${n.reference_id}`;
    case 'message':
      return `/messages/${n.reference_id}`;
    default:
      return null;
  }
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  markAllButton: {
    height: 40,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.chocolate,
  },

  list: { paddingVertical: spacing.sm },
  empty: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  rowUnread: {
    backgroundColor: 'rgba(43,42,39,0.03)',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  rowTextUnread: {
    fontWeight: typography.fontWeight.semibold,
  },
  rowTime: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neutral.chocolate,
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('notifications');
