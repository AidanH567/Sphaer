import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ConversationRow } from '@/components/messages/ConversationRow';
import { NewConversationSheet } from '@/components/messages/NewConversationSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { OverflowMenuSheet } from '@/components/ui/OverflowMenuSheet';
import { BlockedAccountsSheet } from '@/components/moderation/BlockedAccountsSheet';
import { useAppContext } from '@/context/AppContext';
import { colors, typography } from '@/constants/theme';
import { useAuthContext } from '@/context/AuthContext';
import { useMessagesContext } from '@/context/MessagesContext';
import { formatMessageTime } from '@/utils/date';
import type { Conversation, ConversationRowDisplay } from '@/types/message.types';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

// NOTE: real Supabase data via `useMessagesContext()`. Each row is mapped
// into the `ConversationRowDisplay` shape so the existing Figma-styled
// `ConversationRow` keeps working. Replace the mapping with native real-data
// rendering once `ConversationRow` is updated to accept `Conversation`.

// Figma tokens
const CREAM = '#FCFCF9';
const INK = '#1B1B18';
const META = '#767779';
const META_BG = 'rgba(10,10,10,0.03)';
const CHIP_BG = '#FCFCF9';
const CHIP_ACTIVE_BG = '#E7E7E7';
const LINK = '#829CC2';

type FilterKey =
  | 'all'
  | 'unread'
  | 'favourites'
  | 'direct'
  | 'activities'
  | 'circles';

// Order: catch-all first, then cross-kind filters, then per-kind filters
// grouped together (Direct → Activities → Circles).
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'favourites', label: 'Favourites' },
  { key: 'direct', label: 'Direct' },
  { key: 'activities', label: 'Activities' },
  { key: 'circles', label: 'Circles' },
];

/** Tab-aware empty-state copy for the inbox. */
function emptyCopyForFilter(
  filter: FilterKey
): { icon: 'chatbubbles-outline' | 'mail-open-outline' | 'star-outline'; title: string; body: string } {
  switch (filter) {
    case 'unread':
      return {
        icon: 'mail-open-outline',
        title: "You're all caught up",
        body: 'Nothing unread — new messages will show up here.',
      };
    case 'favourites':
      return {
        icon: 'star-outline',
        title: 'No favourites yet',
        body: 'Star a conversation to keep it pinned to this tab.',
      };
    case 'direct':
      return {
        icon: 'chatbubbles-outline',
        title: 'No direct messages yet',
        body: 'Message an artist from their profile to start a chat.',
      };
    case 'activities':
      return {
        icon: 'chatbubbles-outline',
        title: 'No activity chats yet',
        body: 'Register for an event to join its group chat.',
      };
    case 'circles':
      return {
        icon: 'chatbubbles-outline',
        title: 'No circle chats yet',
        body: 'Join a circle to chat with its members.',
      };
    default:
      return {
        icon: 'chatbubbles-outline',
        title: 'No conversations yet',
        body: 'Message an artist from their profile, or join a circle to start chatting.',
      };
  }
}

interface RowWithRoute {
  row: ConversationRowDisplay;
  route: string;
}

/**
 * Map a real conversation into the row shape.
 *
 * `avatar` passes through EXACTLY what the record holds — null included.
 * These three lines used to invent an image when there wasn't one:
 *
 *     avatar: partner.avatar_url ?? `https://i.pravatar.cc/150?u=${partner.id}`
 *     avatar: e.poster_url       ?? `https://picsum.photos/seed/${e.id}/150/150`
 *     avatar: c.avatar_url       ?? `https://picsum.photos/seed/${c.id}/150/150`
 *
 * pravatar serves photographs of real human faces, keyed deterministically off
 * `?u=`. So a new user who never uploaded anything got a stable, convincing
 * photo of a stranger presented as their profile picture — reported by Lara as
 * "an AI generated profile picture" (list item 8) and the reason this changed.
 * The inbox was the only place it showed: the conversation screen already used
 * the shared `Avatar`, so the same person had a face in the list and initials
 * one tap deeper.
 *
 * The type is nullable now, so there is no longer a type error tempting anyone
 * to fill the hole with a remote placeholder. `ConversationRow` renders
 * initials instead.
 */
