import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ProfileView } from '@/components/profile/ProfileView';
import { ProfileCompletionCard } from '@/components/profile/ProfileCompletionCard';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { ProfileSkeleton } from '@/components/ui/skeletons/ProfileSkeleton';
import { computeProfileCompletion } from '@/utils/profile-completion';
import { getMockProfileById, CURRENT_USER_PROFILE_ID } from '@/data/mockProfiles';
import { adaptProfileToDisplay } from '@/components/profile/adaptProfile';
import {
  getProfile,
  getProfileImages,
  getFollowers,
  getFollowing,
  unfollowUser,
} from '@/services/profile.service';
import { getMyCircleIds, getMyCircles } from '@/services/circles.service';
import { getRegistrationCount, getMyRegisteredEvents } from '@/services/registrations.service';
import { getSavedEvents } from '@/services/events.service';
import { signOut } from '@/services/auth.service';
import { deleteAccount } from '@/services/account.service';
import { useAuthContext } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import type { Profile, ProfileImage } from '@/types/user.types';
import type { CircleWithCounts } from '@/types/circle.types';
import type { EventWithRelations } from '@/types/event.types';
import { EntityListSheet } from '@/components/ui/EntityListSheet';
import { colors, typography, spacing } from '@/constants/theme';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

// Note: INK / META / SUCCESS_DOT used to live here for the
// AvailableForWorkBar; removed alongside the bar in 2026-06-09 cleanup.

