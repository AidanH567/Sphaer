import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { formatEventDateShort, formatEventTimeRange } from '@/utils/date';
import { formatPrice } from '@/utils/format';
import type { EventWithRelations } from '@/types/event.types';
import type { MockEvent } from '@/data/mockEvents';

interface EventCardProps {
  event: EventWithRelations | MockEvent;
  onSave?: () => void;
  isSaved?: boolean;
}

// Exact tokens from Figma feed card (4045:8204 instance 3419:7475).
const CHOCOLATE = colors.neutral.chocolate; // card title (ABC Arizona Light 20)
// Meta + price use the Figma feed card's exact neutrals (neutral-600 /
// neutral-700), which are a touch lighter than the shared cardMeta/body
// tokens the profile activity card still uses. Scoped here so the feed
// card matches its frame without disturbing unaudited profile cards.
const CARD_META = colors.neutral.neutral600; // date / time / location
const PRICE = colors.neutral.neutral700; // price

const CARD_HEIGHT = 231;
const POSTER_WIDTH = 163;

/**
 * Feed event card — text on the left, poster on the right with a bookmark
 * button. Matches the Figma card (358×231, 8px radius, 163px poster).
 * Tapping the card opens the event detail page.
 */
/**
 * Memoised — the Feed FlatList renders one of these per event, and the
 * parent re-renders on every filter / save toggle / focus refresh. Without
 * memo, scrolling past 20+ cards causes visible jank during a `setSavedIds`
 * call. Shallow-compare on { event, onSave, isSaved } is sufficient: parent
 * passes the same `event` object reference for unchanged rows and
 * `onSave` is wrapped in a stable identity via toggleSave's closure.
 */
function EventCardImpl({ event, onSave, isSaved = false }: EventCardProps) {
  const router = useRouter();

  const dateLabel = formatEventDateShort(event.starts_at).replace(',', '');
  const timeLabel = formatEventTimeRange(event.starts_at, event.ends_at);
  const priceLabel =
    (event as MockEvent).priceLabel ?? formatPrice(event.price, event.is_free);
  const locationLabel = event.location_name ?? event.address ?? 'Berlin';

  // The bookmark is a SIBLING of the card press surface, absolutely
  // positioned over it — a button may not contain another button (invalid
  // DOM on web, and a single merged focus stop for screen readers).
  return (
    <View style={styles.cardWrap}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/event/${event.id}`)}
        activeOpacity={0.92}
        accessibilityRole="button"
        accessibilityLabel={`Open ${event.title}`}
      >
        {/* Left — text area */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={3}>
            {event.title}
          </Text>

          <View style={styles.meta}>
            <Text style={styles.metaLine}>{dateLabel}</Text>
            <Text style={styles.metaLine}>{timeLabel}</Text>
            <Text style={styles.metaLine} numberOfLines={1}>
              {locationLabel}
            </Text>
            <Text style={styles.price}>{priceLabel === 'FREE' ? 'Free' : priceLabel}</Text>
          </View>
        </View>

        {/* Right — poster image */}
        <View style={styles.imageWrap}>
          {event.poster_url ? (
            <Image source={{ uri: event.poster_url }} style={styles.image} contentFit="cover" />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]} />
          )}
        </View>
      </TouchableOpacity>

      {onSave && (
        <TouchableOpacity
          style={styles.bookmarkButton}
          onPress={onSave}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={isSaved ? 'Remove from saved' : 'Save event'}
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={19}
            color={colors.text.primary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

export const EventCard = React.memo(EventCardImpl);

const styles = StyleSheet.create({
  // Margins live on the wrapper so the absolutely-positioned bookmark
  // anchors to the card box, not the list gutter.
  cardWrap: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CARD_HEIGHT,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingLeft: 2,
    overflow: 'hidden',
    // Figma: 0 0 3px rgba(0,0,0,.09), 1px 1px 1px rgba(0,0,0,.10)
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  content: {
    flex: 1,
    height: '100%',
    padding: 14,
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.lg,
    lineHeight: 23.4, // Figma: 117%
    fontWeight: typography.fontWeight.regular,
    color: CHOCOLATE,
  },
  meta: {
    gap: 2,
  },
  metaLine: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    // Figma feed card: meta is SF Pro Regular (400), not Medium.
    fontWeight: typography.fontWeight.regular,
    color: CARD_META,
  },
  price: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    // Figma feed card: price is SF Pro Heavy (860 → our heavy/800).
    fontWeight: typography.fontWeight.heavy,
    color: PRICE,
    marginTop: 2,
  },
  imageWrap: {
    width: POSTER_WIDTH,
    alignSelf: 'stretch',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
    backgroundColor: colors.surface,
  },
  imagePlaceholder: {
    backgroundColor: colors.surface,
  },
  bookmarkButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
