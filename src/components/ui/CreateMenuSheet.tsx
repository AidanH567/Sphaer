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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius, motion } from '@/constants/theme';

interface CreateMenuSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface MenuOption {
  title: string;
  subtitle: string;
  onPress: () => void;
}

const SHEET_HEIGHT = 340;
const ANIMATION_DURATION = motion.duration.standard;

export function CreateMenuSheet({ visible, onClose }: CreateMenuSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Controls whether the Modal is actually mounted — stays true until close animation finishes
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
    } else {
      // Animate out first, then unmount
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
        // finished:false = a reopen interrupted this close (setValue stops
        // the animation and fires the callback) — keep the Modal mounted.
        if (finished) setModalMounted(false);
      });
    }
    // translateY/backdropOpacity are stable useRef instances — listed only
    // to satisfy exhaustive-deps; the effect still fires on `visible` alone.
  }, [visible, translateY, backdropOpacity]);

  function handleActivityPress() {
    onClose();
    // Small delay so the sheet closes before navigating
    setTimeout(() => router.push('/(tabs)/create'), 300);
  }

  function handleCirclePress() {
    onClose();
    setTimeout(() => router.push('/(tabs)/create/circle' as any), 300);
  }

  /**
   * "A poster" is a SHORTCUT into the activity form, not a screen of its own.
   *
   * The generator has shipped since the families landed, but it lives in
   * section 5 of a twelve-section form and this row said "Coming Soon" — so
   * the one place a person looks for it was the one place that denied it
   * existed. Aidan failed to find the feature twice, and this alert is why.
   *
   * `poster=1` is read by the create screen, which opens with the poster block
   * expanded, scrolled to, and explaining what it still needs. A poster is made
   * FROM an activity's title and start time, so there is nothing to open
   * without one — a standalone maker belongs to the editor phase, when posters
   * become persisted documents rather than an event's cover.
   */
  function handlePosterPress() {
    onClose();
    setTimeout(() => router.push('/(tabs)/create?poster=1'), 300);
  }

  const OPTIONS: MenuOption[] = [
    {
      title: 'An activity',
      subtitle: 'Workshop, event or soft invitation',
      onPress: handleActivityPress,
    },
    {
      title: 'A circle',
      subtitle: 'Bring your people together.',
      onPress: handleCirclePress,
    },
    {
      title: 'A poster',
      subtitle: 'Make a cover from your title and date',
      onPress: handlePosterPress,
    },
  ];

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
            { opacity: backdropOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) },
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
        {/* Handle */}
        <View style={styles.handle} />

        {/* Options */}
        <View style={styles.options}>
          {OPTIONS.map((option, index) => (
            <React.Fragment key={option.title}>
              <TouchableOpacity
                style={styles.row}
                onPress={option.onPress}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{option.title}</Text>
                  <Text style={styles.rowSubtitle}>{option.subtitle}</Text>
                </View>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={option.onPress}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Create ${option.title.toLowerCase()}`}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.white} />
                </TouchableOpacity>
              </TouchableOpacity>
              {index < OPTIONS.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Cancel */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onClose}
          activeOpacity={0.7}
          accessibilityRole="button"
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    // shadow
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
  options: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    gap: spacing.base,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  rowSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    lineHeight: 18,
  },
  addButton: {
    width: 86,
    height: 48,
    borderRadius: 30,
    backgroundColor: colors.neutral.chocolate,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  cancelButton: {
    marginTop: spacing.lg,
    height: 52,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
});
