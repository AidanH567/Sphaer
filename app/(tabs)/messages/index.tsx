import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ConversationRow } from '@/components/messages/ConversationRow';
import { MOCK_CONVERSATIONS, type MockConversation } from '@/data/mockMessages';
import { typography } from '@/constants/theme';

// NOTE: shows mock conversations (src/data/mockMessages.ts). To go live,
// query the `messages` table (already in supabase/migrations) joined to
// `profiles` / `circles`, grouped by partner, taking the latest message.

// Figma tokens
const CREAM = '#FCFCF9';
const INK = '#1B1B18';
const META = '#767779';
const META_BG = 'rgba(10,10,10,0.03)';
const CHIP_BG = '#FCFCF9';
const CHIP_ACTIVE_BG = '#E7E7E7';
const LINK = '#829CC2';

type FilterKey = 'all' | 'unread' | 'favourites' | 'circles';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'favourites', label: 'Favourites' },
  { key: 'circles', label: 'Circles' },
];

function isUnread(c: MockConversation): boolean {
  return Boolean(c.unreadCount && c.unreadCount > 0) || Boolean(c.hasMention);
}

export default function MessagesScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const conversations = useMemo(() => {
    switch (activeFilter) {
      case 'unread':
        return MOCK_CONVERSATIONS.filter(isUnread);
      case 'favourites':
        return [];
      case 'circles':
        return MOCK_CONVERSATIONS.filter((c) => c.type === 'circle');
      default:
        return MOCK_CONVERSATIONS;
    }
  }, [activeFilter]);

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

      {/* Title section — Chat/Circles toggle + filter chips */}
      <View style={styles.titleSection}>
        <View style={styles.toggleOuter}>
          <View style={[styles.toggleItem, styles.toggleItemActive]}>
            <Text style={[styles.toggleText, styles.toggleTextActive]}>Chat</Text>
          </View>
          <TouchableOpacity
            style={styles.toggleItem}
            onPress={() => router.push('/(tabs)/circles')}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleText}>Circles</Text>
          </TouchableOpacity>
        </View>

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
      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No conversations to show</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              onPress={() => router.push(`/messages/${item.id}`)}
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

  // Title section (toggle + filters)
  titleSection: {
    paddingLeft: 20,
    paddingRight: 16,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 12,
  },
  toggleOuter: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    height: 38,
    paddingHorizontal: 2,
    paddingVertical: 2,
    backgroundColor: INK,
    borderRadius: 30,
  },
  toggleItem: {
    height: 34,
    paddingHorizontal: 18,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleItemActive: {
    backgroundColor: CREAM,
  },
  toggleText: {
    fontFamily: typography.fontFamily.display,
    fontSize: 14,
    fontWeight: typography.fontWeight.semibold,
    color: CREAM,
  },
  toggleTextActive: {
    color: INK,
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
