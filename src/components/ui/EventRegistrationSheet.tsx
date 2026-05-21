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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/constants/theme';
import type { MockEvent } from '@/data/mockEvents';

// Exact colours from the Figma SVG export.
const CHOCOLATE = '#2B2A27';
const INK = '#1B1B18';
const GREY = '#B6B6AF';
const DIVIDER = '#CFCEC9';
const BADGE_RED = '#B93D36';
const BADGE_TEXT = '#FAF9F5';
const SECONDARY = 'rgba(30,30,30,0.6)';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const ANIMATION_DURATION = 280;

export interface RegistrationDetails {
  eventId: string;
  eventTitle: string;
  quantity: number;
  total: number;
}

interface EventRegistrationSheetProps {
  visible: boolean;
  event: MockEvent | null;
  onClose: () => void;
  onRegister?: (details: RegistrationDetails) => void;
}

/** "Fri. 03. April" — weekday + 2-digit day + full month. */
function formatRegistrationDate(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const day = d.toLocaleDateString('en-GB', { day: '2-digit' });
  const month = d.toLocaleDateString('en-GB', { month: 'long' });
  return `${weekday}. ${day}. ${month}`;
}

/** "15:00 - 20:00" — spaced start/end range. */
function formatRegistrationTime(startIso: string, endIso?: string | null): string {
  const t = (i: string) =>
    new Date(i).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return endIso ? `${t(startIso)} - ${t(endIso)}` : t(startIso);
}

/**
 * Event Registration popup — slides up from the bottom over the Event Detail
 * page. Mirrors the open/close animation of CreateMenuSheet / CircleJoinSheet:
 * the Modal stays mounted until the slide-down animation finishes.
 */
export function EventRegistrationSheet({
  visible,
  event,
  onClose,
  onRegister,
}: EventRegistrationSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Modal stays mounted through the close animation.
  const [modalMounted, setModalMounted] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (visible) {
      setQuantity(1);
      setModalMounted(true);
      translateY.setValue(SCREEN_HEIGHT);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 22,
          stiffness: 180,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (modalMounted) {
      // Animate out fully, then unmount.
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start(() => setModalMounted(false));
    }
  }, [visible]);

  if (!event) return null;

  const unitPrice = event.is_free ? 0 : event.price ?? 0;
  const total = unitPrice * quantity;
  const admissionPrice = event.is_free ? 'FREE' : `€${unitPrice.toFixed(2)}`;

  const dateLabel = formatRegistrationDate(event.starts_at);
  const timeLabel = formatRegistrationTime(event.starts_at, event.ends_at);

  // Split "Street 1, 12047 Berlin" → street line + city line.
  const addressParts = (event.address ?? '').split(',');
  const streetLine = addressParts[0]?.trim() || event.location_name || 'Berlin';
  const cityLine = addressParts.slice(1).join(',').trim();

  function handleRegister() {
    if (!event) return;
    const details: RegistrationDetails = {
      eventId: event.id,
      eventTitle: event.title,
      quantity,
      total,
    };
    // No payment / Supabase yet — log the intent and confirm.
    console.log('[EventRegistration] register', details);
    onRegister?.(details);
    Alert.alert(
      "You're registered",
      `${quantity} x Admission for "${event.title}".`,
    );
    onClose();
  }

  return (
    <Modal
      visible={modalMounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Dimmed backdrop — tap to dismiss */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.55],
                }),
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Sliding content — transparent gaps fall through to the backdrop */}
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }]}
          pointerEvents="box-none"
        >
          {/* Close button */}
          <View style={[styles.closeRow, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={26} color={CHOCOLATE} />
            </TouchableOpacity>
          </View>

          {/* White registration card */}
          <View style={styles.card}>
            <Text style={styles.title}>{event.title}</Text>
            <Text style={styles.organiser}>
              Organised by: {event.creator?.display_name ?? 'Host'}
            </Text>

            {/* Ticket quantity controls */}
            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={[styles.qtyButton, quantity <= 1 && styles.qtyButtonDisabled]}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={20} color={quantity <= 1 ? GREY : CHOCOLATE} />
              </TouchableOpacity>

              <Text style={styles.qtyValue}>{quantity}</Text>

              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => setQuantity((q) => q + 1)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={20} color={CHOCOLATE} />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Date / time row */}
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={22} color={INK} style={styles.infoIcon} />
              <View style={styles.infoText}>
                <Text style={styles.infoPrimary}>{dateLabel}</Text>
                <Text style={styles.infoSecondary}>{timeLabel}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Location row */}
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={22} color={INK} style={styles.infoIcon} />
              <View style={styles.infoText}>
                <Text style={styles.infoPrimary}>{streetLine}</Text>
                {!!cityLine && <Text style={styles.infoSecondary}>{cityLine}</Text>}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Admission row */}
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Ionicons name="ticket-outline" size={22} color={INK} style={styles.infoIcon} />
              <View style={styles.infoText}>
                <Text style={styles.infoPrimary}>{quantity} x Admission</Text>
                <Text style={styles.infoSecondary}>{admissionPrice}</Text>
              </View>
            </View>
          </View>

          {/* Bottom bar — badge, price summary, Register */}
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom || spacing.lg }]}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>FEW TICKETS LEFT</Text>
            </View>

            <View style={styles.priceRow}>
              <Ionicons name="information-circle-outline" size={18} color={INK} />
              <Text style={styles.priceText}>€{total.toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              style={styles.registerButton}
              onPress={handleRegister}
              activeOpacity={0.85}
            >
              <Text style={styles.registerText}>Register</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },

  closeRow: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // White registration card
  card: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.white,
    borderRadius: 40,
    paddingTop: 34,
    paddingHorizontal: 30,
    paddingBottom: 28,
    // soft drop shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: typography.fontWeight.semibold,
    color: CHOCOLATE,
  },
  organiser: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: SECONDARY,
    marginTop: spacing.sm,
  },

  // Quantity controls
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  qtyButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: CHOCOLATE,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonDisabled: {
    borderColor: GREY,
  },
  qtyValue: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 18,
    fontWeight: typography.fontWeight.medium,
    color: CHOCOLATE,
    width: 42,
    textAlign: 'center',
  },

  divider: {
    height: 1,
    backgroundColor: DIVIDER,
    marginVertical: spacing.base,
  },

  // Info rows (date / location / admission)
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
  },
  infoRowLast: {
    paddingBottom: 0,
  },
  infoIcon: {
    marginRight: spacing.base,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    gap: 3,
  },
  infoPrimary: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
    color: INK,
  },
  infoSecondary: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: SECONDARY,
  },

  // Bottom action bar
  bottomBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: '#E0E4EB',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    marginTop: spacing.base,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: BADGE_RED,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.4,
    color: BADGE_TEXT,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.base,
  },
  priceText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 17,
    fontWeight: typography.fontWeight.semibold,
    color: INK,
  },
  registerButton: {
    height: 49,
    borderRadius: 24.5,
    backgroundColor: CHOCOLATE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 16,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
});
