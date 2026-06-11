import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '@/constants/theme';

interface DateTimeFieldProps {
  label: string;
  value: Date | null;
  onChange: (next: Date | null) => void;
  /** Set to true for optional fields — shows a "Clear" affordance. */
  clearable?: boolean;
  placeholder?: string;
  minimumDate?: Date;
}

/**
 * Tap-to-pick date/time field that matches the Sphaer input chrome.
 * Uses the native picker — modal on Android, inline-modal on iOS.
 *
 * On iOS we present a Modal sheet because the inline picker has poor
 * visual integration with form layouts. On Android the picker is already
 * a system modal, so we just trigger it directly.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  clearable = false,
  placeholder = 'Choose a date & time',
  minimumDate,
}: DateTimeFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(value ?? new Date());

  function openPicker() {
    if (Platform.OS === 'ios') {
      setIosDraft(value ?? new Date());
      setIosOpen(true);
      return;
    }
    // Android: imperative picker
    openAndroidDate();
  }

  // Android shows date picker first, then time picker, then commits.
  function openAndroidDate() {
    const current = value ?? new Date();
    const onPick = (event: DateTimePickerEvent, picked?: Date) => {
      if (event.type !== 'set' || !picked) return;
      const datePart = picked;
      // Chain into time picker
      const timeEvent = (timeEvt: DateTimePickerEvent, timePicked?: Date) => {
        if (timeEvt.type !== 'set' || !timePicked) return;
        const combined = new Date(datePart);
        combined.setHours(timePicked.getHours(), timePicked.getMinutes(), 0, 0);
        onChange(combined);
      };
      // Use imperative `DateTimePickerAndroid` if available — falls back to
      // showing a second inline picker. For simplicity we set state and
      // toggle a second native render via the iOS modal path on Android too.
      onChange(datePart);
      // Time picker shown after a microtask so the date one closes first
      setTimeout(() => {
        // Use the imperative API
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { DateTimePickerAndroid } = require('@react-native-community/datetimepicker');
        DateTimePickerAndroid.open({
          value: datePart,
          mode: 'time',
          is24Hour: true,
          onChange: timeEvent,
        });
      }, 50);
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DateTimePickerAndroid } = require('@react-native-community/datetimepicker');
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      minimumDate,
      onChange: onPick,
    });
  }

  function commitIos() {
    onChange(iosDraft);
    setIosOpen(false);
  }

  function clear() {
    onChange(null);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.box}
          onPress={openPicker}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: value ? formatDateTime(value) : placeholder }}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.text.tertiary} />
          <Text style={[styles.valueText, !value && styles.placeholderText]}>
            {value ? formatDateTime(value) : placeholder}
          </Text>
        </TouchableOpacity>
        {clearable && value && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Clear date"
          >
            <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* iOS inline-modal picker */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={iosOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIosOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setIosOpen(false)} accessibilityRole="button">
                  <Text style={styles.modalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{label}</Text>
                <TouchableOpacity onPress={commitIos} accessibilityRole="button">
                  <Text style={styles.modalDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={iosDraft}
                mode="datetime"
                display="spinner"
                minimumDate={minimumDate}
                onChange={(_evt: DateTimePickerEvent, picked?: Date) =>
                  picked && setIosDraft(picked)
                }
                style={styles.modalPicker}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function formatDateTime(d: Date): string {
  const day = d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day} · ${time}`;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.hiddenLines,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  valueText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  placeholderText: { color: colors.text.placeholder },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  modalCancel: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  modalDone: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.black,
  },
  modalPicker: { height: 220 },
});
