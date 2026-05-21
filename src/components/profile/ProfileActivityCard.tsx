import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, typography } from '@/constants/theme';
import type { ProfileActivity } from '@/data/mockProfiles';

interface ProfileActivityCardProps {
  activity: ProfileActivity;
}

// Figma tokens
const CHOCOLATE = '#2B2A27';
const CARD_META = '#505049';
const BODY = '#363530';

/**
 * Activity card used on the profile page — title on the left, date / time /
 * location / price stacked below it, poster image on the right. Matches the
 * Figma "Card-Activity" node (231px tall, 163px poster).
 */
export function ProfileActivityCard({ activity }: ProfileActivityCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={4}>
          {activity.title}
        </Text>

        <View style={styles.infos}>
          <Text style={styles.metaLine}>{activity.dateLabel}</Text>
          <Text style={styles.metaLine}>{activity.timeLabel}</Text>
          <Text style={styles.metaLine} numberOfLines={1}>
            {activity.location}
          </Text>
          <Text style={styles.price}>{activity.price}</Text>
        </View>
      </View>

      <Image source={{ uri: activity.image }} style={styles.poster} resizeMode="cover" />
    </View>
  );
}

const CARD_HEIGHT = 231;
const POSTER_WIDTH = 163;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    height: CARD_HEIGHT,
    backgroundColor: colors.white,
    borderRadius: 8,
    overflow: 'hidden',
    // drop shadow from the Figma card
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  content: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 20,
    lineHeight: 23,
    color: CHOCOLATE,
  },
  infos: {
    gap: 2,
  },
  metaLine: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.medium,
    color: CARD_META,
  },
  price: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.bold,
    color: BODY,
  },
  poster: {
    width: POSTER_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: colors.surface,
  },
});
