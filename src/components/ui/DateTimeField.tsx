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

type DateTimeFieldMode = 'date' | 'time' | 'datetime';

interface DateTimeFieldProps {
  label: string;
  value: Date | null;
  onChange: (next: Date | null) => void;
  /** Set to true for optional fields — shows a "Clear" affordance. */
  clearable?: boolean;
  placeholder?: string;
  minimumDate?: Date;
  /**
   * What the picker edits. 'date' / 'time' open a single-purpose picker and
   * merge the picked part onto the current value (so two fields — one per
   * mode — can co-own the same Date, per Figma 6277:10002's Date + Time row).
   * Default 'datetime' keeps the original date-then-time behaviour.
   */
  mode?: DateTimeFieldMode;
  /** Ionicons glyph rendered inside the box (Figma: calendar / clock). */
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  /** Hide the built-in label text (screen renders its own section label).
   *  The `label` prop still feeds the accessibility label. */
  hideLabel?: boolean;
}

const DEFAULT_PLACEHOLDER: Record<DateTimeFieldMode, string> = {
  date: 'Choose a date',
  time: 'Choose a time',
  datetime: 'Choose a date & time',
};

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
  placeholder,
  minimumDate,
  mode = 'datetime',
  leadingIcon = 'calendar-outline',
  hideLabel = false,
}: DateTimeFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(value ?? new Date());

  const placeholderText = placeholder ?? DEFAULT_PLACEHOLDER[mode];

  function openPicker() {
    if (Platform.OS === 'ios') {
      setIosDraft(value ?? new Date());
      setIosOpen(true);
      return;
    }
    // Android: imperative picker
    openAndroidPicker();
  }

  function openAndroidPicker() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DateTimePickerAndroid } = require('@react-native-community/datetimepicker');
    const current = value ?? new Date();

    // Single-purpose modes: one picker, merge the picked part onto the
    // existing value so the other half (date or time) is preserved.
    if (mode === 'date' || mode === 'time') {
      DateTimePickerAndroid.open({
        value: current,
        mode,
        is24Hour: true,
        minimumDate: mode === 'date' ? minimumDate : undefined,
        onChange: (event: DateTimePickerEvent, picked?: Date) => {
          if (event.type !== 'set' || !picked) return;
          onChange(mergeForMode(mode, current, picked));
        },
      });
      return;
    }

    // datetime: date picker first, then time picker, then commit.
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      minimumDate,
      onChange: (event: DateTimePickerEvent, picked?: Date) => {
        if (event.type !== 'set' || !picked) return;
        const datePart = picked;
        onChange(datePart);
        // Time picker shown after a microtask so the date one closes first
        setTimeout(() => {
          DateTimePickerAndroid.open({
            value: datePart,
            mode: 'time',
            is24Hour: true,
            onChange: (timeEvt: DateTimePickerEvent, timePicked?: Date) => {
              if (timeEvt.type !== 'set' || !timePicked) return;
              const combined = new Date(datePart);
              combined.setHours(timePicked.getHours(), timePicked.getMinutes(), 0, 0);
              onChange(combined);
            },
          });
        }, 50);
      },
    });
  }

  function commitIos() {
    onChange(mergeForMode(mode, value ?? new Date(), iosDraft));
    setIosOpen(false);
  }

  function clear() {
    onChange(null);
  }

  return (
    <View style={styles.wrap}>
      {!hideLabel && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.box}
          onPress={openPicker}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: value ? formatValue(value, mode) : placeholderText }}
        >
          <Ionicons name={leadingIcon} size={18} color={colors.text.tertiary} />
          <Text style={[styles.valueText, !value && styles.placeholderText]} numberOfLines={1}>
            {value ? formatValue(value, mode) : placeholderText}
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
                mode={mode}
                display="spinner"
                minimumDate={mode === 'time' ? undefined : minimumDate}
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

/** Merge the freshly-picked part onto the base value, per mode. */
function mergeForMode(mode: DateTimeFieldMode, base: Date, picked: Date): Date {
  if (mode === 'date') {
    const merged = new Date(base);
    merged.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
    return merged;
  }
  if (mode === 'time') {
    const merged = new Date(base);
    merged.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
    return merged;
  }
  return picked;
}

function formatValue(d: Date, mode: DateTimeFieldMode): string {
  if (mode === 'date') return formatDatePart(d, false);
  if (mode === 'time') return formatTimePart(d);
  return `${formatDatePart(d, true)} · ${formatTimePart(d)}`;
}

function formatDatePart(d: Date, withWeekday: boolean): string {
  return d.toLocaleDateString(undefined, {
    ...(withWeekday ? { weekday: 'short' as const } : null),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTimePart(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
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