// NOTE: real authed users come from Supabase. In __DEV__ with no session
// we still fall back to mockProfiles for UI iteration without auth.

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, isLoading: authLoading } = useAuthContext();
  const { unreadCount: notifUnread } = useNotifications(user?.id);

  function handleNotificationsPress() {
    router.push('/notifications' as never);
  }

  async function performUnfollow() {
    if (!user?.id || !unfollowTarget) return;
    const target = unfollowTarget;
    // Optimistic remove from the visible list + counters; rollback on error.
    setFollowing((prev) => prev.filter((p) => p.id !== target.id));
    setCounts((c) => ({ ...c, following: Math.max(0, c.following - 1) }));
    setUnfollowTarget(null);
    try {
      await unfollowUser(user.id, target.id);
    } catch (err) {
      console.error('[Profile] unfollow failed:', err);
      // Rollback — add back to the visible list + counter.
      setFollowing((prev) => [target, ...prev]);
      setCounts((c) => ({ ...c, following: c.following + 1 }));
    }
  }

  // Live counts pulled from Supabase. See grilling Q5 + Q6d:
  //   - activities count = event_registrations rows for user (creator-as-attendee
  //     is auto-inserted by the `on_event_created` trigger, so this naturally
  //     covers both "created" and "registered" without dedup)
  //   - circles count = distinct IDs across circle_members + circle_follows
  //     (deduplicated client-side via Set in getMyCircleIds)
  const [counts, setCounts] = useState<{
    followers: number;
    following: number;
    circles: number;
    activities: number;
  }>({ followers: 0, following: 0, circles: 0, activities: 0 });
  const [gallery, setGallery] = useState<ProfileImage[]>([]);
  const [extrasLoading, setExtrasLoading] = useState(true);

  const [signOutSheetVisible, setSignOutSheetVisible] = useState(false);
  // Long-press unfollow confirm — set when the user long-presses a row in the
  // Following sheet. Two-state machine: null means "no confirm pending"; a
  // Profile means "confirm sheet open, this person is about to be unfollowed".
  const [unfollowTarget, setUnfollowTarget] = useState<Profile | null>(null);

  // Two-step delete: first sheet warns, second sheet is the point of no return.
  // Splitting it into two sheets is the "double confirm" spec — a single typed
  // "DELETE" prompt was rejected as over-engineered for a solo demo (see BACKLOG).
  const [deleteConfirm1Visible, setDeleteConfirm1Visible] = useState(false);
  const [deleteConfirm2Visible, setDeleteConfirm2Visible] = useState(false);

  // Stats popups — exactly one open at a time via a single discriminator.
  // 'saved' and 'tickets' aren't public stats but use the same sheet machinery.
  type OpenSheet =
    | 'followers'
    | 'following'
    | 'circles'
    | 'activities'
    | 'saved'
    | 'tickets'
    | null;
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<Profile[]>([]);
  const [myCircles, setMyCircles] = useState<CircleWithCounts[]>([]);
  const [myActivities, setMyActivities] = useState<EventWithRelations[]>([]);
  const [mySaved, setMySaved] = useState<EventWithRelations[]>([]);
  const [myTickets, setMyTickets] = useState<EventWithRelations[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);

  // Fetch data lazily when a stats popup opens. Re-runs each open so the
  // list reflects any in-between changes (new follower, joined a circle, etc).
  useEffect(() => {
    if (!user || !openSheet) return;
    let active = true;
    setSheetLoading(true);

    const fetcher =
      openSheet === 'followers'
        ? getFollowers(user.id).then((data) => active && setFollowers(data))
        : openSheet === 'following'
        ? getFollowing(user.id).then((data) => active && setFollowing(data))
        : openSheet === 'circles'
        ? getMyCircles(user.id).then((data) => active && setMyCircles(data))
        : openSheet === 'saved'
        ? getSavedEvents(user.id).then((data) => active && setMySaved(data))
        : openSheet === 'tickets'
        ? getMyRegisteredEvents(user.id).then((data) => active && setMyTickets(data))
        : getMyRegisteredEvents(user.id).then((data) => active && setMyActivities(data));

    fetcher
      .catch(() => {
        if (active) {
          if (openSheet === 'followers') setFollowers([]);
          else if (openSheet === 'following') setFollowing([]);
          else if (openSheet === 'circles') setMyCircles([]);
          else if (openSheet === 'saved') setMySaved([]);
          else if (openSheet === 'tickets') setMyTickets([]);
          else setMyActivities([]);
        }
      })
      .finally(() => {
        if (active) setSheetLoading(false);
      });

    return () => {
      active = false;
    };
  }, [openSheet, user]);

  // Re-fetch counts + gallery every time this screen comes into focus, so
  // saves from Edit Profile / new registrations / new circle joins all
  // reflect when the user navigates back.
  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setExtrasLoading(false);
        return;
      }
      let active = true;
      setExtrasLoading(true);
      Promise.all([
        getProfile(user.id),
        getProfileImages(user.id),
        getRegistrationCount(user.id),
        getMyCircleIds(user.id),
      ])
        .then(([fullProfile, images, activityCount, circleIds]) => {
          if (!active) return;
          setCounts({
            followers: fullProfile?.followers_count ?? 0,
            following: fullProfile?.following_count ?? 0,
            circles: circleIds.length,
            activities: activityCount,
          });
          setGallery(images);
        })
        .catch(() => {
          if (active) setGallery([]);
        })
        .finally(() => {
          if (active) setExtrasLoading(false);
        });
      return () => {
        active = false;
      };
    }, [user])
  );

  function handleSignOut() {
    setSignOutSheetVisible(true);
  }

  async function performSignOut() {
    await signOut();
    setSignOutSheetVisible(false);
    // Explicit redirect to the landing screen (app/(auth)/index.tsx — the
    // "Welcome to Sphaer" page with Sign up / Log in buttons). The tabs
    // layout's automatic redirect on !session is bypassed in __DEV__ mode,
    // so without this the user would stay stuck on the profile screen.
    router.replace('/');
  }

  function handleDeleteAccount() {
    setDeleteConfirm1Visible(true);
  }

  function advanceToFinalDeleteConfirm() {
    setDeleteConfirm1Visible(false);
    // Small RAF-style gap so the first sheet's exit animation isn't
    // interrupted mid-slide by the second sheet mounting.
    setTimeout(() => setDeleteConfirm2Visible(true), 240);
  }

  async function performDeleteAccount() {
    // The edge function deletes the auth row server-side. Once that
    // succeeds, the local session points at a now-nonexistent user — any
    // further Supabase call will reject. We still call signOut() to clear
    // the local session, but swallow its failure (it commonly throws
    // "User from sub claim in JWT does not exist" right after).
    await deleteAccount();
    try {
      await signOut();
    } catch {
      // expected post-delete
    }
    setDeleteConfirm2Visible(false);
    router.replace('/');
  }

  function handleEdit() {
    // Route lives at app/profile/edit.tsx (outside tabs). The router types
    // are generated; if they haven't been regenerated for the new file the
    // string is still safe at runtime.
    router.push('/profile/edit' as any);
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TopBar
          onSignOut={handleSignOut}
          onNotificationsPress={handleNotificationsPress}
          unreadCount={notifUnread}
        />
        <ProfileSkeleton />
      </SafeAreaView>
    );
  }

  // Shared sign-out confirm — rendered alongside both the dev-fallback and
  // the authed screen so the sheet is reachable from either state.
  const signOutSheet = (
    <ConfirmSheet
      visible={signOutSheetVisible}
      title="Sign out"
      message="Are you sure you want to sign out? You'll need to log back in to use Sphaer."
      confirmLabel="Sign out"
      destructive
      onConfirm={performSignOut}
      onClose={() => setSignOutSheetVisible(false)}
    />
  );

  // Two-step delete-account confirms. The first warns; the second performs.
  // The second sheet is the only one that calls deleteAccount(), so the user
  // has to explicitly opt in twice before any data is touched. Mounted in both
  // the dev-fallback and authed render paths so the UI is verifiable in
  // preview; without a session, the edge function returns 401 and the sheet
  // surfaces the error rather than silently no-op'ing.
  // Long-press → unfollow confirm. Rendered only when a target is set; close
  // on cancel by clearing the target.
  const unfollowSheet = (
    <ConfirmSheet
      visible={unfollowTarget !== null}
      title={`Unfollow ${unfollowTarget?.display_name ?? 'this artist'}?`}
      message="Their activities will stop appearing on your feed. You can re-follow anytime."
      confirmLabel="Unfollow"
      destructive
      onConfirm={performUnfollow}
      onClose={() => setUnfollowTarget(null)}
    />
  );

  const deleteAccountSheets = (
    <>
      <ConfirmSheet
        visible={deleteConfirm1Visible}
        title="Delete your Sphaer account?"
        message="This will permanently remove your profile, posts, events, circles, messages, and saved items. This cannot be undone."
        confirmLabel="Continue"
        destructive
        onConfirm={advanceToFinalDeleteConfirm}
        onClose={() => setDeleteConfirm1Visible(false)}
      />
      <ConfirmSheet
        visible={deleteConfirm2Visible}
        title="Permanently delete account"
        message="Last chance — this is final. Tap Delete account to remove everything now."
        confirmLabel="Delete account"
        destructive
        onConfirm={performDeleteAccount}
        onClose={() => setDeleteConfirm2Visible(false)}
      />
    </>
  );

  // Stats popups — only render the authed-user popups when we actually have
  // a user. The dev fallback can't query Supabase for the signed-in identity.
  const statsSheets = user ? (
    <>
      <EntityListSheet
        visible={openSheet === 'followers'}
        title="Followers"
        subtitle={`${counts.followers.toLocaleString('en-US')} people follow you`}
        type="user"
        items={followers}
        isLoading={sheetLoading && openSheet === 'followers'}
        emptyMessage="No followers yet — share your profile to grow your scene."
        onClose={() => setOpenSheet(null)}
      />
      <EntityListSheet
        visible={openSheet === 'following'}
        title="Following"
        subtitle={`${counts.following.toLocaleString('en-US')} accounts you follow`}
        type="user"
        items={following}
        isLoading={sheetLoading && openSheet === 'following'}
        emptyMessage="Not following anyone yet — tap a creator on the feed to follow them."
        onClose={() => setOpenSheet(null)}
        onLongPressUser={(profile) => setUnfollowTarget(profile)}
      />
      <EntityListSheet
        visible={openSheet === 'circles'}
        title="Circles"
        subtitle={`${counts.circles.toLocaleString('en-US')} circles you're in`}
        type="circle"
        items={myCircles}
        isLoading={sheetLoading && openSheet === 'circles'}
        emptyMessage="You haven't joined any circles yet — browse the Circles tab to find your community."
        onClose={() => setOpenSheet(null)}
      />
      <EntityListSheet
        visible={openSheet === 'activities'}
        title="Activities"
        subtitle={`${counts.activities.toLocaleString('en-US')} total — created or registered`}
        type="activity"
        items={myActivities}
        withTimeTabs
        isLoading={sheetLoading && openSheet === 'activities'}
        emptyMessage="No activities yet — create one or register from the feed."
        onClose={() => setOpenSheet(null)}
      />
      <EntityListSheet
        visible={openSheet === 'saved'}
        title="Saved"
        subtitle={`${mySaved.length.toLocaleString('en-US')} activities saved`}
        type="activity"
        items={mySaved}
        withTimeTabs
        isLoading={sheetLoading && openSheet === 'saved'}
        emptyMessage="No saved activities yet — tap the bookmark on any activity to save it for later."
        onClose={() => setOpenSheet(null)}
      />
      <EntityListSheet
        visible={openSheet === 'tickets'}
        title="Tickets"
        subtitle={`${myTickets.length.toLocaleString('en-US')} active`}
        type="activity"
        items={myTickets}
        withTimeTabs
        routeAsTicket
        isLoading={sheetLoading && openSheet === 'tickets'}
        emptyMessage="No tickets yet — register for an activity from the feed."
        onClose={() => setOpenSheet(null)}
      />
    </>
  ) : null;

  // ── No session (__DEV__ only — production redirects in tabs layout) ──────
  if (!user) {
    const mock = getMockProfileById(CURRENT_USER_PROFILE_ID);
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TopBar
          onSignOut={handleSignOut}
          onNotificationsPress={handleNotificationsPress}
          unreadCount={notifUnread}
        />
        <ProfileView
          profile={mock}
          isOwnProfile
          trailingSlot={<SettingsSection onDeletePress={handleDeleteAccount} />}
        />
        {signOutSheet}
        {deleteAccountSheets}
        {unfollowSheet}
      </SafeAreaView>
    );
  }

  // ── Real authed user ─────────────────────────────────────────────────────
  const displayProfile = adaptProfileToDisplay(user.id, profile, counts, gallery);
  const completion = computeProfileCompletion(profile);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopBar
        onSignOut={handleSignOut}
        onNotificationsPress={handleNotificationsPress}
        unreadCount={notifUnread}
      />

      <ProfileCompletionCard
        percentage={completion.percentage}
        missing={completion.missing}
        onEditPress={handleEdit}
      />

      {extrasLoading && gallery.length === 0 ? (
        <ProfileSkeleton />
      ) : (
        <ProfileView
          profile={displayProfile}
          isOwnProfile
          onEditPress={handleEdit}
          onFollowersPress={() => setOpenSheet('followers')}
          onFollowingPress={() => setOpenSheet('following')}
          onCirclesPress={() => setOpenSheet('circles')}
          onActivitiesPress={() => setOpenSheet('activities')}
          onSavedPress={() => setOpenSheet('saved')}
          onTicketsPress={() => setOpenSheet('tickets')}
          trailingSlot={<SettingsSection onDeletePress={handleDeleteAccount} />}
        />
      )}

      {signOutSheet}
      {statsSheets}
      {deleteAccountSheets}
      {unfollowSheet}
    </SafeAreaView>
  );
}

