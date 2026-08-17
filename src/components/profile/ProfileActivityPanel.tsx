import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActivityRow } from './ActivityRow';
import { isTicketed, type ActivityTab, type ActivityTabKey } from '@/utils/profile-activities';
import { colors, typography, spacing } from '@/constants/theme';

/**
 * How many rows render before the "Show more" control appears.
 *
 * The list is INLINE now, and profile sections (Experience, Testimonials,
 * Images) sit below it — an uncapped list would bury them. Measured against
 * production: an active user is registered for ~45 activities, which is ~2900px
 * of rows. Capping at 5 keeps everything below the panel reachable while still
 * showing real content above the fold.
 */
const COLLAPSED_ROWS = 5;

interface ProfileActivityPanelProps {
  tabs: ActivityTab[];
  isLoading: boolean;
  error?: string | null;
}

/**
 * The tab strip + inline activity list that replaced three redundant buttons
 * and their bottom sheets on both profile screens.
 *
 * Why tabs and not buttons: a button hides what it contains until you press
 * it, so three buttons over near-identical data read as "which one do I
 * want?". A tab strip shows every option at once with its real count, and
 * switching swaps the list underneath instead of opening a modal — so the
 * comparison a user actually wants to make ("do I have tickets or just
 * saves?") is answerable without opening anything.
 */
export function ProfileActivityPanel({ tabs, isLoading, error }: ProfileActivityPanelProps) {
  const router = useRouter();
  const [activeKey, setActiveKey] = useState<ActivityTabKey>(tabs[0]?.key ?? 'all');
  const [expanded, setExpanded] = useState(false);

  // If the tab set changes shape (own → other profile, or the private tabs
  // arriving after auth resolves), a now-missing active tab would render an
  // empty panel forever. Fall back to the first tab.
  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.key === activeKey)) {
      setActiveKey(tabs[0].key);
    }
  }, [tabs, activeKey]);

  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  function selectTab(key: ActivityTabKey) {
    setActiveKey(key);
    // Collapsing on switch keeps the section below the panel reachable —
    // otherwise expanding a 45-row tab would leave every later tab scrolled
    // far off screen.
    setExpanded(false);
  }

  if (!active) return null;

  const visible = expanded ? active.events : active.events.slice(0, COLLAPSED_ROWS);
  const hiddenCount = active.events.length - visible.length;

  return (
    <View style={styles.panel} testID="profile-activity-panel">
      {/* ── Tab strip ─────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabStrip}
      >
        {tabs.map((tab) => {
          const selected = tab.key === active.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => selectTab(tab.key)}
              activeOpacity={0.7}
              style={[styles.tab, selected && styles.tabSelected]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${tab.label}, ${tab.count}`}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>
                {tab.label}
              </Text>
              <View style={[styles.tabCount, selected && styles.tabCountSelected]}>
                <Text style={[styles.tabCountText, selected && styles.tabCountTextSelected]}>
                  {tab.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List ──────────────────────────────────────────── */}
      {isLoading && active.events.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.black} />
        </View>
      ) : error && active.events.length === 0 ? (
        <View style={styles.body}>
          <EmptyState body={error} />
        </View>
      ) : active.events.length === 0 ? (
        <View style={styles.body}>
          <EmptyState body={active.emptyBody} />
        </View>
      ) : (
        <View style={styles.body}>
          {visible.map((event, i) => (
            <ActivityRow
              key={event.id}
              event={event}
              onPress={() => router.push(`/event/${event.id}` as Href)}
              showDivider={i < visible.length - 1}
              // Only badge a ticket where it is NOT already the point of the
              // tab — inside "Tickets" every row is one, so the badge would be
              // pure noise.
              badge={active.key !== 'tickets' && isTicketed(event) ? 'Ticket' : undefined}
            />
          ))}

          {hiddenCount > 0 && (
            <TouchableOpacity
              onPress={() => setExpanded(true)}
              activeOpacity={0.7}
              style={styles.showMore}
              accessibilityRole="button"
            >
              <Text style={styles.showMoreText}>Show {hiddenCount} more</Text>
            </TouchableOpacity>
          )}
          {expanded && active.events.length > COLLAPSED_ROWS && (
            <TouchableOpacity
              onPress={() => setExpanded(false)}
              activeOpacity={0.7}
              style={styles.showMore}
              accessibilityRole="button"
            >
              <Text style={styles.showMoreText}>Show less</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { paddingTop: spacing.md },

  tabStrip: {
    flexDirection: 'row',
    // Tuned so all FOUR own-profile tabs fit inside 390px minus the screen's
    // 16px side padding. The strip still scrolls, but a control the user has
    // to discover by swiping is only half a control — at the default width
    // "Tickets" was clipped, which is precisely the tab most likely to be
    // overlooked.
    gap: 6,
    paddingVertical: spacing.xs,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.neutral.hiddenLines,
    backgroundColor: colors.white,
  },
  tabSelected: {
    backgroundColor: colors.neutral.chocolate,
    borderColor: colors.neutral.chocolate,
  },
  tabLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.chocolate,
  },
  tabLabelSelected: { color: colors.white },
  tabCount: {
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  tabCountSelected: { backgroundColor: 'rgba(255,255,255,0.22)' },
  tabCountText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 12,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.neutral600,
  },
  tabCountTextSelected: { color: colors.white },

  body: { paddingTop: spacing.xs },
  center: {
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },

  showMore: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  showMoreText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.chocolate,
  },
});
