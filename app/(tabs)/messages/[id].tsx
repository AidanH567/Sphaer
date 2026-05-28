import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getConversationById } from '@/data/mockMessages';
import { typography } from '@/constants/theme';

// NOTE: placeholder chat detail. To go live, query the `messages` table
// scoped to (sender_id, recipient_id) or `circle_id`, subscribe via Supabase
// Realtime, and render a message bubble list.

const CREAM = '#FCFCF9';
const INK = '#1B1B18';
const META = '#767779';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const conversation = getConversationById(id);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={INK} />
        </TouchableOpacity>

        {conversation && (
          <View style={styles.headerCenter}>
            <Image source={{ uri: conversation.avatar }} style={styles.avatar} />
            <Text style={styles.name} numberOfLines={1}>
              {conversation.name}
            </Text>
          </View>
        )}

        <View style={styles.navButton} />
      </View>

      <View style={styles.body}>
        <Ionicons name="chatbubbles-outline" size={40} color={META} />
        <Text style={styles.title}>Chat coming soon</Text>
        <Text style={styles.subtitle}>
          {conversation
            ? `Real-time messages with ${conversation.name} will live here.`
            : 'This conversation will live here.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEE',
  },
  name: {
    fontFamily: typography.fontFamily.display,
    fontSize: 16,
    fontWeight: typography.fontWeight.semibold,
    color: INK,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 20,
    fontWeight: typography.fontWeight.semibold,
    color: INK,
  },
  subtitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: META,
    textAlign: 'center',
    maxWidth: 280,
  },
});