function toRow(conv: Conversation, ownUserId: string | undefined): RowWithRoute {
  const lastMsg = conv.last_message;
  if (conv.kind === 'event') {
    const e = conv.event;
    return {
      row: {
        id: e.id,
        name: e.title,
        avatar: e.poster_url,
        type: 'circle', // closest existing semantic — group chat, not 1:1
        preview: lastMsg?.content ?? 'No messages yet',
        previewKind: 'text',
        isOwn: lastMsg?.sender_id === ownUserId,
        status: 'delivered',
        timestamp: formatMessageTime(lastMsg?.created_at),
        isPinned: false,
        hasMention: false,
        unreadCount: conv.unread_count > 0 ? conv.unread_count : undefined,
        hasStoryRing: false,
      },
      route: `/messages/event/${e.id}`,
    };
  }
  if (conv.kind === 'circle') {
    const c = conv.circle;
    return {
      row: {
        id: c.id,
        name: c.name,
        avatar: c.avatar_url,
        type: 'circle',
        preview: lastMsg?.content ?? 'No messages yet',
        previewKind: 'text',
        isOwn: lastMsg?.sender_id === ownUserId,
        status: 'delivered',
        timestamp: formatMessageTime(lastMsg?.created_at),
        isPinned: false,
        hasMention: false,
        unreadCount: conv.unread_count > 0 ? conv.unread_count : undefined,
        hasStoryRing: false,
      },
      route: `/messages/circle/${c.id}`,
    };
  }
  const partner = conv.partner;
  return {
    row: {
      id: partner.id,
      name: partner.display_name ?? partner.username ?? 'Unknown',
      avatar: partner.avatar_url,
      type: 'user',
      preview: lastMsg?.content ?? '',
      previewKind: 'text',
      isOwn: lastMsg?.sender_id === ownUserId,
      status: 'delivered',
      timestamp: formatMessageTime(lastMsg?.created_at),
      isPinned: false,
      hasMention: false,
      unreadCount: conv.unread_count > 0 ? conv.unread_count : undefined,
      hasStoryRing: false,
    },
    route: `/messages/${partner.id}`,
  };
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { conversations, isLoading, error, refresh, markRead } = useMessagesContext();
  const { blockedIds } = useAppContext();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);

  // The two header buttons. Both were `console.log` stubs until report
  // ce750054 ("these buttons do nothing on the messaging page").
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);

  const unreadCount = useMemo(
    () => conversations.filter((c) => c.unread_count > 0).length,
    [conversations]
  );

  /**
   * Clear every unread badge in one go.
   *
   * Sequential rather than `Promise.all`: each target is a separate write,
   * and firing twenty at once at a phone on hotel wifi is how you get a
   * partial result with no way to tell which half landed. The inbox is
   * refreshed once at the end so the badges settle together.
   */
  const markAllRead = useCallback(async () => {
    const unread = conversations.filter((c) => c.unread_count > 0);
    for (const conv of unread) {
      try {
        if (conv.kind === 'dm') {
          await markRead({ kind: 'dm', partnerId: conv.partner.id });
        } else if (conv.kind === 'event') {
          await markRead({ kind: 'event', eventId: conv.event.id });
        } else {
          await markRead({ kind: 'circle', circleId: conv.circle.id });
        }
      } catch (err) {
        console.warn('[Messages] mark all read failed for a conversation:', err);
      }
    }
    await refresh();
  }, [conversations, markRead, refresh]);

  // Pull-to-refresh. `refresh()` is a real promise that resolves when the
  // re-fetch settles, so we can drive the spinner straight off the await.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const rows: RowWithRoute[] = useMemo(() => {
    const filtered = (() => {
      switch (activeFilter) {
        case 'unread':
          return conversations.filter((c) => c.unread_count > 0);
        case 'favourites':
          return []; // not implemented yet
        case 'direct':
          return conversations.filter((c) => c.kind === 'dm');
        case 'activities':
          return conversations.filter((c) => c.kind === 'event');
        case 'circles':
          return conversations.filter((c) => c.kind === 'circle');
        default:
          return conversations;
      }
    })();
    return filtered.map((c) => toRow(c, user?.id));
  }, [conversations, activeFilter, user?.id]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top header — meatball left, dark + right */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.ctaCircular}
          onPress={() => setOptionsOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open options"
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={INK} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.ctaCircular, styles.ctaCircularDark]}
          onPress={() => setNewConversationOpen(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Start new conversation"
        >
          <Ionicons name="add" size={18} color={CREAM} />
        </TouchableOpacity>
      </View>

      {/* Title section — filter chips */}
      <View style={styles.titleSection}>
        {/* Six chips exceed a 390px screen — the row must actually scroll.
            A plain View here clipped "Circles" off the right edge. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersRow}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, activeFilter === f.key && styles.chipActive]}
              onPress={() => setActiveFilter(f.key)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: activeFilter === f.key }}
            >
              <Text
                style={[
                  styles.chipText,
                  activeFilter === f.key && styles.chipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Encryption notice */}
      <View style={styles.encryptRow}>
        <Ionicons name="lock-closed" size={12} color={META} />
        <Text style={styles.encryptText}>
          Your personal messages are <Text style={styles.encryptLink}>end-to-end encrypted</Text>
        </Text>
      </View>

      {/* Conversation list */}
      {/* Only show the centered spinner on the true initial load — a
          pull-to-refresh (rows already present) must keep the list visible
          and let the RefreshControl render its own spinner instead. */}
      {isLoading && rows.length === 0 && !refreshing ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={INK} />
        </View>
      ) : error && conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <ErrorState
            icon="cloud-offline-outline"
            title="Couldn't load your chats"
            body={error}
            onRetry={refresh}
          />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.emptyState}>
          <EmptyState {...emptyCopyForFilter(activeFilter)} centered spaced />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.row.id}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item.row}
              onPress={() => router.push(item.route as never)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.neutral.chocolate}
            />
          }
        />
      )}

      {/* `+` — search people, tap one, land in the thread. */}
      <NewConversationSheet
        visible={newConversationOpen}
        onClose={() => setNewConversationOpen(false)}
        currentUserId={user?.id}
        blockedIds={blockedIds}
      />

      {/* `…` — inbox-level actions. Deliberately short: an overflow menu
          padded out with things that already have a gesture (pull to
          refresh) is how it goes back to feeling decorative. */}
      <OverflowMenuSheet
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        actions={[
          ...(unreadCount > 0
            ? [
                {
                  label:
                    unreadCount === 1
                      ? 'Mark 1 chat as read'
                      : `Mark all ${unreadCount} chats as read`,
                  icon: 'checkmark-done-outline' as const,
                  onPress: markAllRead,
                },
              ]
            : []),
          {
            label: 'Blocked accounts',
            icon: 'ban-outline' as const,
            onPress: () => setBlockedOpen(true),
          },
        ]}
      />

      <BlockedAccountsSheet
        visible={blockedOpen}
        onClose={() => setBlockedOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM },

  // Header (top row with meatball + plus)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  ctaCircular: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: META_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaCircularDark: {
    backgroundColor: INK,
  },

  // Title section (filter chips)
  titleSection: {
    
    
    paddingTop: 4,
    paddingBottom: 8,
    gap: 12,
  },

  // react-native-web ScrollView ships flexGrow/flexShrink: 1 — pin both
  // or the row collapses (same fix as the feed chip row).
  filtersScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 16,
  },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: CHIP_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: CHIP_ACTIVE_BG,
  },
  chipText: {
    fontFamily: typography.fontFamily.display,
    fontSize: 14,
    fontWeight: typography.fontWeight.semibold,
    color: META,
    letterSpacing: -0.14,
  },
  chipTextActive: {
    color: INK,
  },

  // Encryption notice
  encryptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  encryptText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 11,
    color: META,
  },
  encryptLink: {
    color: LINK,
  },

  // List
  list: {
    paddingTop: 8,
    paddingBottom: 110, // clear the BottomNav
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('messages-inbox');
