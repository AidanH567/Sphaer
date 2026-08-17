import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActivityRow } from './ActivityRow';
import { ticketBadgeTarget, type ActivityTab, type ActivityTabKey } from '@/utils/profile-activities';
import { colors, typography, spacing } from '@/constants/theme';
import type { EventWithRelations } from '@/types/event.types';

interface ProfileActivityPanelProps {
  tabs: ActivityTab[];
  isLoading: boolean;
  error?: string | null;
  /** Row tap. The sheet closes first, then routes — hence a callback. */
  onSelectActivity: (event: EventWithRelations) => void;
  /**
   * Ticket-badge tap. Omitted on other people's profiles: their registrations
   * are not your tickets, so no badge is drawn there at all.
   */
  onSelectTicket?: (event: EventWithRelations) => void;
  /** Ids the viewer holds a local registration (and therefore a QR) for. */
  registeredIds?: Set<string>;
  /** Bottom padding, so the last row clears the home indicator. */
  bottomInset?: number;
}

/**
 * The body of the Activities sheet: a segmented control over the activity
 * categories, and the list for whichever one is selected.
 *
 * Why a segmented control and not the three buttons this replaced: buttons
 * hide what they contain until pressed, so three of them over near-identical
 * data read as "which one do I want?" (Lara's complaint). A segmented control
 * shows every category at once with its real count, and switching swaps the
 * list in place — the comparison a user actually wants to make is answerable
 * without opening anything else.
 *
 * Defaults to All, always: the sheet mounts this fresh on every open, so the
 * tab you land on matches the number you just tapped on the stat row.
 */
export function ProfileActivityPanel({
  tabs,
  isLoading,
  error,
  onSelectActivity,
  onSelectTicket,
  registeredIds,
  bottomInset = spacing.lg,
}: ProfileActivityPanelProps) {
  const [activeKey, setActiveKey] = useState<ActivityTabKey>(tabs[0]?.key ?? 'all');

  // If the tab set changes shape (own → other profile, or the private tab
  // arriving after auth resolves), a now-missing active tab would render an
  // empty list forever. Fall back to the first tab.
  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.key === activeKey)) {
      setActiveKey(tabs[0].key);
    }
  }, [tabs, activeKey]);

  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  if (!active) return null;

  return (
    <View style={styles.panel} testID="profile-activity-panel">
      {/* ── Segmented control ─────────────────────────────── */}
      <View style={styles.segments} accessibilityRole="tablist">
        {tabs.map((tab) => {
          const selected = tab.key === active.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveKey(tab.key)}
              activeOpacity={0.7}
              style={[styles.segment, selected && styles.segmentSelected]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${tab.label}, ${tab.count}`}
            >
              <Text
                style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              <Text
                style={[styles.segmentCount, selected && styles.segmentCountSelected]}
                numberOfLines={1}
              >
                {tab.count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── List ──────────────────────────────────────────── */}
      {isLoading && active.events.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.black} />
        </View>
      ) : error && active.events.length === 0 ? (
        <View style={styles.center}>
          <EmptyState body={error} centered />
        </View>
      ) : active.events.length === 0 ? (
        <View style={styles.center}>
          <EmptyState body={active.emptyBody} centered />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={{ paddingBottom: bottomInset + spacing.md }}
          showsVerticalScrollIndicator={false}
        >
          {active.events.map((event, i) => {
            const target = onSelectTicket
              ? ticketBadgeTarget(event, registeredIds?.has(event.id) ?? false)
              : null;
            return (
              <ActivityRow
                key={event.id}
                event={event}
                onPress={() => onSelectActivity(event)}
                showDivider={i < active.events.length - 1}
                badge={
                  target
                    ? {
                        label: 'Ticket',
                        icon: target.kind === 'local' ? 'qr-code-outline' : 'open-outline',
                        accessibilityLabel:
                          target.kind === 'local'
                            ? `Show your ticket for ${event.title}`
                            : `Open tickets for ${event.title} — external site`,
                        onPress: () => onSelectTicket?.(event),
                      }
                    : undefined
                }
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1 },

  // iOS-style segmented control: one track, equal segments, the selected one
  // lifted onto a white card. Equal widths (flex: 1) rather than a scrolling
  // strip — a control you have to discover by swiping is only half a control.
  segments: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 3,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: spacing.sm,
    borderRadius: 9,
  },
  segmentSelected: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.neutral600,
  },
  segmentLabelSelected: {
    color: colors.neutral.chocolate,
    fontWeight: typography.fontWeight.semibold,
  },
  segmentCount: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 12,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.neutral400,
  },
  segmentCountSelected: { color: colors.neutral.chocolate },

  list: { flex: 1, paddingHorizontal: spacing.xl },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
});