// ─── Top nav row ─────────────────────────────────────────────────────────────

function TopBar({
  onSignOut,
  onNotificationsPress,
  unreadCount,
}: {
  onSignOut: () => void;
  onNotificationsPress: () => void;
  unreadCount: number;
}) {
  return (
    <View style={styles.navBar}>
      <View style={styles.navButton} />
      <View style={styles.navRight}>
        <TouchableOpacity
          onPress={onNotificationsPress}
          style={styles.navButton}
          accessibilityLabel="Notifications"
        >
          <Ionicons
            name="notifications-outline"
            size={24}
            color={colors.text.secondary}
          />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText} numberOfLines={1}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSignOut}
          style={styles.navButton}
          accessibilityLabel="Sign out"
        >
          <Ionicons name="log-out-outline" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Available for work — placeholder until the feature ships ────────────────

// Note: the old `<AvailableForWorkBar />` rendered on every own-profile,
// but its "Get in touch" CTA alerted "Coming soon" — meaning the user
// was being asked to message themselves. Removed 2026-06-09 to stop the
// dead control showing up on demo. The bar will re-emerge on
// /user/[id].tsx (other-user profiles) when Profile v2 #2 ships the
// `is_available_for_work` toggle and the toggle is on for that user.

// ─── Settings section — Delete account row ───────────────────────────────────

function SettingsSection({ onDeletePress }: { onDeletePress: () => void }) {
  return (
    <View style={styles.settingsSection}>
      <TouchableOpacity
        style={styles.settingsRow}
        onPress={onDeletePress}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={20} color={colors.badge.red} />
        <Text style={styles.settingsRowTextDestructive}>Delete account</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.badge.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  settingsSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.base,
    paddingHorizontal: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  settingsRowTextDestructive: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    fontWeight: typography.fontWeight.medium,
    color: colors.badge.red,
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('profile-own');
