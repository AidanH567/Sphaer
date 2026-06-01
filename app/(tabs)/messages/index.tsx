import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ConversationRow } from '@/components/messages/ConversationRow';
import type { MockConversation } from '@/data/mockMessages';
import { typography } from '@/constants/theme';
import { useAuthContext } from '@/context/AuthContext';
import { useMessagesContext } from '@/context/MessagesContext';
import { formatMessageTime } from '@/utils/date';
import type { Conversation } from '@/types/message.types';

// NOTE: real Supabase data via `useMessagesContext()`. Each row is mapped
// into the legacy `MockConversation` shape so the existing Figma-styled
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

type FilterKey = 'all' | 'unread' | 'favourites' | 'activities' | 'circles';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'favourites', label: 'Favourites' },
  { key: 'activities', label: 'Activities' },
  { key: 'circles', label: 'Circles' },
];

interface RowWithRoute {
  row: MockConversation;
  route: string;
}

function toRow(conv: Conversation, ownUserId: string | undefined): RowWithRoute {
  const lastMsg = conv.last_message;
  if (conv.kind === 'event') {
    const e = conv.event;
    return {
      row: {
        id: e.id,
        name: e.title,
        avatar: e.poster_url ?? `https://picsum.photos/seed/${e.id}/150/150`,
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
  const partner = conv.partner;
  return {
    row: {
      id: partner.id,
      name: partner.display_name ?? partner.username ?? 'Unknown',
      avatar: partner.avatar_url ?? `https://i.pravatar.cc/150?u=${partner.id}`,
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
  const { conversations, isLoading } = useMessagesContext();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const rows: RowWithRoute[] = useMemo(() => {
    const filtered = (() => {
      switch (activeFilter) {
        case 'unread':
          return conversations.filter((c) => c.unread_count > 0);
        case 'favourites':
          return []; // not implemented yet
        case 'activities':
          return conversations.filter((c) => c.kind === 'event');
        case 'circles':
          return []; // circle group chats deferred to a later iteration
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
          onPress={() => console.log('[Messages] options')}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={INK} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.ctaCircular, styles.ctaCircularDark]}
          onPress={() => console.log('[Messages] new conversation')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color={CREAM} />
        </TouchableOpacity>
      </View>

      {/* Title section — filter chips */}
      <View style={styles.titleSection}>
        <View style={styles.filtersRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, activeFilter === f.key && styles.chipActive]}
              onPress={() => setActiveFilter(f.key)}
              activeOpacity={0.75}
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
          <TouchableOpacity
            style={[styles.chip, styles.chipAdd]}
            onPress={() => console.log('[Messages] add filter')}
            activeOpacity={0.75}
          >
            <Ionicons name="add" size={18} color={META} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Encryption notice */}
      <View style={styles.encryptRow}>
        <Ionicons name="lock-closed" size={12} color={META} />
        <Text style={styles.encryptText}>
          Your personal messages are <Text style={styles.encryptLink}>end-to-end encrypted</Text>
        </Text>
      </View>

      {/* Conversation list */}
      {isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={INK} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No conversations to show</Text>
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
        />
      )}
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
    paddingLeft: 20,
    paddingRight: 16,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 12,
  },

  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
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
  chipAdd: {
    width: 34,
    paddingHorizontal: 0,
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
  emptyText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: META,
  },
});
