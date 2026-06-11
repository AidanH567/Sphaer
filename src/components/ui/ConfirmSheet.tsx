import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius, motion } from '@/constants/theme';

interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  /** Label for the primary action button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the dismiss button. Defaults to "Cancel". */
  cancelLabel?: string;
  /**
   * Switches the primary button to red. Use for actions that delete data,
   * sign the user out, leave a circle, etc.
   */
  destructive?: boolean;
  /**
   * Called when the user taps the primary button. If a promise is returned,
   * the sheet shows a spinner on the button until it resolves; on rejection
   * an alert surfaces the error and the sheet stays open.
   */
  onConfirm: () => void | Promise<void>;
  /** Called when the user taps the backdrop or Cancel. Never during confirm. */
  onClose: () => void;
}

const SHEET_OFFSET = 400; // off-screen translate distance
const ANIMATION_DURATION = motion.duration.standard;

/**
 * Slide-up confirm dialog matching CreateMenuSheet's visual chrome
 * (white sheet, rounded top, dragger handle, dimmed backdrop). Designed to
 * be reusable for any destructive-or-not confirm prompt — sign out, leave
 * circle, delete experience, cancel registration, etc.
 *
 * Replaces the cross-platform `window.confirm` / `Alert.alert` branch with
 * an in-app component so the UX is identical on web, iOS, and Android.
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_OFFSET)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Keeps the Modal mounted while the close animation finishes.
  const [modalMounted, setModalMounted] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (visible) {
      setModalMounted(true);
      translateY.setValue(SHEET_OFFSET);
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
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SHEET_OFFSET,
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

  async function handleConfirmPress() {
    if (isConfirming) return;
    try {
      setIsConfirming(true);
      await Promise.resolve(onConfirm());
      // Caller is responsible for closing the sheet on success (typically by
      // flipping `visible` to false in its parent state). We don't auto-close
      // here so callers can keep the sheet open during navigation.
    } catch (e: unknown) {
      Alert.alert('Action failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setIsConfirming(false);
    }
  }

  // Backdrop tap and Cancel button are disabled while a confirm is in-flight
  // so the user can't dismiss mid-action and end up in a half-finished state.
  function handleDismiss() {
    if (isConfirming) return;
    onClose();
  }

  return (
    <Modal
      visible={modalMounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <TouchableWithoutFeedback
        onPress={handleDismiss}
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
          { paddingBottom: insets.bottom || spacing.lg, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.handle} />

        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              destructive ? styles.confirmButtonDestructive : styles.confirmButtonPrimary,
              isConfirming && styles.confirmButtonBusy,
            ]}
            onPress={handleConfirmPress}
            activeOpacity={0.85}
            disabled={isConfirming}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
          >
            {isConfirming ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleDismiss}
            activeOpacity={0.7}
            disabled={isConfirming}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const CHOCOLATE = colors.neutral.chocolate;
const DESTRUCTIVE_RED = colors.badge.red; // '#E53935'

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
  content: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  message: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.sm,
  },
  confirmButton: {
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonPrimary: {
    backgroundColor: CHOCOLATE,
  },
  confirmButtonDestructive: {
    backgroundColor: DESTRUCTIVE_RED,
  },
  confirmButtonBusy: {
    opacity: 0.7,
  },
  confirmText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  cancelButton: {
    height: 52,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
});
