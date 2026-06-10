import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useEvent } from '@/hooks/useEvents';
import { useAuthContext } from '@/context/AuthContext';
import { getRegistration } from '@/services/registrations.service';
import { shareEvent } from '@/services/share.service';
import { colors, typography, spacing } from '@/constants/theme';
import type { EventRegistration } from '@/services/registrations.service';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

// Figma 4025:5364 — ticket detail. Dark backdrop, white ticket card with
// side notches (classic ticket silhouette), QR centered, event title +
// date below, boilerplate paragraph, four-button action stack.

const BACKDROP = '#1B1B18';
const CARD_BG = colors.white;
const NOTCH_SIZE = 24; // diameter of the semicircle cutouts on each side
const QR_SIZE = 200;

export default function TicketDetailScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const { event, isLoading: eventLoading } = useEvent(eventId);
  const [registration, setRegistration] = useState<EventRegistration | null>(null);
  const [regLoading, setRegLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !eventId) {
      setRegLoading(false);
      return;
    }
    let cancelled = false;
    getRegistration(eventId, user.id)
      .then((r) => {
        if (!cancelled) setRegistration(r);
      })
      .catch((err) => console.error('[Ticket] load registration failed:', err))
      .finally(() => {
        if (!cancelled) setRegLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, eventId]);

  const isLoading = eventLoading || regLoading;

  async function handleInviteFriends() {
    if (!event) return;
    try {
      // Delegate to the shared share helper so the canonical URL +
      // platform-tuned payload is consistent with event detail / circle /
      // profile share buttons.
      await shareEvent(event);
    } catch (err) {
      console.error('[Ticket] share failed:', err);
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.backdrop, styles.center]}>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }

  if (!event || !registration) {
    return (
      <SafeAreaView style={styles.backdrop} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>
            No ticket found for this event. You need to register first.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const dateLabel = formatTicketDate(event.starts_at);
  const qrPayload = `https://sphaer.app/check-in?e=${event.id}&u=${user?.id ?? ''}`;
  const showQuantityBadge = (registration.quantity ?? 1) > 1;

  return (
    <SafeAreaView style={styles.backdrop} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Ticket</Text>
        <View style={styles.navButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Ticket card with side notches */}
        <View style={styles.cardWrapper}>
          <View style={styles.card}>
            <View style={styles.qrWrap}>
              <QRCode
                value={qrPayload}
                size={QR_SIZE}
                color={BACKDROP}
                backgroundColor={CARD_BG}
              />
              {showQuantityBadge && (
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyBadgeText}>×{registration.quantity}</Text>
                </View>
              )}
            </View>

            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventDate}>{dateLabel}</Text>

            <Text style={styles.bodyText}>
              By reserving a seat for {event.title}, you confirm your participation for the selected
              session. If you can no longer attend, please cancel in advance so the spot can be
              offered to someone else. This activity is intended as a respectful and collaborative
              space for learning, exchange, and community participation.
            </Text>
          </View>
          {/* Side notches — absolutely positioned circles colored as the backdrop */}
          <View style={[styles.notch, styles.notchLeft]} />
          <View style={[styles.notch, styles.notchRight]} />
        </View>

        <View style={styles.actions}>
          {/* "Download as PDF" / "Send by Email" used to live here behind
              Alert("Coming soon") stubs — removed for v1 to avoid showing
              users dead controls. Re-add behind real implementations
              (expo-print for PDF + Supabase edge function for email)
              when those land — tracked in BACKLOG. */}
          <TouchableOpacity
            style={[styles.actionButton, styles.actionPrimary]}
            onPress={handleInviteFriends}
            activeOpacity={0.85}
          >
            <Text style={styles.actionPrimaryText}>Invite Friends</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionOutline]}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={styles.actionOutlineText}>Done</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** "Fri.03. April" — matches the Figma's quirky date format. */
function formatTicketDate(dateStr: string): string {
  const d = new Date(dateStr);
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const day = d.toLocaleDateString('en-GB', { day: '2-digit' });
  const month = d.toLocaleDateString('en-GB', { month: 'long' });
  return `${weekday}.${day}. ${month}`;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: BACKDROP },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.white,
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },

  // Ticket card
  cardWrapper: {
    position: 'relative',
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  // Notches sit on the seam between the QR section (top) and the info
  // section (bottom) — roughly where the visual perforation would be on a
  // real ticket. The QR is ~280px tall (including its wrap + padding), so
  // the notch line lands a bit below it.
  notch: {
    position: 'absolute',
    width: NOTCH_SIZE,
    height: NOTCH_SIZE,
    borderRadius: NOTCH_SIZE / 2,
    backgroundColor: BACKDROP,
    top: 304,
  },
  notchLeft: { left: -NOTCH_SIZE / 2 },
  notchRight: { right: -NOTCH_SIZE / 2 },

  qrWrap: {
    padding: spacing.md,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    position: 'relative',
    // Drop shadow for the "sticker" feel from the Figma. iOS uses
    // shadow* props; Android falls back to elevation.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  qtyBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: BACKDROP,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
  },
  qtyBadgeText: {
    color: colors.white,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  eventTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#6F6E6A',
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: typography.fontSize.md * 1.3,
  },
  eventDate: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#6F6E6A',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  // Monospace gives the "boarding pass / terms" feel from the Figma.
  // Platform.select keeps it native-system on each side.
  bodyText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    lineHeight: typography.fontSize.xs * 1.6,
    marginTop: spacing.lg,
    fontFamily: Platform.select({
      ios: 'Courier',
      android: 'monospace',
      default: 'Courier',
    }),
    alignSelf: 'stretch',
  },

  // Actions
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    height: 50,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  actionHalf: { flex: 1 },
  // Outline buttons match the Figma: white background, dark text, very
  // subtle light-gray border. They sit on the dark backdrop so the white
  // fill provides the contrast.
  actionOutline: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#D7D6D1',
  },
  actionOutlineText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  // The single inverted button — dark fill, white text.
  actionPrimary: {
    backgroundColor: BACKDROP,
  },
  actionPrimaryText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('ticket-detail');
