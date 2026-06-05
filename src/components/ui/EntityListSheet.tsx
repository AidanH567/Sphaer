import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius } from '@/constants/theme';
import type { Profile } from '@/types/user.types';
import type { CircleWithCounts } from '@/types/circle.types';
import type { EventWithRelations } from '@/types/event.types';

// ─── Public API ──────────────────────────────────────────────────────────────

export type EntityListSheetItem =
  | { kind: 'user'; user: Profile }
  | { kind: 'circle'; circle: CircleWithCounts }
  | { kind: 'activity'; event: EventWithRelations };

interface BaseProps {
  visible: boolean;
  title: string;
  /** Optional subtitle shown under the title (e.g. "12 members"). */
  subtitle?: string;
  isLoading?: boolean;
  /** Disable the search input when set; useful for very short lists. */
  hideSearch?: boolean;
  /** Empty-state text when items.length === 0. */
  emptyMessage?: string;
  onClose: () => void;
}

interface UserListProps extends BaseProps {
  type: 'user';
  items: Profile[];
}

interface CircleListProps extends BaseProps {
  type: 'circle';
  items: CircleWithCounts[];
}

interface ActivityListProps extends BaseProps {
  type: 'activity';
  items: EventWithRelations[];
  /** Activities only — render Upcoming / Past tabs that split items by start time. */
  withTimeTabs?: boolean;
  /** When true, rows route to /ticket/<id> instead of /event/<id>. Used by
   *  the Tickets sheet on the profile screen. */
  routeAsTicket?: boolean;
}

export type EntityListSheetProps = UserListProps | CircleListProps | ActivityListProps;

// ─── Component ───────────────────────────────────────────────────────────────

const SHEET_HEIGHT = Math.round(Dimensions.get('window').height * 0.85);
const ANIMATION_DURATION = 280;

/**
 * Reusable slide-up bottom sheet that lists users, circles, or activities.
 * Matches CreateMenuSheet's visual chrome (white sheet, rounded top corners,
 * dragger handle, dimmed backdrop, modalMounted-style animation lifecycle).
 *
 * Three list modes via discriminated union props:
 *   - type='user'     → rows show avatar / initials + display_name + handle
 *   - type='circle'   → rows show avatar + name + member/activity counts
 *   - type='activity' → rows show poster + title + date/location; supports
 *                       an optional Upcoming/Past tab split via withTimeTabs
 *
 * All rows are tappable and navigate to the matching detail screen.
 * Search filters the visible items client-side (small data sets).
 */
