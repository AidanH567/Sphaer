import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Share,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { EventRegistrationSheet } from '@/components/ui/EventRegistrationSheet';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { formatEventDateCompact } from '@/utils/date';
import { formatPrice } from '@/utils/format';
import { useEvent } from '@/hooks/useEvents';
import { useAuthContext } from '@/context/AuthContext';
import { useMessagesContext } from '@/context/MessagesContext';
import { register as registerForEvent } from '@/services/registrations.service';
import {
  isEventSaved as isEventSavedService,
  saveEvent,
  unsaveEvent,
} from '@/services/events.service';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { event, isLoading } = useEvent(id);
  const { user } = useAuthContext();
  const { conversations } = useMessagesContext();

  // Chat is available to the creator (always) + anyone with the event in
  // their conversations list (i.e. registered, since the RPC includes every
  // event the user is registered for, even when there are no messages yet).
  const canAccessChat = Boolean(
    id &&
      user?.id &&
      (event?.creator_id === user.id ||
        conversations.some((c) => c.kind === 'event' && c.event.id === id))
  );

  const [isSaved, setIsSaved] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);

  // Hydrate the bookmark icon state from the DB on mount.
  useEffect(() => {
    if (!user?.id || !id) return;
    let cancelled = false;
    isEventSavedService(user.id, id)
      .then((saved) => {
        if (!cancelled) setIsSaved(saved);
      })
      .catch((err) => console.error('[EventDetail] load isSaved failed:', err));
    return () => {
      cancelled = true;
    };
  }, [user?.id, id]);

  async function handleToggleSave() {
    if (!user?.id || !id) return;
    const wasSaved = isSaved;
    setIsSaved(!wasSaved);
    try {
      if (wasSaved) {
        await unsaveEvent(user.id, id);
      } else {
        await saveEvent(user.id, id);
      }
    } catch (err) {
      console.error('[EventDetail] toggleSave failed:', err);
      setIsSaved(wasSaved);
    }
  }

  // Loading state — covers initial fetch
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.black} />
        </View>
      </SafeAreaView>
    );
  }

  // Graceful state for an unknown id — never throws.
  if (!event) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.notFound}>Event not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const priceLabel = formatPrice(event.price, event.is_free);
  const displayPrice = priceLabel === 'FREE' ? 'Free' : priceLabel;
  const dateLabel = formatEventDateCompact(event.starts_at);
  const aboutParagraphs = (event.description ?? '').split('\n\n').filter(Boolean);

  async function handleShare() {
    if (!event) return;
    await Share.share({
      message: `${event.title} — ${event.location_name ?? 'Berlin'}`,
    });
  }

  function openInMaps() {
    if (event?.lat == null || event?.lng == null) return;
    const query = `${event.lat},${event.lng}`;
    const url = Platform.select({
      ios: `http://maps.apple.com/?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
    Linking.openURL(url);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header — back / share / bookmark */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.navRight}>
          {canAccessChat && (
            <TouchableOpacity
              onPress={() => router.push(`/messages/event/${id}`)}
              style={styles.navButton}
              accessibilityLabel="Open event chat"
            >
              <Ionicons name="chatbubble-outline" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleShare} style={styles.navButton}>
            <Ionicons name="share-outline" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleToggleSave} style={styles.navButton}>
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={colors.text.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
      >
        {/* Hero image */}
        {event.poster_url ? (
          <Image source={{ uri: event.poster_url }} style={styles.hero} resizeMode="cover" />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]} />
        )}

        <View style={styles.body}>
          {/* Title + location */}
          <Text style={styles.title}>{event.title}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={15} color={colors.text.tertiary} />
            <Text style={styles.locationText}>
              {event.location_name ?? event.address ?? 'Berlin'}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Artist / host row — tap the artist to open their profile */}
          <View style={styles.artistRow}>
            <TouchableOpacity
              style={styles.artistTappable}
              onPress={() => router.push(`/user/${event.creator_id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.avatarWrap}>
                <Avatar
                  uri={event.creator?.avatar_url}
                  name={event.creator?.display_name ?? ''}
                  size={48}
                />
                {/* Verified badge — deferred (see BACKLOG.md), no real column yet */}
              </View>

              <View style={styles.artistInfo}>
                <Text style={styles.artistName}>
                  {event.creator?.display_name ?? 'Host'}
                </Text>
                <Text style={styles.artistStats}>
                  {(event.creator?.disciplines ?? []).slice(0, 2).join(' · ') || 'Berlin'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.followButton, isFollowing && styles.followButtonActive]}
              onPress={() => setIsFollowing((v) => !v)}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.followText, isFollowing && styles.followTextActive]}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* About */}
          <Text style={styles.sectionHeading}>About</Text>
          <View>
            {aboutParagraphs.map((para, i) => (
              <Text
                key={i}
                style={styles.aboutText}
                numberOfLines={aboutExpanded ? undefined : i === 0 ? 6 : 4}
              >
                {para}
              </Text>
            ))}
          </View>
          <TouchableOpacity onPress={() => setAboutExpanded((v) => !v)} activeOpacity={0.7}>
            <Text style={styles.readMore}>
              {aboutExpanded ? 'Read less' : 'Read more >'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Location — fall back to "Location TBA" when the host didn't
              provide an address. Event still appears in the feed; it just
              isn't on the map. */}
          <Text style={styles.sectionHeading}>Location</Text>
          {event.location_name || event.address ? (
            <>
              {event.location_name && (
                <Text style={styles.venueName}>{event.location_name}</Text>
              )}
              {event.address && <Text style={styles.address}>{event.address}</Text>}
            </>
          ) : (
            <Text style={styles.address}>Location TBA</Text>
          )}

          <TouchableOpacity
            style={styles.mapBox}
            onPress={openInMaps}
            activeOpacity={0.85}
          >
            <View style={styles.mapPin}>
              <Ionicons name="location" size={26} color={colors.white} />
            </View>
            <Text style={styles.mapHint}>Open in Maps</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sticky bottom booking bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom || spacing.md }]}>
        <View style={styles.priceBlock}>
          <Text style={styles.price}>{displayPrice}</Text>
          <Text style={styles.bookingDate}>{dateLabel}</Text>
        </View>
        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => setRegistrationOpen(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.bookButtonText}>Get Booked</Text>
        </TouchableOpacity>
      </View>

      {/* Event registration popup */}
      <EventRegistrationSheet
        visible={registrationOpen}
        event={event}
        onClose={() => setRegistrationOpen(false)}
        onRegister={async (details) => {
          if (!user) {
            throw new Error('Please sign in to register.');
          }
          await registerForEvent(details.eventId, user.id, details.quantity);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: typography.fontSize.base, color: colors.text.tertiary },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  navButton: { padding: spacing.sm },
  navRight: { flexDirection: 'row', alignItems: 'center' },

  hero: {
    height: 360,
    marginHorizontal: spacing.base,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  heroPlaceholder: { backgroundColor: colors.surface },

  body: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },

  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 26,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    lineHeight: 32,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  locationText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    color: colors.text.tertiary,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },

  // Artist row
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  artistTappable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrap: { width: 48, height: 48 },
  verifiedBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: colors.white,
    borderRadius: 10,
  },
  artistInfo: { flex: 1, gap: 2 },
  artistName: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 17,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  artistStats: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: colors.text.tertiary,
  },
  followButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.black,
  },
  followButtonActive: {
    backgroundColor: colors.black,
  },
  followText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    fontWeight: typography.fontWeight.semibold,
    color: colors.black,
  },
  followTextActive: { color: colors.white },

  // Sections
  sectionHeading: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 20,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  aboutText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  readMore: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  venueName: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  address: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    color: colors.text.secondary,
    marginTop: 2,
  },
  mapBox: {
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapPin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapHint: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: colors.text.tertiary,
  },

  // Sticky booking bar
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 12,
  },
  priceBlock: { gap: 2 },
  price: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  bookingDate: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: colors.text.tertiary,
  },
  bookButton: {
    backgroundColor: colors.black,
    borderRadius: radius.full,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.base,
  },
  bookButtonText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 16,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
});
