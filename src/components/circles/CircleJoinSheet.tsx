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

  useEffect(() => {
    if (circle) {
      setShown(circle);
      setModalMounted(true);
      setAlreadyMember(false);
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

  async function handleJoin() {
    if (!shown || busy) return;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to join circles.');
      return;
    }

    const id = shown.id;

    // If already a member, just navigate
    if (alreadyMember) {
      onClose();
      setTimeout(() => router.push(`/circles/${id}` as any), 300);
      return;
    }

    setBusy(true);
    try {
      await joinCircle(user.id, id);
      onJoined?.();
      onClose();
      setTimeout(() => router.push(`/circles/${id}` as any), 300);
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

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom || spacing.lg, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.handle} />

        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={22} color={colors.text.primary} />
        </TouchableOpacity>

        {shown.avatar_url ? (
          <Image source={{ uri: shown.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="people" size={40} color={colors.text.tertiary} />
          </View>
        )}

        <Text style={styles.name}>{shown.name}</Text>
        <Text style={styles.meta}>
          {shown.members_count.toLocaleString('de-DE')} members{'  ·  '}
          {shown.activities_count} activities
        </Text>

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
      </Animated.View>
    </Modal>
  );
}

const AVATAR_SIZE = 132;

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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.base,
    right: spacing.base,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surface,
    marginTop: spacing.md,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.base,
  },
  meta: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  description: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.md,
  },
  joinButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.black,
    borderRadius: radius.full,
    paddingVertical: spacing.base,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  joinButtonText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 16,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
});
