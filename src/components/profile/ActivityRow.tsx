import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '@/constants/theme';
import { formatEventDateShort } from '@/utils/date';
import type { EventWithRelations } from '@/types/event.types';

export const POSTER_THUMB = 48;

export interface ActivityRowBadge {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  /**
   * Tapping the badge goes somewhere OTHER than the row's destination — to
   * the ticket QR, or the external ticket page. That is the whole value of
   * the badge: one tap to the QR instead of two through a tab, so it must
   * never also fire the row's onPress (covered by a test).
   */
  onPress?: () => void;
}

interface ActivityRowProps {
  event: EventWithRelations;
  onPress: () => void;
  showDivider: boolean;
  /** Optional trailing pill, e.g. the ticket badge. */
  badge?: ActivityRowBadge;
}

/**
 * One compact activity row: 48px poster thumb, title, short date, optional
 * trailing badge.
 *
 * Lifted out of the old UserEventsSheet so the list inside the restored
 * Activities sheet keeps the exact row treatment users already know — the
 * categories changed, the row did not.
 */
function ActivityRowImpl({ event, onPress, showDivider, badge }: ActivityRowProps) {
  const dateLabel = formatEventDateShort(event.starts_at);

  // The badge is a SIBLING of the row's touchable, not a child of it. Nesting
  // them renders `<button>` inside `<button>` on react-native-web — invalid
  // HTML, and Sphaer ships a web build. Siblings also make the "badge tap
  // doesn't navigate the row" guarantee structural rather than a bet on the
  // touch responder.
  return (
    <View>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.main}
          onPress={onPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${event.title}, ${dateLabel}`}
        >
          {event.poster_url ? (
            <Image source={{ uri: event.poster_url }} style={styles.posterThumb} />
          ) : (
            <View style={[styles.posterThumb, styles.posterPlaceholder]}>
              <Ionicons name="calendar-outline" size={18} color={colors.text.tertiary} />
            </View>
          )}
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {event.title}
            </Text>
            <Text style={styles.rowDate} numberOfLines={1}>
              {dateLabel}
            </Text>
          </View>
        </TouchableOpacity>

        {badge ? (
          badge.onPress ? (
            <TouchableOpacity
              onPress={badge.onPress}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={badge.accessibilityLabel}
              style={[styles.badge, styles.badgeTappable]}
            >
              <Ionicons name={badge.icon} size={12} color={colors.neutral.chocolate} />
              <Text style={[styles.badgeText, styles.badgeTextTappable]}>{badge.label}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.badge} accessibilityLabel={badge.accessibilityLabel}>
              <Ionicons name={badge.icon} size={12} color={colors.neutral.neutral600} />
              <Text style={styles.badgeText}>{badge.label}</Text>
            </View>
          )
        ) : null}

        {/* The chevron keeps its own tap target rather than becoming dead
            decoration now that it sits outside the main touchable. */}
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </TouchableOpacity>
      </View>
      {showDivider && <View style={styles.divider} />}
    </View>
  );
}

export const ActivityRow = React.memo(ActivityRowImpl);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  // Poster + text: the row's main tap target, taking all the width the badge
  // and chevron don't need.
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.chocolate,
  },
  rowDate: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: colors.neutral.neutral600,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    // Align with the text column after the poster thumb.
    marginLeft: POSTER_THUMB + spacing.md,
  },
  posterThumb: {
    width: POSTER_THUMB,
    height: POSTER_THUMB,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  // A tappable badge has to LOOK tappable next to an already-tappable row,
  // so it gets an outline the inert variant doesn't.
  badgeTappable: {
    borderWidth: 1,
    borderColor: colors.neutral.hiddenLines,
    backgroundColor: colors.white,
  },
  badgeText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.neutral600,
  },
  badgeTextTappable: { color: colors.neutral.chocolate },
});
