import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '@/constants/theme';
import type { MockConversation } from '@/data/mockMessages';

interface ConversationRowProps {
  conversation: MockConversation;
  onPress: () => void;
}

// Figma tokens
const NAME = '#0A0A0A';
const META = colors.neutral.meta;
const READ_BLUE = '#3572C7';
const MENTION_BLUE = '#21386C';
const STORY_RING = '#E67E22'; // warm gradient ring → solid approximation
const SEPARATOR = 'rgba(0,0,0,0.2)';
const AVATAR_BORDER = '#131311';

const AVATAR_SIZE = 56;

/**
 * Single conversation row in the Messages list. Mirrors the Figma node
 * 2457:3651 "Chats" row: avatar (with optional story ring), name, preview
 * with prefix icon variants (check / location / voice / typing), timestamp,
 * and pin / mention / unread-badge indicators on the right.
 */
export function ConversationRow({ conversation, onPress }: ConversationRowProps) {
  const {
    name,
    avatar,
    preview,
    previewKind,
    isOwn,
    status,
    timestamp,
    isPinned,
    hasMention,
    unreadCount,
    hasStoryRing,
  } = conversation;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {/* Avatar */}
      <View style={[styles.avatarWrap, hasStoryRing && styles.avatarRing]}>
        <Image source={{ uri: avatar }} style={styles.avatar} />
      </View>

      {/* Body — name + preview + right column */}
      <View style={styles.body}>
        <View style={styles.contact}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>

          <View style={styles.previewRow}>
            {/* Prefix icon — check marks (own), location, voice */}
            {isOwn && (
              <Ionicons
                name="checkmark-done"
                size={16}
                color={status === 'read' ? READ_BLUE : META}
                style={styles.prefixIcon}
              />
            )}
            {previewKind === 'location' && (
              <Ionicons name="location" size={14} color={META} style={styles.prefixIcon} />
            )}
            {previewKind === 'voice' && (
              <Ionicons name="mic" size={14} color={META} style={styles.prefixIcon} />
            )}

            <Text
              style={[
                styles.preview,
                previewKind === 'typing' && styles.previewItalic,
              ]}
              numberOfLines={1}
            >
              {preview}
            </Text>
          </View>
        </View>

        {/* Right — timestamp + pinned / mention / unread */}
        <View style={styles.right}>
          <Text style={styles.timestamp}>{timestamp}</Text>

          <View style={styles.indicators}>
            {hasMention && <Text style={styles.mention}>@</Text>}
            {typeof unreadCount === 'number' && unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
            {isPinned && !unreadCount && !hasMention && (
              <Ionicons name="pin" size={14} color={META} />
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingLeft: 16,
    paddingTop: 10,
    width: '100%',
  },

  // Avatar
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AVATAR_BORDER,
  },
  avatarRing: {
    borderWidth: 2,
    borderColor: STORY_RING,
  },
  avatar: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
  },

  // Body — flex 1, bottom border separator
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 67,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SEPARATOR,
    paddingBottom: 8,
  },
  contact: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: typography.fontFamily.display,
    fontSize: 16,
    fontWeight: typography.fontWeight.semibold,
    color: NAME,
    letterSpacing: -0.32,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  prefixIcon: {
    marginRight: 2,
  },
  preview: {
    flex: 1,
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: META,
    letterSpacing: -0.14,
  },
  previewItalic: {
    fontStyle: 'italic',
  },

  // Right column
  right: {
    alignItems: 'flex-end',
    gap: 4,
    marginLeft: 8,
    minWidth: 50,
  },
  timestamp: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: META,
    letterSpacing: -0.14,
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 18,
  },
  mention: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 16,
    fontWeight: typography.fontWeight.semibold,
    fontStyle: 'italic',
    color: '#829CC2',
  },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: MENTION_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 12,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
    letterSpacing: -0.12,
  },
});
