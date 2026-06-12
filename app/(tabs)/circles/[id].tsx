import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CircleActivityCard } from '@/components/circles/CircleActivityCard';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { EntityListSheet } from '@/components/ui/EntityListSheet';
import { OverflowMenuSheet } from '@/components/ui/OverflowMenuSheet';
import { ReportSheet } from '@/components/moderation/ReportSheet';
import { ErrorState } from '@/components/ui/ErrorState';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useCircle } from '@/hooks/useCircles';
import { useAuthContext } from '@/context/AuthContext';
import {
  isMember as isCircleMember,
  joinCircle,
  leaveCircle,
  deleteCircle,
  getCircleMembers,
  removeMember,
} from '@/services/circles.service';
import { shareCircle } from '@/services/share.service';
import {
  getProfile,
  followUser,
  unfollowUser,
  isFollowing as isFollowingUser,
} from '@/services/profile.service';
import type { Profile, ProfileWithCounts } from '@/types/user.types';
import { supabase } from '@/lib/supabase';
import type { EventWithRelations } from '@/types/event.types';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

const MEMBERS_PREVIEW_LIMIT = 6;

export default function CircleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthContext();

  const { circle, isLoading, error, refetch } = useCircle(id);

  const [memberStatus, setMemberStatus] = useState<'unknown' | 'in' | 'out'>('unknown');
  const [activities, setActivities] = useState<EventWithRelations[]>([]);
  const [membersPreview, setMembersPreview] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);

  // Creator-only delete confirm (navBar trash button).
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  // Moderation entry point (App Store 1.2) — overflow menu → report sheet.
  const [overflowVisible, setOverflowVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  // Creator-only member kick confirm — set when the creator long-presses a
  // row in the Members sheet. null means no confirm pending.
  const [kickTarget, setKickTarget] = useState<Profile | null>(null);

  // Full Members popup state — lazy-loaded when first opened
  const [membersSheetVisible, setMembersSheetVisible] = useState(false);
  const [allMembers, setAllMembers] = useState<Profile[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Refetch on re-focus (not on the initial mount — useCircle already
  // fetched) so changes saved on the edit screen show immediately after
  // router.back(). Mirrors the event detail pattern.
  const hasFocusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      refetch();
    }, [refetch])
  );

  function openMembersSheet() {
    if (!id) return;
    setMembersSheetVisible(true);
    setMembersLoading(true);
    getCircleMembers(id)
      .then(setAllMembers)
      .catch(() => setAllMembers([]))
      .finally(() => setMembersLoading(false));
  }

  // Check current membership + fetch upcoming activities + member preview
  useEffect(() => {
    if (!id) return;
    let active = true;

    Promise.all([
      user ? isCircleMember(user.id, id).catch(() => false) : Promise.resolve(false),
      fetchCircleActivities(id),
      fetchCircleMembersPreview(id, MEMBERS_PREVIEW_LIMIT),
    ]).then(([memberFlag, acts, members]) => {
      if (!active) return;
      setMemberStatus(memberFlag ? 'in' : 'out');
      setActivities(acts);
      setMembersPreview(members);
    });

    return () => {
      active = false;
    };
  }, [id, user]);

  // ── Organizer (Figma 6274:7785 lower block) ─────────────────────
  const [organizer, setOrganizer] = useState<ProfileWithCounts | null>(null);
  const [organizerCircles, setOrganizerCircles] = useState(0);
  const [organizerActivities, setOrganizerActivities] = useState(0);
  const [followingOrganizer, setFollowingOrganizer] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  // Refs mirror the follow state so rapid taps read the *current* values —
  // React state lags a frame, which let double-taps fire duplicate writes.
  const followingOrganizerRef = useRef(false);
  const followBusyRef = useRef(false);

  useEffect(() => {
    const creatorId = circle?.creator_id;
    if (!creatorId) return;
    let active = true;

    Promise.all([
      getProfile(creatorId).catch(() => null),
      // Count queries get rejection fallbacks (0) so one network failure
      // can't reject the whole batch and blank the organizer block.
      supabase
        .from('circle_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', creatorId)
        .then(
          ({ count }) => count ?? 0,
          () => 0
        ),
      supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', creatorId)
        .then(
          ({ count }) => count ?? 0,
          () => 0
        ),
      user && user.id !== creatorId
        ? isFollowingUser(user.id, creatorId).catch(() => false)
        : Promise.resolve(false),
    ]).then(([profile, circlesCount, activitiesCount, following]) => {
      if (!active) return;
      setOrganizer(profile);
      setOrganizerCircles(circlesCount);
      setOrganizerActivities(activitiesCount);
      setFollowingOrganizer(following);
      followingOrganizerRef.current = following;
    });

    return () => {
      active = false;
    };
  }, [circle?.creator_id, user]);

  const handleFollowOrganizer = useCallback(async () => {
    if (!organizer) return;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to follow artists.');
      return;
    }
    // Synchronous entry guard — the `disabled` prop only updates after a
    // re-render, so two taps in the same frame both got through.
    if (followBusyRef.current) return;
    followBusyRef.current = true;
    setFollowBusy(true);
    try {
      // Toggle off the current value (ref), never the render-time closure,
      // so rapid taps can't desync local state from the server.
      const next = !followingOrganizerRef.current;
      if (next) {
        await followUser(user.id, organizer.id);
      } else {
        await unfollowUser(user.id, organizer.id);
      }
      followingOrganizerRef.current = next;
      setFollowingOrganizer(next);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Try again.');
    } finally {
      followBusyRef.current = false;
      setFollowBusy(false);
    }
  }, [organizer, user]);

  const handleMembership = useCallback(async () => {
    // Double-tap guard at function entry — the button's `disabled` prop only
    // kicks in after the next render, so a fast second tap slipped through.
    if (busy || memberStatus === 'unknown') return;
    if (!user || !circle) {
      Alert.alert('Sign in required', 'Please sign in to join circles.');
      return;
    }
    setBusy(true);
    try {
      if (memberStatus === 'in') {
        await leaveCircle(user.id, circle.id);
        setMemberStatus('out');
      } else {
        await joinCircle(user.id, circle.id);
        setMemberStatus('in');
      }
      // Refresh members preview
      const next = await fetchCircleMembersPreview(circle.id, MEMBERS_PREVIEW_LIMIT);
      setMembersPreview(next);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }, [user, circle, memberStatus, busy]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.navButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.navButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        <ErrorState
          icon="cloud-offline-outline"
          title="Couldn't load this circle"
          body={error}
          onRetry={refetch}
          onBack={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (!circle) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.navButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <ErrorState
            icon="people-outline"
            title="Circle not found"
            body="This circle may have been removed. Head back to browse other communities."
            onBack={() => router.back()}
            backLabel="Back to circles"
          />
        </View>
      </SafeAreaView>
    );
  }

  const isMemberFlag = memberStatus === 'in';
  const isCreator = user?.id === circle.creator_id;
  const hiddenMembers = Math.max(0, circle.members_count - membersPreview.length);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.navRight}>
          {isCreator && (
            <TouchableOpacity
              style={styles.navButton}
              // Cast: typed-routes d.ts regenerates on the next `expo start`;
              // the cast keeps tsc green until the new route is picked up.
              onPress={() => router.push(`/circles/edit/${circle.id}` as Href)}
              accessibilityRole="button"
              accessibilityLabel="Edit circle"
            >
              <Ionicons name="create-outline" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          )}
          {isCreator && (
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => setDeleteConfirmVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Delete circle"
            >
              <Ionicons name="trash-outline" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => circle && shareCircle(circle).catch(() => {})}
            accessibilityRole="button"
            accessibilityLabel="Share circle"
          >
            <Ionicons name="share-outline" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          {/* Creators manage their circle via edit/delete — the only
              overflow action is Report, which never applies to your own. */}
          {!isCreator && (
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => setOverflowVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="More options"
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Banner + overlapping avatar */}
        <View style={styles.bannerWrap}>
          {circle.cover_url ? (
            <Image source={{ uri: circle.cover_url }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]} />
          )}
          {circle.avatar_url ? (
            <Image source={{ uri: circle.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="people" size={32} color={colors.text.tertiary} />
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>{circle.name}</Text>
          <Text style={styles.meta}>
            {circle.members_count.toLocaleString('de-DE')} members{' · '}
            {circle.activities_count} activities
          </Text>
          {circle.description && (
            <Text style={styles.description}>{circle.description}</Text>
          )}

          <TouchableOpacity
            style={[styles.membershipButton, !isMemberFlag && styles.membershipButtonJoin]}
            onPress={handleMembership}
            activeOpacity={0.85}
            disabled={busy || memberStatus === 'unknown'}
            accessibilityRole="button"
            accessibilityLabel={isMemberFlag ? 'Leave circle' : 'Join circle'}
            accessibilityState={{ selected: isMemberFlag }}
          >
            {busy ? (
              <ActivityIndicator color={isMemberFlag ? colors.black : colors.white} />
            ) : (
              <>
                <Ionicons
                  name={isMemberFlag ? 'person' : 'person-add-outline'}
                  size={18}
                  color={isMemberFlag ? colors.text.primary : colors.white}
                />
                <Text
                  style={[styles.membershipText, !isMemberFlag && styles.membershipTextJoin]}
                >
                  {isMemberFlag ? "You're a member" : 'Join circle'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {isMemberFlag && (
            <TouchableOpacity
              style={styles.conversationButton}
              activeOpacity={0.85}
              onPress={() => router.push(`/messages/circle/${id}`)}
              accessibilityRole="button"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.white} />
              <Text style={styles.conversationText}>Join conversation</Text>
            </TouchableOpacity>
          )}

          <View style={styles.divider} />

          {/* Upcoming Activities — real events with circle_id == this circle */}
          <Text style={styles.sectionHeading}>Upcoming Activities</Text>
          {activities.length === 0 ? (
            <Text style={styles.emptyHint}>No upcoming activities yet.</Text>
          ) : (
            activities.map((activity) => (
              <CircleActivityCard
                key={activity.id}
                activity={{
                  id: activity.id,
                  title: activity.title,
                  dateLabel: new Date(activity.starts_at).toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  }),
                  timeLabel: new Date(activity.starts_at).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  image: activity.poster_url ?? '',
                }}
              />
            ))
          )}

          <View style={styles.divider} />

          {/* Members preview — heading + avatar row both open the full list */}
          <TouchableOpacity onPress={openMembersSheet} activeOpacity={0.6} accessibilityRole="button">
            <Text style={styles.sectionHeading}>Members</Text>
          </TouchableOpacity>
          {membersPreview.length === 0 ? (
            <Text style={styles.emptyHint}>No members yet.</Text>
          ) : (
            <TouchableOpacity
              onPress={openMembersSheet}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="View all members"
            >
              <View style={styles.membersRow}>
                {membersPreview.map((member, i) => (
                  <Image
                    key={member.id}
                    source={{ uri: member.avatar_url ?? '' }}
                    style={[styles.memberAvatar, i > 0 && styles.memberAvatarOverlap]}
                  />
                ))}
                {hiddenMembers > 0 && (
                  <Text style={styles.memberMore}>
                    +{hiddenMembers.toLocaleString('de-DE')}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}

          {organizer && (
            <>
              <View style={styles.divider} />

              {/* Organizer — Figma 6274:7785 */}
              <Text style={styles.sectionHeading}>Organizer</Text>
              <View style={styles.organizer}>
                <TouchableOpacity
                  style={styles.organizerIdentity}
                  onPress={() => router.push(`/user/${organizer.id}`)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${organizer.display_name ?? 'organizer'}'s profile`}
                >
                  {organizer.avatar_url ? (
                    <Image source={{ uri: organizer.avatar_url }} style={styles.organizerAvatar} />
                  ) : (
                    <View style={[styles.organizerAvatar, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={32} color={colors.text.tertiary} />
                    </View>
                  )}
                  <Text style={styles.organizerName}>{organizer.display_name}</Text>
                  {(organizer.disciplines?.length || organizer.location) && (
                    <Text style={styles.organizerRole}>
                      {organizer.disciplines?.length ? organizer.disciplines.join(' & ') : ''}
                      {organizer.disciplines?.length && organizer.location ? '\n' : ''}
                      {organizer.location ?? ''}
                    </Text>
                  )}
                </TouchableOpacity>

                <View style={styles.organizerStats}>
                  <View style={styles.statBlock}>
                    <Text style={styles.statLabel}>Followers</Text>
                    <Text style={styles.statValue}>
                      {organizer.followers_count.toLocaleString('de-DE')}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBlock}>
                    <Text style={styles.statLabel}>Circles</Text>
                    <Text style={styles.statValue}>{organizerCircles}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBlock}>
                    <Text style={styles.statLabel}>Activities</Text>
                    <Text style={styles.statValue}>{organizerActivities}</Text>
                  </View>
                </View>

                {user?.id !== organizer.id && (
                  <View style={styles.organizerButtons}>
                    <TouchableOpacity
                      style={[styles.followButton, followBusy && { opacity: 0.6 }]}
                      onPress={handleFollowOrganizer}
                      disabled={followBusy}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={followingOrganizer ? 'Unfollow organizer' : 'Follow organizer'}
                      accessibilityState={{ selected: followingOrganizer }}
                    >
                      {followBusy ? (
                        <ActivityIndicator color="#FFFEFB" />
                      ) : (
                        <Text style={styles.followButtonText}>
                          {followingOrganizer ? 'Following' : 'Follow'}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.contactButton}
                      onPress={() => router.push(`/messages/${organizer.id}`)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Contact organizer"
                    >
                      <Text style={styles.contactButtonText}>Contact</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <EntityListSheet
        visible={membersSheetVisible}
        title="Members"
        subtitle={`${circle.members_count.toLocaleString('en-US')} in ${circle.name}`}
        type="user"
        items={allMembers}
        isLoading={membersLoading}
        emptyMessage="No members yet — be the first to join."
        onClose={() => setMembersSheetVisible(false)}
        onLongPressUser={
          isCreator
            ? (profile) => {
                // The creator can't kick themselves out of their own circle.
                if (profile.id === user?.id) return;
                setKickTarget(profile);
              }
            : undefined
        }
        userLongPressHint="Long-press to remove from the circle"
      />

      {/* Creator-only member kick confirm — renders on top of the Members
          sheet, mirroring the profile screen's long-press unfollow flow. */}
      <ConfirmSheet
        visible={kickTarget !== null}
        title={`Remove ${kickTarget?.display_name ?? 'this member'} from the circle?`}
        message="They'll lose access to the circle chat. They can rejoin anytime."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!kickTarget || !circle) return;
          const target = kickTarget;
          await removeMember(circle.id, target.id);
          setAllMembers((prev) => prev.filter((p) => p.id !== target.id));
          setMembersPreview((prev) => prev.filter((p) => p.id !== target.id));
          setKickTarget(null);
          refetch(); // refresh members_count in the header + sheet subtitle
        }}
        onClose={() => setKickTarget(null)}
      />

      {/* Creator-only delete confirm. On success we replace to the circles
          tab — the sheet unmounts with the route, matching event detail. */}
      <ConfirmSheet
        visible={deleteConfirmVisible}
        title="Delete this circle?"
        message="Members, follows, and its chat will be removed."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!circle) return;
          await deleteCircle(circle.id);
          router.replace('/(tabs)/circles');
        }}
        onClose={() => setDeleteConfirmVisible(false)}
      />

      {/* Moderation overflow (non-creators only) */}
      <OverflowMenuSheet
        visible={overflowVisible}
        actions={[
          {
            label: 'Report circle',
            icon: 'flag-outline',
            onPress: () => setReportVisible(true),
          },
        ]}
        onClose={() => setOverflowVisible(false)}
      />
      <ReportSheet
        visible={reportVisible}
        targetType="circle"
        targetId={circle.id}
        onClose={() => setReportVisible(false)}
      />
    </SafeAreaView>
  );
}

/* ── Helpers (could live in circles.service later) ────────── */

async function fetchCircleActivities(circleId: string): Promise<EventWithRelations[]> {
  const { data, error } = await supabase
    .from('events')
    .select(`*, creator:profiles!events_creator_id_fkey(*), circle:circles(*)`)
    .eq('circle_id', circleId)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(5);
  if (error) return [];
  return (data as EventWithRelations[]) ?? [];
}

async function fetchCircleMembersPreview(circleId: string, limit: number): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('circle_members')
    .select('user:profiles!circle_members_user_id_fkey(*)')
    .eq('circle_id', circleId)
    .limit(limit);
  if (error) return [];
  return (data ?? [])
    .map((row) => (row as { user: Profile | null }).user)
    .filter((p): p is Profile => p !== null);
}

// Figma Circle_detail page 6274:7785: 160px cover, 90px avatar with a
// 2px white ring, content inset 16.
const AVATAR_SIZE = 90;
const COVER_HEIGHT = 160;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  navButton: { padding: spacing.sm },
  navRight: { flexDirection: 'row', alignItems: 'center' },

  scroll: { paddingBottom: 110 },

  bannerWrap: { marginBottom: AVATAR_SIZE / 2 },
  cover: { width: '100%', height: COVER_HEIGHT, backgroundColor: colors.surface },
  coverPlaceholder: { backgroundColor: '#E7E2D5' },
  avatar: {
    position: 'absolute',
    left: spacing.base,
    bottom: -AVATAR_SIZE / 2,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.surface,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { paddingHorizontal: spacing.base, paddingTop: spacing.md },

  name: {
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.chocolate,
  },
  meta: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.neutral600,
    marginTop: spacing.sm,
  },
  description: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    // Figma one-off body grey on this page (between neutral-600 and 500).
    color: '#666560',
    lineHeight: 18,
    maxWidth: 347,
    marginTop: spacing.md,
  },

  membershipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 49,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.neutral.hiddenLines,
    backgroundColor: colors.white,
    marginTop: spacing.lg,
  },
  membershipButtonJoin: {
    backgroundColor: colors.neutral.chocolate,
    borderColor: colors.neutral.chocolate,
  },
  membershipText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.chocolate,
  },
  membershipTextJoin: { color: '#FFFEFB' },

  conversationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 49,
    borderRadius: radius.full,
    backgroundColor: colors.neutral.chocolate,
    marginTop: spacing.sm,
  },
  conversationText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.white,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.neutral.divider,
    marginVertical: spacing.lg,
  },

  sectionHeading: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.chocolate,
    marginBottom: spacing.md,
  },

  emptyHint: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },

  membersRow: { flexDirection: 'row', alignItems: 'center' },
  memberAvatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.surface,
  },
  memberAvatarOverlap: { marginLeft: -10 },
  memberMore: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.regular,
    color: colors.neutral.chocolate,
    marginLeft: spacing.md,
  },

  // ── Organizer (Figma 6274:7785) ───────────────────────────────────
  organizer: { alignItems: 'center', gap: spacing.xl },
  organizerIdentity: { alignItems: 'center', gap: spacing.sm },
  organizerAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#DBDBDB', // Figma one-off avatar ring on this block
    backgroundColor: colors.surface,
  },
  organizerName: {
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.ink,
  },
  organizerRole: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.neutral600,
    textAlign: 'center',
  },
  organizerStats: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
  },
  statBlock: { width: 60, alignItems: 'center', gap: 5 },
  statLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.neutral500,
    textAlign: 'center',
  },
  statValue: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.chocolate,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 38,
    backgroundColor: colors.neutral.divider,
  },
  organizerButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  followButton: {
    height: 45,
    minWidth: 100,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.neutral.chocolate,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButtonText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: '#FFFEFB', // Figma Slave Cream
  },
  contactButton: {
    height: 45,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.neutral.hiddenLines,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactButtonText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.chocolate,
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('circles-detail');
