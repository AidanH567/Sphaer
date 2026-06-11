import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { EntityListSheet } from '@/components/ui/EntityListSheet';
import { EventRegistrationSheet } from '@/components/ui/EventRegistrationSheet';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { formatEventDateCompact } from '@/utils/date';
import { formatPrice } from '@/utils/format';
import { useEvent } from '@/hooks/useEvents';
import { EventMapPreview } from '@/components/events/EventMapPreview';
import { EventDetailSkeleton } from '@/components/ui/skeletons/EventDetailSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { useAuthContext } from '@/context/AuthContext';
import { useMessagesContext } from '@/context/MessagesContext';
import {
  getEventRegistrants,
  register as registerForEvent,
} from '@/services/registrations.service';
import { shareEvent } from '@/services/share.service';
import { addEventToCalendar } from '@/services/calendar.service';
import {
  deleteEvent,
  isEventSaved as isEventSavedService,
  saveEvent,
  unsaveEvent,
} from '@/services/events.service';
import {
  followUser,
  unfollowUser,
  isFollowing as isFollowingService,
} from '@/services/profile.service';
import type { Profile } from '@/types/user.types';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { event, isLoading, error, refetch } = useEvent(id);
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
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  // Creator-only attendees sheet (people registered for this activity).
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [attendees, setAttendees] = useState<Profile[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);

  // In-flight guards — rapid taps on Save / Follow must not double-fire the
  // network call. Refs (not state) so the guard flips synchronously.
  const saveBusyRef = useRef(false);
  const followBusyRef = useRef(false);

  // Refetch on re-focus (not on the initial mount — useEvent already fetched)
  // so changes saved on the edit screen show immediately after router.back().
  const hasFocusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      refetch();
    }, [refetch])
  );

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

  // Hydrate the artist-row Follow state from the DB once the event (and its
  // creator id) is known. Skipped on own events — the button isn't rendered.
  useEffect(() => {
    const creatorId = event?.creator_id;
    if (!user?.id || !creatorId || user.id === creatorId) return;
    let cancelled = false;
    isFollowingService(user.id, creatorId)
      .then((following) => {
        if (!cancelled) setIsFollowing(following);
      })
      .catch((err) => console.error('[EventDetail] load isFollowing failed:', err));
    return () => {
      cancelled = true;
    };
  }, [user?.id, event?.creator_id]);

  async function handleToggleSave() {
    if (!user?.id || !id) return;
    if (saveBusyRef.current) return; // double-tap guard
    saveBusyRef.current = true;
    const wasSaved = isSaved;
    setIsSaved((v) => !v); // optimistic flip
    try {
      if (wasSaved) {
        await unsaveEvent(user.id, id);
      } else {
        await saveEvent(user.id, id);
      }
    } catch (err) {
      console.error('[EventDetail] toggleSave failed:', err);
      setIsSaved((v) => !v); // roll back the optimistic flip
    } finally {
      saveBusyRef.current = false;
    }
  }

  async function handleToggleFollow() {
    const creatorId = event?.creator_id;
    if (!user?.id || !creatorId || user.id === creatorId) return;
    if (followBusyRef.current) return; // double-tap guard
    followBusyRef.current = true;
    const wasFollowing = isFollowing;
    setIsFollowing((v) => !v); // optimistic flip
    try {
      if (wasFollowing) {
        await unfollowUser(user.id, creatorId);
      } else {
        await followUser(user.id, creatorId);
      }
    } catch (err) {
      console.error('[EventDetail] toggleFollow failed:', err);
      setIsFollowing((v) => !v); // roll back the optimistic flip
    } finally {
      followBusyRef.current = false;
    }
  }

  function handleOpenAttendees() {
    if (!id) return;
    setAttendeesOpen(true);
    setAttendeesLoading(true);
    getEventRegistrants(id)
      .then(setAttendees)
      .catch((err) => console.error('[EventDetail] load attendees failed:', err))
      .finally(() => setAttendeesLoading(false));
  }

  // Loading state — covers initial fetch
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.navButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        <EventDetailSkeleton />
      </SafeAreaView>
    );
  }

  // Network / fetch failure — recoverable, offer retry.
  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.navButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        <ErrorState
          icon="cloud-offline-outline"
          title="Couldn't load this event"
          body={error}
          onRetry={refetch}
          onBack={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  // Graceful state for an unknown id — never throws.
  if (!event) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.navButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        <ErrorState
          icon="calendar-outline"
          title="Event not found"
          body="This event may have been cancelled or removed. Head back to the feed to discover what's on."
          onBack={() => router.back()}
          backLabel="Back to feed"
        />
      </SafeAreaView>
    );
  }

  const priceLabel = formatPrice(event.price, event.is_free);
  const displayPrice = priceLabel === 'FREE' ? 'Free' : priceLabel;
  const dateLabel = formatEventDateCompact(event.starts_at);
  const aboutParagraphs = (event.description ?? '').split('\n\n').filter(Boolean);
  const isCreator = user?.id === event.creator_id;

  async function handleShare() {
    if (!event) return;
    try {
      await shareEvent(event);
    } catch (err) {
      console.error('[EventDetail] share failed:', err);
    }
  }

  async function handleAddToCalendar() {
    if (!event) return;
    try {
      await addEventToCalendar(event);
    } catch (err) {
      console.error('[EventDetail] add to calendar failed:', err);
    }
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
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.navRight}>
          {isCreator && (
            <TouchableOpacity
              onPress={() => router.push(`/event/edit/${id}`)}
              style={styles.navButton}
              accessibilityRole="button"
              accessibilityLabel="Edit activity"
            >
              <Ionicons name="create-outline" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          )}
          {isCreator && (
            <TouchableOpacity
              onPress={() => setDeleteConfirmVisible(true)}
              style={styles.navButton}
              accessibilityRole="button"
              accessibilityLabel="Delete activity"
            >
              <Ionicons name="trash-outline" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          )}
          {isCreator && (
            <TouchableOpacity
              onPress={handleOpenAttendees}
              style={styles.navButton}
              accessibilityRole="button"
              accessibilityLabel="View attendees"
            >
              <Ionicons name="people-outline" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          )}
          {canAccessChat && (
            <TouchableOpacity
              onPress={() => router.push(`/ticket/${id}`)}
              style={styles.navButton}
              accessibilityRole="button"
              accessibilityLabel="View ticket"
            >
              <Ionicons name="ticket-outline" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          )}
          {canAccessChat && (
            <TouchableOpacity
              onPress={() => router.push(`/messages/event/${id}`)}
              style={styles.navButton}
              accessibilityRole="button"
              accessibilityLabel="Open event chat"
            >
              <Ionicons name="chatbubble-outline" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleAddToCalendar}
            style={styles.navButton}
            accessibilityRole="button"
            accessibilityLabel="Add to calendar"
          >
            <Ionicons name="calendar-outline" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShare}
            style={styles.navButton}
            accessibilityRole="button"
            accessibilityLabel="Share event"
          >
            <Ionicons name="share-outline" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleToggleSave}
            style={styles.navButton}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Remove from saved' : 'Save event'}
          >
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
          <Image source={{ uri: event.poster_url }} style={styles.hero} contentFit="cover" />
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
              accessibilityRole="button"
              accessibilityLabel={`Open ${event.creator?.display_name ?? 'host'}'s profile`}
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

            {/* Hidden on your own event — you can't follow yourself. */}
            {!isCreator && (
              <TouchableOpacity
                style={[styles.followButton, isFollowing && styles.followButtonActive]}
                onPress={handleToggleFollow}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={
                  isFollowing
                    ? `Unfollow ${event.creator?.display_name ?? 'host'}`
                    : `Follow ${event.creator?.display_name ?? 'host'}`
                }
                accessibilityState={{ selected: isFollowing }}
              >
                <Text
                  style={[styles.followText, isFollowing && styles.followTextActive]}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
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
          <TouchableOpacity
            onPress={() => setAboutExpanded((v) => !v)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded: aboutExpanded }}
          >
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

          {/* Map preview — real interactive Google Map (react-native-maps
              on native, @vis.gl/react-google-maps on web). User can pinch-
              zoom / pan inside the embed; the "Open in Maps" pill in the
              corner is the explicit affordance for launching Apple/Google
              Maps externally. When the event has no coordinates we fall
              back to the original gray tile. */}
          {event.lat != null && event.lng != null ? (
            <EventMapPreview
              lat={event.lat}
              lng={event.lng}
              title={event.location_name ?? undefined}
              onOpenInMaps={openInMaps}
            />
          ) : (
            <View style={styles.mapBox}>
              <View style={styles.mapPin}>
                <Ionicons name="location" size={26} color={colors.text.tertiary} />
              </View>
              <Text style={styles.mapHint}>Location coordinates unavailable</Text>
            </View>
          )}
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
          accessibilityRole="button"
        >
          <Text style={styles.bookButtonText}>Get Booked</Text>
        </TouchableOpacity>
      </View>

      {/* Creator-only delete confirm. On success we replace to the feed —
          the sheet unmounts with the route, so no onClose on the happy path. */}
      <ConfirmSheet
        visible={deleteConfirmVisible}
        title="Delete this activity?"
        message="Registrations and saves will be removed."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!id) return;
          await deleteEvent(id);
          router.replace('/(tabs)/feed');
        }}
        onClose={() => setDeleteConfirmVisible(false)}
      />

      {/* Creator-only attendee list. RLS allows the read for everyone
          (event_registrations_read_all), but the affordance is creator-only
          by design — it's a host tool. */}
      {isCreator && (
        <EntityListSheet
          type="user"
          visible={attendeesOpen}
          title="Attendees"
          subtitle={attendeesLoading ? undefined : `${attendees.length} registered`}
          items={attendees}
          isLoading={attendeesLoading}
          emptyMessage="No one has registered yet."
          onClose={() => setAttendeesOpen(false)}
        />
      )}

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

export const ErrorBoundary = makeRouteErrorBoundary('event-detail');