export function EntityListSheet(props: EntityListSheetProps) {
  const { visible, title, subtitle, isLoading = false, hideSearch = false, emptyMessage, onClose } = props;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [modalMounted, setModalMounted] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activityTab, setActivityTab] = useState<'upcoming' | 'past'>('upcoming');

  // Reset state every time the sheet opens fresh
  useEffect(() => {
    if (visible) {
      setSearchText('');
      setActivityTab('upcoming');
      setModalMounted(true);
      translateY.setValue(SHEET_HEIGHT);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 22,
          stiffness: 180,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
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
      ]).start(() => setModalMounted(false));
    }
  }, [visible]);

  // Time-tab filter (activity only)
  const timeFilteredItems = useMemo(() => {
    if (props.type !== 'activity' || !props.withTimeTabs) {
      return props.items as EventWithRelations[] | Profile[] | CircleWithCounts[];
    }
    const now = Date.now();
    if (activityTab === 'upcoming') {
      return [...props.items]
        .filter((e) => +new Date(e.starts_at) >= now)
        .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
    }
    return [...props.items]
      .filter((e) => +new Date(e.starts_at) < now)
      .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));
  }, [props, activityTab]);

  // Search filter
  const filteredItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (q.length === 0) return timeFilteredItems;
    if (props.type === 'user') {
      return (timeFilteredItems as Profile[]).filter((u) =>
        haystackForUser(u).includes(q),
      );
    }
    if (props.type === 'circle') {
      return (timeFilteredItems as CircleWithCounts[]).filter((c) =>
        haystackForCircle(c).includes(q),
      );
    }
    return (timeFilteredItems as EventWithRelations[]).filter((e) =>
      haystackForEvent(e).includes(q),
    );
  }, [timeFilteredItems, searchText, props.type]);

  // ── Row press handlers — navigate to detail page, close the sheet first
  function handleRowPress(targetPath: string) {
    onClose();
    setTimeout(() => router.push(targetPath as any), 250);
  }

  // ── Renderers per type
  function renderRow(item: Profile | CircleWithCounts | EventWithRelations, index: number) {
    if (props.type === 'user') {
      const u = item as Profile;
      return (
        <UserRow
          key={u.id}
          profile={u}
          onPress={() => handleRowPress(`/user/${u.id}`)}
          showDivider={index < filteredItems.length - 1}
        />
      );
    }
    if (props.type === 'circle') {
      const c = item as CircleWithCounts;
      return (
        <CircleRow
          key={c.id}
          circle={c}
          onPress={() => handleRowPress(`/circles/${c.id}`)}
          showDivider={index < filteredItems.length - 1}
        />
      );
    }
    const e = item as EventWithRelations;
    const activityProps = props as ActivityListProps;
    const target = activityProps.routeAsTicket ? `/ticket/${e.id}` : `/event/${e.id}`;
    return (
      <ActivityRow
        key={e.id}
        event={e}
        onPress={() => handleRowPress(target)}
        showDivider={index < filteredItems.length - 1}
      />
    );
  }

  const showTabs = props.type === 'activity' && Boolean(props.withTimeTabs);

  return (
    <Modal
      visible={modalMounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.5],
              }),
            },
          ]}
        />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.sheet,
          { height: SHEET_HEIGHT, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={22} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        {!hideSearch && (
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder={`Search ${props.type === 'user' ? 'people' : props.type === 'circle' ? 'circles' : 'activities'}…`}
              placeholderTextColor={colors.text.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchText('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Activity tabs */}
        {showTabs && (
          <View style={styles.tabsRow}>
            <TabButton
              label="Upcoming"
              active={activityTab === 'upcoming'}
              onPress={() => setActivityTab('upcoming')}
            />
            <TabButton
              label="Past"
              active={activityTab === 'past'}
              onPress={() => setActivityTab('past')}
            />
          </View>
        )}

        {/* List body */}
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.black} />
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              {searchText
                ? `No matches for "${searchText}"`
                : emptyMessage ?? defaultEmptyMessage(props.type)}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={{ paddingBottom: (insets.bottom || spacing.lg) + spacing.md }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredItems.map((item, i) => renderRow(item, i))}
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

// ─── Row components ──────────────────────────────────────────────────────────

function UserRow({
  profile,
  onPress,
  showDivider,
}: {
  profile: Profile;
  onPress: () => void;
  showDivider: boolean;
}) {
  const initials = getInitials(profile.display_name, profile.username);
  const subtitle =
    (profile.disciplines ?? []).slice(0, 2).join(' · ') || profile.location || '';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={styles.row}>
        <Avatar uri={profile.avatar_url} initials={initials} />
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {profile.display_name || 'New member'}
          </Text>
          {!!subtitle && (
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </View>
      {showDivider && <View style={styles.divider} />}
    </TouchableOpacity>
  );
}

function CircleRow({
  circle,
  onPress,
  showDivider,
}: {
  circle: CircleWithCounts;
  onPress: () => void;
  showDivider: boolean;
}) {
  const initials = getInitials(circle.name, null);
  const memberLabel = circle.members_count === 1 ? '1 member' : `${circle.members_count.toLocaleString('de-DE')} members`;
  const activityLabel = circle.activities_count === 1 ? '1 activity' : `${circle.activities_count} activities`;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={styles.row}>
        <Avatar uri={circle.avatar_url} initials={initials} />
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {circle.name}
          </Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {memberLabel} · {activityLabel}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </View>
      {showDivider && <View style={styles.divider} />}
    </TouchableOpacity>
  );
}

function ActivityRow({
  event,
  onPress,
  showDivider,
}: {
  event: EventWithRelations;
  onPress: () => void;
  showDivider: boolean;
}) {
  const date = new Date(event.starts_at);
  const dateLabel = date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const initials = getInitials(event.title, null);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={styles.row}>
        {event.poster_url ? (
          <Image source={{ uri: event.poster_url }} style={styles.posterThumb} />
        ) : (
          <View style={[styles.posterThumb, styles.posterPlaceholder]}>
            <Text style={styles.posterInitials}>{initials}</Text>
          </View>
        )}
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {dateLabel} · {timeLabel}{event.location_name ? ` · ${event.location_name}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </View>
      {showDivider && <View style={styles.divider} />}
    </TouchableOpacity>
  );
}

// ─── Building blocks ─────────────────────────────────────────────────────────

function Avatar({ uri, initials }: { uri: string | null | undefined; initials: string }) {
  if (uri) {
    return <Image source={{ uri }} style={styles.avatar} />;
  }
  return (
    <View style={[styles.avatar, styles.avatarPlaceholder]}>
      <Text style={styles.avatarInitials}>{initials || '·'}</Text>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(primary: string | null | undefined, secondary: string | null | undefined): string {
  const source = (primary?.trim() || secondary?.trim() || '').trim();
  if (!source) return '';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, Math.min(2, parts[0].length)).toUpperCase();
}

function haystackForUser(u: Profile): string {
  return [
    u.display_name ?? '',
    u.username ?? '',
    u.location ?? '',
    (u.disciplines ?? []).join(' '),
  ].join(' ').toLowerCase();
}

function haystackForCircle(c: CircleWithCounts): string {
  return [c.name, c.description ?? '', (c.tags ?? []).join(' ')].join(' ').toLowerCase();
}

function haystackForEvent(e: EventWithRelations): string {
  return [
    e.title,
    e.description ?? '',
    e.location_name ?? '',
    e.address ?? '',
    (e.categories ?? []).join(' '),
  ].join(' ').toLowerCase();
}

function defaultEmptyMessage(type: 'user' | 'circle' | 'activity'): string {
  if (type === 'user') return 'No people to show yet';
  if (type === 'circle') return 'No circles to show yet';
  return 'No activities to show yet';
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const CHOCOLATE = colors.neutral.chocolate;
const META = colors.neutral.meta;

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
    marginBottom: spacing.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerText: { flex: 1, gap: 2 },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: META,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    color: colors.text.primary,
    paddingVertical: 0,
  },

  tabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  tabButtonActive: {
    backgroundColor: CHOCOLATE,
  },
  tabLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  tabLabelActive: {
    color: colors.white,
  },

  list: { flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  rowSubtitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: META,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.xl + 44 + spacing.md, // align with text after the avatar
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },

  posterThumb: {
    width: 44,
    height: 52,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterInitials: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 12,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
