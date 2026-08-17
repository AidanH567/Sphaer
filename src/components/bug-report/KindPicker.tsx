import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { REPORT_KIND_OPTIONS, type ReportKind } from '@/constants/report-kinds';
import { colors, typography, spacing, radius } from '@/constants/theme';

/**
 * The first question on the report screen: bug, feature, or change.
 *
 * A three-way segmented control rather than a dropdown, because the choice
 * changes the whole rest of the form — it has to be visible at a glance that
 * there ARE three options. The old screen asked "What went wrong?" first,
 * which told anyone with a feature idea they were on the wrong screen
 * (Aidan, 2026-08-17: "not everything we want to add is a bug").
 *
 * The helper line under the control changes with the selection, so the
 * distinction between "feature" and "change" is explained where the decision
 * is made instead of in a tooltip nobody opens.
 */
export function KindPicker({
  value,
  onChange,
}: {
  value: ReportKind;
  onChange: (kind: ReportKind) => void;
}) {
  const helper = REPORT_KIND_OPTIONS.find((option) => option.value === value)?.helper ?? '';

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>What kind of report is this?</Text>
      <View style={styles.segments} accessibilityRole="radiogroup">
        {REPORT_KIND_OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.segment, selected && styles.segmentSelected]}
              onPress={() => onChange(option.value)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label} report`}
            >
              <Ionicons
                name={option.icon}
                size={16}
                color={selected ? colors.white : colors.text.secondary}
              />
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.helper}>{helper}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  segments: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 38,
    borderRadius: radius.full,
  },
  segmentSelected: {
    backgroundColor: colors.neutral.chocolate,
  },
  segmentText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  segmentTextSelected: {
    color: colors.white,
  },
  helper: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
});
