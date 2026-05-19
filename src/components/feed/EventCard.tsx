import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { Avatar } from '@/components/ui/Avatar';
import { Tag } from '@/components/ui/Tag';
import { CirclePreviewModal } from '@/components/circles/CirclePreviewModal';
import type { EventWithRelations } from '@/types/event.types';
import { formatPrice } from '@/utils/format';

interface EventCardProps {
  event: EventWithRelations;
  onSave?: () => void;
  isSaved?: boolean;
}

export function EventCard({ event, onSave, isSaved = false }: EventCardProps) {
  const router = useRouter();
  const [circleModalVisible, setCircleModalVisible] = useState(false);

  const dateLabel = new Date(event.starts_at).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).replace(',', '');

  const priceLabel = formatPrice(event.price, event.is_free);
  const hasCircle = !!event.circle;

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/event/${event.id}`)}
        activeOpacity={0.95}
      >
        {event.poster_url && (
          <Image source={{ uri: event.poster_url }} style={styles.poster} resizeMode="cover" />
        )}

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>

          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={colors.text.tertiary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {event.location_name ?? event.address ?? 'Berlin'}
            </Text>
          </View>

          {/* Bottom row: price+date left, Get Booked right */}
          <View style={styles.footer}>
            <View style={styles.priceBlock}>
              <Text style={styles.price}>{priceLabel}</Text>
              <Text style={styles.date}>{dateLabel}</Text>
            </View>

            <View style={styles.footerRight}>
              {/* Circle / creator avatar tap to preview */}
              <TouchableOpacity
                onPress={() => {
                  if (hasCircle) {
                    setCircleModalVisible(true);
                  } else if (event.creator_id) {
                    router.push(`/user/${event.creator_id}`);
                  }
                }}
                activeOpacity={0.75}
                style={styles.creatorTouch}
              >
                <Avatar
                  uri={event.circle?.avatar_url ?? event.creator?.avatar_url}
                  name={event.circle?.name ?? event.creator?.display_name ?? ''}
                  size={26}
                />
              </TouchableOpacity>

              {onSave && (
                <TouchableOpacity onPress={onSave} style={styles.saveButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color={colors.text.secondary}
                  />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.bookButton}
                onPress={() => router.push(`/event/${event.id}`)}
                activeOpacity={0.85}
              >
                <Text style={styles.bookButtonText}>
                  {event.is_free ? 'Register' : 'Get Booked'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {(event.categories ?? []).length > 0 && (
            <View style={styles.tags}>
              {(event.categories ?? []).slice(0, 3).map((cat) => (
                <Tag key={cat} label={cat} style={styles.tag} />
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>

      {hasCircle && event.circle && (
        <CirclePreviewModal
          circle={{ ...event.circle, members_count: 0, activities_count: 0 }}
          visible={circleModalVisible}
          onClose={() => setCircleModalVisible(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  poster: {
    width: '100%',
    height: 220,
    backgroundColor: colors.surface,
  },
  body: {
    padding: spacing.base,
    gap: spacing.sm,
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    lineHeight: typography.fontSize.md * 1.3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  priceBlock: { gap: 1 },
  price: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  date: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  creatorTouch: {},
  saveButton: {},
  bookButton: {
    backgroundColor: colors.black,
    borderRadius: radius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm - 1,
  },
  bookButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
});
