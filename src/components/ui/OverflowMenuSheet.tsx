import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius, motion } from '@/constants/theme';

export interface OverflowAction {
  /** Row label, action-first ("Report event", "Block user"). Doubles as the
   *  accessibility label. */
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Renders the row in red for actions like Block. */
  destructive?: boolean;
  onPress: () => void;
}

interface OverflowMenuSheetProps {
  visible: boolean;
  actions: OverflowAction[];
  onClose: () => void;
}

const SHEET_OFFSET = 400; // off-screen translate distance
const ANIMATION_DURATION = motion.duration.standard;

// Selecting a row closes this sheet and usually opens another Modal
// (ReportSheet / ConfirmSheet). iOS drops a Modal presented while a sibling
// is still animating out, so the action fires after the close animation —
// same 300ms the CircleJoinSheet uses before navigating.
const ACTION_DELAY_MS = 300;

/**
 * Ellipsis-overflow action sheet shared by the moderation entry points
 * (profile / event / circle / DM headers). Same visual chrome and
 * animate-out-before-unmount Modal pattern as ConfirmSheet.
 */
export function OverflowMenuSheet({ visible, actions, onClose }: OverflowMenuSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_OFFSET)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Keeps the Modal mounted while the close animation finishes.
  const [modalMounted, setModalMounted] = useState(false);

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
    } else if (modalMounted) {
      // `else if (modalMounted)` + the `finished` guard both matter: the
      // open branch's setValue() STOPS any in-flight close animation and
      // fires its end callback with finished:false — without the guards a
      // reopen-during-close (or the initial mount's no-op close) unmounts
      // the Modal right after it mounts.
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
      ]).start(({ finished }) => {
        if (finished) setModalMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate on visibility flips only; Animated refs are stable, modalMounted read for the close guard
  }, [visible]);

  function handleSelect(action: OverflowAction) {
    onClose();
    setTimeout(action.onPress, ACTION_DELAY_MS);
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
          { paddingBottom: insets.bottom || spacing.lg, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.handle} />

        <View>
          {actions.map((action, index) => (
            <React.Fragment key={action.label}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => handleSelect(action)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                {action.icon && (
                  <Ionicons
                    name={action.icon}
                    size={20}
                    color={action.destructive ? colors.badge.red : colors.text.primary}
                  />
                )}
                <Text style={[styles.rowLabel, action.destructive && styles.rowLabelDestructive]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
              {index < actions.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onClose}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
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
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.base,
  },
  rowLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  rowLabelDestructive: {
    color: colors.badge.red,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  cancelButton: {
    marginTop: spacing.md,
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
