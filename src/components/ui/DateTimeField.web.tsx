import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
 * Web build of DateTimeField. The native @react-native-community/datetimepicker
 * package only ships iOS + Android pickers; on web we fall back to the browser's
 * built-in <input type="datetime-local">, which mobile Safari + every modern
 * desktop browser render as a polished native picker.
 *
 * Expo/Metro picks this file over DateTimeField.tsx automatically when the
 * platform is "web" — Native vs Web split via filename suffix.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  clearable = false,
  placeholder = 'Choose a date & time',
  minimumDate,
}: DateTimeFieldProps) {
  const inputValue = value ? dateToLocalIso(value) : '';
  const minAttr = minimumDate ? dateToLocalIso(minimumDate) : undefined;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (!raw) {
      onChange(null);
      return;
    }
    // datetime-local strings are interpreted as local time. new Date() does
    // the right thing.
    const next = new Date(raw);
    if (Number.isNaN(next.getTime())) {
      onChange(null);
      return;
    }
    onChange(next);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <View style={styles.box}>
          <Ionicons name="calendar-outline" size={18} color={colors.text.tertiary} />
          {/* Raw HTML input — React Native Web passes plain DOM elements through. */}
          {React.createElement('input', {
            type: 'datetime-local',
            value: inputValue,
            min: minAttr,
            onChange: handleChange,
            placeholder,
            style: webInputStyle,
          })}
        </View>
        {clearable && value && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => onChange(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function dateToLocalIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
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
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
