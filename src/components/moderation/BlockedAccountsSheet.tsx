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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { colors, spacing, typography, radius, motion } from '@/constants/theme';
import { useAuthContext } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import {
  listBlockedProfiles,
  unblockUser,
  ModerationUnavailableError,
} from '@/services/moderation.service';
import type { Profile } from '@/types/user.types';

interface BlockedAccountsSheetProps {
  visible: boolean;
  onClose: () => void;
}

const SHEET_HEIGHT = 520;
const ANIMATION_DURATION = motion.duration.standard;

/**
 * Settings → "Blocked accounts" list (App Store Guideline 1.2 — blocking
 * must be reversible). Each row shows the blocked person plus an Unblock
 * button. Same animate-out-before-unmount Modal chrome as ConfirmSheet /
 * EntityListSheet.
 *
 * Self-loads from listBlockedProfiles every time it opens, so an unblock
 * done elsewhere (a profile/DM screen) is reflected. Unblocking refreshes
 * both this list and the global blockedIds set. Degrades to the empty state
 * when the blocked_users table doesn't exist yet (read returns []).
 */
export function BlockedAccountsSheet({ visible, onClose }: BlockedAccountsSheetProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const { refreshBlocked } = useAppContext();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Keeps the Modal mounted while the close animation finishes.
  const [modalMounted, setModalMounted] = useState(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  // Id currently being unblocked — drives the per-row spinner and disables
  // its button. null = no unblock in flight.
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  // Fetch fresh on every open.
  useEffect(() => {
    if (!visible || !user?.id) return;
    let active = true;
    setLoading(true);
    listBlockedProfiles(user.id)
      .then((rows) => {
        if (active) setProfiles(rows);
      })
      .catch(() => {
        // Reads degrade to [] inside the service; a thrown error here means
        // a transient failure — show the empty state rather than a crash.
        if (active) setProfiles([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible, user?.id]);

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
        // finished:false = a reopen interrupted this close — keep mounted.
        if (finished) setModalMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate on visibility flips only; Animated refs are stable, modalMounted read for the close guard
  }, [visible]);

  async function handleUnblock(profile: Profile) {
    if (!user?.id || unblockingId) return;
    setUnblockingId(profile.id);
    try {
      await unblockUser(user.id, profile.id);
      // Drop the row immediately, then sync the global set.
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
      await refreshBlocked();
    } catch (e: unknown) {
      // ModerationUnavailableError can't actually fire here (the read that
      // populated this list already proved the table exists), but handle it
      // for completeness — leave the row in place so nothing looks unblocked
      // when it isn't.
      if (!(e instanceof ModerationUnavailableError) && __DEV__) {
        console.error('[BlockedAccountsSheet] unblock failed:', e);
      }
    } finally {
      setUnblockingId(null);
    }
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
                outputRange: [0, 0.45],
              }),
            },
          ]}
        />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.sheet,
          { height: SHEET_HEIGHT, paddingBottom: insets.bottom || spacing.lg, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.handle} />

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Blocked accounts</Text>
            <Text style={styles.subtitle}>
              They can&apos;t message you or see your activities in their feed.
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

        {loading ? (
          <View style={styles.stateArea}>
            <ActivityIndicator color={colors.neutral.chocolate} />
          </View>
        ) : profiles.length === 0 ? (
          <View style={styles.stateArea}>
            <Ionicons name="people-outline" size={40} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>You haven&apos;t blocked anyone.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {profiles.map((profile, index) => {
              const name = profile.display_name ?? profile.username ?? 'Unknown';
              const busy = unblockingId === profile.id;
              return (
                <View
                  key={profile.id}
                  style={[styles.row, index < profiles.length - 1 && styles.rowDivider]}
                >
                  <Avatar uri={profile.avatar_url} name={name} size={44} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {name}
                    </Text>
                    {profile.username && (
                      <Text style={styles.rowHandle} numberOfLines={1}>
                        @{profile.username}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.unblockButton, busy && styles.unblockButtonBusy]}
                    onPress={() => handleUnblock(profile)}
                    disabled={busy}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Unblock ${name}`}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={colors.neutral.chocolate} />
                    ) : (
                      <Text style={styles.unblockText}>Unblock</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
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
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  emptyText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  list: {
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  rowHandle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  unblockButton: {
    minWidth: 92,
    height: 38,
    paddingHorizontal: spacing.base,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.neutral.hiddenLines,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unblockButtonBusy: {
    opacity: 0.6,
  },
  unblockText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.chocolate,
  },
});
