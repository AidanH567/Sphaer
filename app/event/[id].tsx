import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from '@/hooks/useEvents';
import { useAuthContext } from '@/context/AuthContext';
import { Tag } from '@/components/ui/Tag';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { formatEventDate, formatEventTime } from '@/utils/date';
import { formatPrice } from '@/utils/format';
import { saveEvent, unsaveEvent } from '@/services/events.service';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthContext();
  const { event, isLoading } = useEvent(id);
  const [isSaved, setIsSaved] = useState(false);

  async function toggleSave() {
    if (!user || !event) return;
    setIsSaved((prev) => !prev);
    try {
      if (isSaved) {
        await unsaveEvent(user.id, event.id);
      } else {
        await saveEvent(user.id, event.id);
      }
    } catch {
      setIsSaved((prev) => !prev);
    }
  }

  async function handleShare() {
    if (!event) return;
    await Share.share({ message: `${event.title} — ${event.location_name ?? 'Berlin'}` });
  }

  async function handleBook() {
    if (!event) return;
    if (event.ticket_url) {
      await Linking.openURL(event.ticket_url);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.black} />
      </View>
    );
  }

  if (!event) return null;

  const priceLabel = formatPrice(event.price, event.is_free);

  // Compact date: "Fri 27.May"
  const dateLabel = new Date(event.starts_at).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).replace(',', '');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Minimal header — back, share, bookmark */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.navRight}>
          <TouchableOpacity onPress={handleShare} style={styles.navButton}>
            <Ionicons name="share-outline" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleSave} style={styles.navButton}>
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={colors.text.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} bounces>
        {/* Full-bleed hero image */}
        {event.poster_url ? (
          <Image source={{ uri: event.poster_url }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={styles.posterPlaceholder} />
        )}

        {/* Content body */}
        <View style={styles.body}>
          <Text style={styles.title}>{event.title}</Text>

          {(event.location_name || event.address) && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={colors.text.tertiary} />
              <Text style={styles.locationText}>
                {event.location_name ?? event.address}
              </Text>
            </View>
          )}

          {event.description ? (
            <Text style={styles.description}>{event.description}</Text>
          ) : null}

          {event.categories && event.categories.length > 0 && (
            <View style={styles.tags}>
              {event.categories.map((cat) => (
                <Tag key={cat} label={cat} />
              ))}
            </View>
          )}

          {/* Price + date + CTA — matches Figma footer row */}
          <View style={styles.ctaRow}>
            <View style={styles.priceBlock}>
              <Text style={styles.price}>{priceLabel}</Text>
              <Text style={styles.date}>{dateLabel}</Text>
            </View>
            <TouchableOpacity style={styles.bookButton} onPress={handleBook} activeOpacity={0.85}>
              <Text style={styles.bookButtonText}>
                {event.is_free ? 'Register' : 'Get Booked'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  navButton: { padding: spacing.sm },
  navRight: { flexDirection: 'row', alignItems: 'center' },

  poster: {
    width: '100%',
    height: 340,
    backgroundColor: colors.surface,
  },
  posterPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: colors.surface,
  },

  body: {
    padding: spacing.base,
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },

  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    lineHeight: typography.fontSize['2xl'] * 1.2,
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

  description: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    lineHeight: 24,
  },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  priceBlock: { gap: 2 },
  price: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  date: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  bookButton: {
    backgroundColor: colors.black,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  bookButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
});
