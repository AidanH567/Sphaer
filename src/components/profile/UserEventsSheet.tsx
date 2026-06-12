import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, motion } from '@/constants/theme';
import { formatEventDateShort } from '@/utils/date';
import { getEventsByCreator } from '@/services/events.service';
import { getMyRegisteredEvents } from '@/services/registrations.service';
import type { EventWithRelations } from '@/types/event.types';

// ─── Data: created ∪ registered ──────────────────────────────────────────────

/**
 * Merge a user's created and registered events into one deduped list.
 *
 * The `register_event_creator` trigger auto-registers creators for their own
 * events, so the two sources overlap almost completely — the Map keeps one
 * row per event id. Exported separately from loadUserActivities so the
 * dedup + ordering is unit-testable without a Supabase client.
 *
 * Ordering flattens EntityListSheet's Upcoming/Past tabs into one list:
 * upcoming soonest-first, then past most-recent-first.
 */
export function mergeUserActivities(
  created: EventWithRelations[],
  registered: EventWithRelations[],
): EventWithRelations[] {
  const byId = new Map<string, EventWithRelations>();
  for (const event of [...created, ...registered]) {
    if (!byId.has(event.id)) byId.set(event.id, event);
  }
  const all = [...byId.values()];
  const now = Date.now();
  const upcoming = all
    .filter((e) => +new Date(e.starts_at) >= now)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const past = all
    .filter((e) => +new Date(e.starts_at) < now)
    .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));
  return [...upcoming, ...past];
}

/**
 * Everything a user is involved in: events they CREATED merged with events
 * they REGISTERED for (Activities v2 #15).
 *
 * Both halves work for any profile, not just the authed user:
 *   - events:               `events_read_all` SELECT USING (TRUE)
 *                           (20240101000000_initial_schema.sql)
 *   - event_registrations:  `event_registrations_read_all` SELECT USING (TRUE)
 *                           (20260527010000_activities_v2.sql)
 *
 * Each source degrades independently — if one query fails the other still
 * renders (mirrors fetchRealProfile's per-query `.catch` in app/user/[id]).
 */
export async function loadUserActivities(userId: string): Promise<EventWithRelations[]> {
  const [created, registered] = await Promise.all([
    getEventsByCreator(userId).catch(() => [] as EventWithRelations[]),
    getMyRegisteredEvents(userId).catch(() => [] as EventWithRelations[]),
  ]);
  return mergeUserActivities(created, registered);
}

// ─── Component ───────────────────────────────────────────────────────────────

interface UserEventsSheetProps {
  visible: boolean;
  /** Header title; the stats row that opens this is labelled "Activities". */
  title?: string;
  /** e.g. "12 total — created or registered". */
  subtitle?: string;
  events: EventWithRelations[];
  isLoading?: boolean;
  emptyMessage?: string;
  onClose: () => void;
}

const SHEET_HEIGHT = Math.round(Dimensions.get('window').height * 0.85);
const ANIMATION_DURATION = motion.duration.standard;
// Navigation fires after the close animation — iOS drops a push performed
// while a Modal is still animating out. Same 300ms as CircleJoinSheet's
// goToCircle / OverflowMenuSheet's ACTION_DELAY_MS.
const NAVIGATE_DELAY_MS = 300;
const POSTER_THUMB = 48;

/**
 * Bottom sheet listing a user's activities (created ∪ registered events),
 * opened from the "Activities" count on /profile and /user/[id]
 * (Activities v2 #15). Same visual chrome as EntityListSheet — white sheet,
 * rounded top, dragger, dimmed backdrop — but with the finished-guarded
 * animate-out-before-unmount lifecycle all sheets use since the
 * OverflowMenuSheet fix (a reopen-during-close must not unmount the Modal).
 *
 * Rows are intentionally more compact than EntityListSheet's activity rows:
 * 48px poster thumb, chocolate Medium title, neutral600 short-date line.
 * Tapping a row closes the sheet, then routes to /event/{id}.
 */
export function UserEventsSheet({
  visible,
  title = 'Activities',
  subtitle,
  events,
  isLoading = false,
  emptyMessage = 'No activities yet',
  onClose,
}: UserEventsSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Keeps the Modal mounted while the close animation finishes.
  const [modalMounted, setModalMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setModalMounted(true);
      translateY.setValue(SHEET_HEIGHT);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          ...motion.spring.sheet,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (modalMounted) {
      // `else if (modalMounted)` + the `finished` guard both matter: the
      // open branch's setValue() STOPS any in-flight close animation and
      // fires its end callback with finished:false — without the guards a
      // reopen-during-close (or the initial mount's no-op close) unmounts
      // the Modal right after it mounts.
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SHEET_HEIGHT,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setModalMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate on visibility flips only; Animated refs are stable, modalMounted read for the close guard
  }, [visible]);

  function goToEvent(id: string) {
    onClose();
    setTimeout(() => router.push(`/event/${id}` as Href), NAVIGATE_DELAY_MS);
  }

  return (
    <Modal
      visible={modalMounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.5],
              }),
            },
          ]}
        />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.sheet, { height: SHEET_HEIGHT, transform: [{ translateY }] }]}
      >
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Body */}
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.black} />
          </View>
        ) : events.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={{ paddingBottom: (insets.bottom || spacing.lg) + spacing.md }}
            showsVerticalScrollIndicator={false}
          >
            {events.map((event, i) => (
              <EventRow
                key={event.id}
                event={event}
                onPress={() => goToEvent(event.id)}
                showDivider={i < events.length - 1}
              />
            ))}
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function EventRow({
  event,
  onPress,
  showDivider,
}: {
  event: EventWithRelations;
  onPress: () => void;
  showDivider: boolean;
}) {
  const dateLabel = formatEventDateShort(event.starts_at);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${dateLabel}`}
    >
      <View style={styles.row}>
        {event.poster_url ? (
          <Image source={{ uri: event.poster_url }} style={styles.posterThumb} />
        ) : (
          <View style={[styles.posterThumb, styles.posterPlaceholder]}>
            <Ionicons name="calendar-outline" size={18} color={colors.text.tertiary} />
          </View>
        )}
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={styles.rowDate} numberOfLines={1}>
            {dateLabel}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </View>
      {showDivider && <View style={styles.divider} />}
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerText: { flex: 1, gap: 2 },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: colors.neutral.meta,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  list: { flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.chocolate,
  },
  rowDate: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: colors.neutral.neutral600,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    // Align with the text column after the poster thumb.
    marginLeft: spacing.xl + POSTER_THUMB + spacing.md,
  },

  posterThumb: {
    width: POSTER_THUMB,
    height: POSTER_THUMB,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
