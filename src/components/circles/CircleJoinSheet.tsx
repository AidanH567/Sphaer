import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, Animated, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius, motion } from '@/constants/theme';
import { useAuthContext } from '@/context/AuthContext';
import { joinCircle, isMember } from '@/services/circles.service';
import type { CircleWithCounts } from '@/types/circle.types';

interface CircleJoinSheetProps {
  /** The circle to preview. `null` keeps the sheet closed. */
  circle: CircleWithCounts | null;
  onClose: () => void;
  /** Optional: fires after a successful join so the parent can refetch. */
  onJoined?: () => void;
}

const SHEET_HEIGHT = 460;
const ANIMATION_DURATION = motion.duration.standard;

/**
 * Bottom sheet shown when a circle card is tapped. Mirrors the open/close
 * animation pattern of CreateMenuSheet: animate out fully before unmounting
 * so the slide-down is never cut off.
 *
 * Pressing "Join Circle" inserts the membership row via Supabase, then
 * routes to the circle detail page. If the user is already a member, the
 * button label flips to "View circle" and just navigates.
 */
export function CircleJoinSheet({ circle, onClose, onJoined }: CircleJoinSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Modal stays mounted until the close animation finishes.
  const [modalMounted, setModalMounted] = useState(false);
  // Keep rendering the last circle while the sheet slides away.
  const [shown, setShown] = useState<CircleWithCounts | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [busy, setBusy] = useState(false);
  // Post-join confirmation state — Figma "welcoming to circle (3 second)"
  // overlay 6274:8793. While true the sheet shows the bordered-circle
  // welcome card, then routes on to the circle page (tap skips the dwell).
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    if (circle) {
      setShown(circle);
      setModalMounted(true);
      setAlreadyMember(false);
      setWelcome(false);
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

      // Check membership in the background — flips the CTA label if needed.
      if (user) {
        isMember(user.id, circle.id)
          .then(setAlreadyMember)
          .catch(() => setAlreadyMember(false));
      }
    } else if (modalMounted) {
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
      ]).start(() => setModalMounted(false));
    }
  }, [circle, user]);

  function goToCircle(id: string) {
    onClose();
    setTimeout(() => router.push(`/circles/${id}` as any), 300);
  }

  // Dwell on the welcome card, then route. Closing the sheet (backdrop)
  // mid-dwell cancels the navigation — the cleanup clears the timer.
  useEffect(() => {
    if (!welcome || !shown) return;
    const timer = setTimeout(() => goToCircle(shown.id), 2600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timer keyed on welcome only
  }, [welcome]);

  async function handleJoin() {
    if (!shown || busy) return;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to join circles.');
      return;
    }

    // If already a member, just navigate
    if (alreadyMember) {
      goToCircle(shown.id);
      return;
    }

    setBusy(true);
    try {
      await joinCircle(user.id, shown.id);
      onJoined?.();
      setWelcome(true);
    } catch (e: unknown) {
      Alert.alert('Could not join', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!shown) return null;

  return (
    <Modal
      visible={modalMounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
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
                outputRange: [0, 0.45],
              }),
            },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Sheet — Figma Overlay_Card 6274:8777 */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(40, (insets.bottom || 0) + spacing.base) },
          { transform: [{ translateY }] },
        ]}
      >
        {welcome ? (
          /* Figma 6274:8793 — bordered-circle welcome card; tap skips. */
          <TouchableOpacity
            style={styles.welcomeArea}
            onPress={() => goToCircle(shown.id)}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={`Welcome to ${shown.name}`}
            accessibilityHint="Opens the circle"
          >
            <View style={styles.welcomeCircle}>
              <Text style={styles.welcomeText}>
                Welcome to the{'\n'}
                {shown.name}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.hero}>
              {shown.avatar_url ? (
                <Image source={{ uri: shown.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="people" size={56} color={colors.text.tertiary} />
                </View>
              )}

              <View style={styles.titleBlock}>
                <Text style={styles.name}>{shown.name}</Text>
                <Text style={styles.meta}>
                  {shown.members_count.toLocaleString('de-DE')} members{' · '}
                  {shown.activities_count} activities
                </Text>
              </View>
            </View>

            {shown.description && (
              <Text style={styles.description}>{shown.description}</Text>
            )}

            <TouchableOpacity
              style={[styles.joinButton, busy && { opacity: 0.6 }]}
              onPress={handleJoin}
              activeOpacity={0.85}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={alreadyMember ? 'View circle' : 'Join circle'}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.joinButtonText}>
                  {alreadyMember ? 'View circle' : 'Join Circle'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={colors.neutral.chocolate} />
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

// Figma: 190px circle hero, gap rhythm 20 (sections) / 12 (hero) / 4 (title).
const AVATAR_SIZE = 190;

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
    minHeight: SHEET_HEIGHT,
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 32,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
    gap: 20,
    // Figma: 0 -4 11.75 rgba(0,0,0,0.2)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 11.75,
    elevation: 16,
  },
  hero: {
    alignItems: 'center',
    gap: 12,
  },
  titleBlock: {
    alignItems: 'center',
    gap: 4,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surface,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: typography.fontFamily.display,
    fontSize: 24,
    lineHeight: 28, // Figma: 117%
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.chocolate,
    textAlign: 'center',
  },
  meta: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.semibold,
    // Figma neutral/neutral-400 as used on this card (#A5A5A5 — the board
    // exports a lighter 400 here than theme.neutral.neutral400's #9E9D94).
    color: '#A5A5A5',
    textAlign: 'center',
  },
  description: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.chocolate,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 270,
  },
  joinButton: {
    minWidth: 148,
    height: 50,
    paddingHorizontal: 32,
    backgroundColor: colors.neutral.chocolate,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    // Figma Neutral/Slave Cream — the warm off-white used on dark CTAs.
    color: '#FFFEFB',
  },

  // ── Post-join welcome (Figma 6274:8793) ─────────────────────────
  welcomeArea: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  welcomeCircle: {
    width: 254,
    height: 255,
    borderRadius: 254 / 2,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  welcomeText: {
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.chocolate,
    textAlign: 'center',
  },
});
