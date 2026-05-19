import React from 'react';
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
import { useAuthContext } from '@/context/AuthContext';
import { useConversations } from '@/hooks/useMessages';
import { Avatar } from '@/components/ui/Avatar';
import { colors, typography, spacing } from '@/constants/theme';
import { formatMessageTime } from '@/utils/date';
import { truncate } from '@/utils/format';
import type { Conversation } from '@/types/message.types';

function ConversationRow({ conv }: { conv: Conversation }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/messages/${conv.partner.id}`)}
      activeOpacity={0.7}
    >
      <Avatar uri={conv.partner.avatar_url} name={conv.partner.display_name ?? ''} size={48} />
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.partnerName}>{conv.partner.display_name ?? conv.partner.username}</Text>
          {conv.last_message && (
            <Text style={styles.time}>{formatMessageTime(conv.last_message.created_at)}</Text>
          )}
        </View>
        {conv.last_message && (
          <Text style={styles.lastMessage} numberOfLines={1}>
            {truncate(conv.last_message.content, 50)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function MessagesScreen() {
  const { user } = useAuthContext();
  const { conversations, isLoading } = useConversations(user?.id);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.black} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No conversations yet</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.partner.id}
          renderItem={({ item }) => <ConversationRow conv={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: typography.fontSize.base, color: colors.text.tertiary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowContent: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  partnerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  time: { fontSize: typography.fontSize.xs, color: colors.text.tertiary },
  lastMessage: { fontSize: typography.fontSize.sm, color: colors.text.secondary },
});
