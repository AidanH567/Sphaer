import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  Dimensions,
  Linking,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, motion } from '@/constants/theme';
import { ProfileActivityPanel } from './ProfileActivityPanel';
import { ticketBadgeTarget, TIME_RULE_COPY, type ActivityTab } from '@/utils/profile-activities';
import type { EventWithRelations } from '@/types/event.types';

const SHEET_HEIGHT = Math.round(Dimensions.get('window').height * 0.85);
const ANIMATION_DURATION = motion.duration.standard;
// Navigation fires after the close animation — iOS drops a push performed
// while a Modal is still animating out. Same 300ms as CircleJoinSheet's
// goToCircle / OverflowMenuSheet's ACTION_DELAY_MS.
const NAVIGATE_DELAY_MS = 300;

interface ActivitiesSheetProps {
  visible: boolean;
  tabs: ActivityTab[];
  isLoading?: boolean;
  error?: string | null;
  /**
   * Ids the VIEWER holds a local registration for. Only passed on your own
   * profile — someone else's registrations are not your tickets.
   */
  registeredIds?: Set<string>;
  /** Draw ticket badges. Own profile only, for the same reason. */
  showTickets?: boolean;
  onClose: () => void;
}

/**
 * The Activities sheet — opened by tapping the "Activities" stat on either
 * profile screen, exactly as it was before the (rejected) inline-tab
 * restructure. What is new inside it is the segmented control: All / Going /
 * Saved / Past on your own profile, All / Going / Past on someone else's.
 *
 * Same chrome as EntityListSheet — white sheet, rounded top, dragger, dimmed
 * backdrop — with the finished-guarded animate-out-before-unmount lifecycle
 * every sheet uses since the OverflowMenuSheet fix (a reopen-during-close
 * must not unmount the Modal).
 *
 * The panel is mounted only while the Modal is, which is what guarantees the
 * settled default: every open lands on All, matching the number tapped.
 */
export function ActivitiesSheet({
  visible,
  tabs,
  isLoading = false,
  error,
  registeredIds,
  showTickets = false,
  onClose,
}: ActivitiesSheetProps) {
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

  function closeThenNavigate(href: Href) {
    onClose();
    setTimeout(() => router.push(href), NAVIGATE_DELAY_MS);
  }

  function handleSelectActivity(event: EventWithRelations) {
    closeThenNavigate(`/event/${event.id}` as Href);
  }

  /**
   * The badge is the whole reason there is no Tickets tab: one tap from any
   * category straight to the QR you show at the door.
   *
   * Where the activity is ticketed only through an EXTERNAL `ticket_url` and
   * the viewer never registered here, there is no local QR — /ticket/[id]
   * would render "No ticket found". Those open the external page instead, and
   * the sheet stays put so the user comes back where they were.
   */
  function handleSelectTicket(event: EventWithRelations) {
    const target = ticketBadgeTarget(event, registeredIds?.has(event.id) ?? false);
    if (!target) return;
    if (target.kind === 'local') {
      closeThenNavigate(`/ticket/${target.eventId}` as Href);
    } else {
      Linking.openURL(target.url).catch(() => {});
    }
  }

  const allCount = tabs.find((t) => t.key === 'all')?.count ?? 0;

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

        {/* Header. The subtitle states the upcoming/finished rule outright —
            All/Going/Saved are relationship filters and Past is a time
            filter, and mixing the two axes is only fair if the rule is
            written down rather than inferred. */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Activities</Text>
            <Text style={styles.subtitle}>
              {allCount.toLocaleString('en-US')} total. {TIME_RULE_COPY}
            </Text>
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

        {modalMounted && (
          <ProfileActivityPanel
            tabs={tabs}
            isLoading={isLoading}
            error={error}
            onSelectActivity={handleSelectActivity}
            onSelectTicket={showTickets ? handleSelectTicket : undefined}
            registeredIds={registeredIds}
            bottomInset={insets.bottom || spacing.lg}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerText: { flex: 1, gap: 3 },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 12,
    lineHeight: 17,
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
});
