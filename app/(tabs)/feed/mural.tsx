import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  Text,
  Dimensions,
  TouchableOpacity,
  ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '@/context/AppContext';
import { useEvents } from '@/hooks/useEvents';
import { FeedHeader } from '@/components/feed/FeedHeader';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { formatEventDateShort } from '@/utils/date';
import { formatPrice } from '@/utils/format';
import type { EventWithRelations } from '@/types/event.types';

const { width, height } = Dimensions.get('window');

function PosterCard({ event }: { event: EventWithRelations }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      style={[styles.poster, { height }]}
      activeOpacity={0.98}
      onPress={() => router.push(`/event/${event.id}`)}
    >
      {event.poster_url ? (
        <Image source={{ uri: event.poster_url }} style={styles.posterImage} resizeMode="cover" />
      ) : (
        <View style={[styles.posterImage, styles.posterPlaceholder]} />
      )}

      <View style={[styles.posterOverlay, { paddingBottom: insets.bottom + spacing['3xl'] }]}>
        <Text style={styles.posterTitle} numberOfLines={3}>{event.title}</Text>
        <View style={styles.posterMeta}>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.white} />
            <Text style={styles.metaText}>{event.location_name ?? 'Berlin'}</Text>
          </View>
          <View style={styles.posterFooter}>
            <Text style={styles.posterPrice}>{formatPrice(event.price, event.is_free)}</Text>
            <Text style={styles.posterDate}>{formatEventDateShort(event.starts_at)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => router.push(`/event/${event.id}`)}
        >
          <Text style={styles.bookButtonText}>Get Booked</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function MuralScreen() {
  const router = useRouter();
  const { setFeedView, feedFilters, setFeedFilters } = useAppContext();
  const { events } = useEvents(feedFilters);
  const [currentIndex, setCurrentIndex] = useState(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]) {
        setCurrentIndex(viewableItems[0].index ?? 0);
      }
    }
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <FeedHeader
          activeView="mural"
          onViewChange={(v) => {
            setFeedView(v);
            if (v === 'list') router.push('/(tabs)/feed');
            else if (v === 'map') router.push('/(tabs)/feed/map');
          }}
          selectedCategories={feedFilters.categories ?? []}
          onToggleCategory={(cat) => {
            const current = feedFilters.categories ?? [];
            const next = current.includes(cat)
              ? current.filter((c) => c !== cat)
              : [...current, cat];
            setFeedFilters({ ...feedFilters, categories: next.length ? next : undefined });
          }}
        />
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PosterCard event={item} />}
        horizontal={false}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
      />

      <View style={styles.paginationDot}>
        <Text style={styles.counter}>
          {currentIndex + 1} / {events.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  poster: {
    width,
    overflow: 'hidden',
  },
  posterImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface,
  },
  posterPlaceholder: {
    backgroundColor: '#1A1A1A',
  },
  posterOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: spacing.xl,
    backgroundColor: 'transparent',
  },
  posterTitle: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
    lineHeight: typography.fontSize['2xl'] * 1.2,
    marginBottom: spacing.md,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  posterMeta: { gap: spacing.sm, marginBottom: spacing.base },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
  },
  posterFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  posterPrice: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  posterDate: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  bookButton: {
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  bookButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.black,
  },
  paginationDot: {
    position: 'absolute',
    top: 120,
    right: spacing.base,
  },
  counter: {
    fontSize: typography.fontSize.xs,
    color: 'rgba(255,255,255,0.6)',
  },
});
