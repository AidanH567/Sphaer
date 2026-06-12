import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
   * What the picker edits. 'date' / 'time' render the matching single-purpose
   * browser input and merge the picked part onto the current value (so two
   * fields can co-own the same Date — Figma 6277:10002's Date + Time row).
   * Default 'datetime' keeps the original datetime-local input.
   */
  mode?: DateTimeFieldMode;
  /** Ionicons glyph rendered inside the box (Figma: calendar / clock). */
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  /** Hide the built-in label text (screen renders its own section label). */
  hideLabel?: boolean;
}

const INPUT_TYPE: Record<DateTimeFieldMode, string> = {
  date: 'date',
  time: 'time',
  datetime: 'datetime-local',
};

/**
 * Web build of DateTimeField. The native @react-native-community/datetimepicker
 * package only ships iOS + Android pickers; on web we fall back to the browser's
 * built-in <input type="date|time|datetime-local">, which mobile Safari + every
 * modern desktop browser render as a polished native picker.
 *
 * Expo/Metro picks this file over DateTimeField.tsx automatically when the
 * platform is "web" — Native vs Web split via filename suffix.
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
  const inputValue = value ? formatForInput(value, mode) : '';
  // `min` only makes sense for date-bearing inputs; a bare time input's min
  // would wrongly constrain every day to after-minimum o'clock.
  const minAttr =
    minimumDate && mode !== 'time' ? formatForInput(minimumDate, mode) : undefined;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (!raw) {
      onChange(null);
      return;
    }
    const next = parseFromInput(raw, mode, value ?? new Date());
    if (!next || Number.isNaN(next.getTime())) {
      onChange(null);
      return;
    }
    onChange(next);
  }

  return (
    <View style={styles.wrap}>
      {!hideLabel && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        <View style={styles.box}>
          <Ionicons name={leadingIcon} size={18} color={colors.text.tertiary} />
          {/* Raw HTML input — React Native Web passes plain DOM elements through. */}
          {React.createElement('input', {
            type: INPUT_TYPE[mode],
            value: inputValue,
            min: minAttr,
            onChange: handleChange,
            placeholder,
            'aria-label': label,
            style: webInputStyle,
          })}
        </View>
        {clearable && value && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => onChange(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Clear date"
          >
            <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function formatForInput(d: Date, mode: DateTimeFieldMode): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timePart = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (mode === 'date') return datePart;
  if (mode === 'time') return timePart;
  return `${datePart}T${timePart}`;
}

/**
 * Parse the browser input's string back into a Date. For single-purpose
 * modes we merge onto `base` instead of constructing from the raw string —
 * `new Date('2026-06-12')` would parse as UTC midnight and shift the day in
 * Berlin, and a bare 'HH:MM' isn't parseable at all.
 */
function parseFromInput(raw: string, mode: DateTimeFieldMode, base: Date): Date | null {
  if (mode === 'date') {
    const [y, m, d] = raw.split('-').map(Number);
    if (!y || !m || !d) return null;
    const merged = new Date(base);
    merged.setFullYear(y, m - 1, d);
    return merged;
  }
  if (mode === 'time') {
    const [h, min] = raw.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(min)) return null;
    const merged = new Date(base);
    merged.setHours(h, min, 0, 0);
    return merged;
  }
  // datetime-local strings are interpreted as local time. new Date() does
  // the right thing.
  return new Date(raw);
}

// Inline web style for the raw <input>. React Native StyleSheet won't apply
// here because this is a real DOM element, not a Text/View.
const webInputStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: 16,
  color: colors.text.primary,
  fontFamily: typography.fontFamily.ui,
  padding: 0,
  width: '100%',
};

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
  clearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
