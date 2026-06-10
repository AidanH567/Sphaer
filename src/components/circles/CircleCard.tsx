import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '@/constants/theme';
import type { CircleWithCounts } from '@/types/circle.types';

interface CircleCardProps {
  circle: CircleWithCounts;
  /** Tapping the card opens the join sheet — the explore page owns that state. */
  onPress: () => void;
}

// Exact values from Figma node 3318:5393 ("Care_Circles" card).
const CARD_WIDTH = 176;
const CARD_HEIGHT = 313;
const IMAGE_SIZE = 148;
const CONTENT_HEIGHT = 132;
const CHOCOLATE = colors.neutral.chocolate; // Neutral/chocolate — card title
const META = colors.neutral.neutral400; // neutral/neutral-400 — activity / member counts

/**
 * Vertical circle card for the Circles explore page category rows.
 * One-to-one with the Figma card: circular image, title, activity + member
 * counts. Fixed 176×313 so it never stretches inside a horizontal row.
 */
/**
 * Memoised — the Circles browse screen renders these inside horizontal
 * ScrollViews per section. Without memo, every card re-renders when the
 * parent's `useCircles` reacts to a context tick.
 */
function CircleCardImpl({ circle, onPress }: CircleCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {circle.avatar_url ? (
        <Image source={{ uri: circle.avatar_url }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Ionicons name="people" size={48} color={colors.text.tertiary} />
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={3}>
          {circle.name}
        </Text>

        <View style={styles.infos}>
          <Text style={styles.metaLine}>{circle.activities_count} activities</Text>
          <Text style={styles.metaLine}>
            {circle.members_count.toLocaleString('de-DE')} members
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export const CircleCard = React.memo(CircleCardImpl);

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    paddingVertical: 12,
    paddingHorizontal: 6,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.white,
    // Figma shadow: 0 0 6px rgba(0,0,0,.09), 1px 1px 2px rgba(0,0,0,.10)
    // — approximated with RN's single shadow.
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: IMAGE_SIZE / 2,
    backgroundColor: colors.surface,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    height: CONTENT_HEIGHT,
    padding: 6,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 20,
    lineHeight: 23.4, // Figma: 117% of 20px
    fontWeight: typography.fontWeight.regular,
    color: CHOCOLATE,
    textAlign: 'center',
  },
  infos: {
    alignItems: 'center',
    gap: 2,
  },
  metaLine: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.semibold,
    color: META,
  },
});
