import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ProfileView } from '@/components/profile/ProfileView';
import { adaptProfileToDisplay } from '@/components/profile/adaptProfile';
import { ProfileSkeleton } from '@/components/ui/skeletons/ProfileSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { OverflowMenuSheet } from '@/components/ui/OverflowMenuSheet';
import { ReportSheet } from '@/components/moderation/ReportSheet';
import { useAuthContext } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import {
  blockUser,
  unblockUser,
  ModerationUnavailableError,
} from '@/services/moderation.service';
import {
  getProfile,
  getProfileImages,
  getFollowers,
  getFollowing,
  isFollowing as isFollowingService,
  followUser,
  unfollowUser,
} from '@/services/profile.service';
import { getMyCircleIds, getMyCircles } from '@/services/circles.service';
import { getRegistrationCount, getMyRegisteredEvents } from '@/services/registrations.service';
import { shareProfile } from '@/services/share.service';
import { EntityListSheet } from '@/components/ui/EntityListSheet';
import { type MockProfile } from '@/data/mockProfiles';
import { colors, typography, spacing } from '@/constants/theme';
import type { Profile, ProfileImage } from '@/types/user.types';
import type { CircleWithCounts } from '@/types/circle.types';
import type { EventWithRelations } from '@/types/event.types';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

/**
 * Public profile screen reached via /user/[id]. Reads the id from the route,
 * tries Supabase first, then falls back to a mock profile if the id matches
 * one of the hand-curated entries, then surfaces "Profile not found."
 *
 * Reuses the same ProfileView + adapter that the personal /profile screen
 * uses — no duplicate UI. isOwnProfile defaults to false, so the hero shows
 * a Follow button instead of Edit Profile.
 */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthContext();
  const { blockedIds, refreshBlocked } = useAppContext();
  const isOwnProfile = Boolean(user?.id && id && user.id === id);
  const isBlockedUser = Boolean(id && blockedIds.has(id));

  const [displayProfile, setDisplayProfile] = useState<MockProfile | null>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found' | 'error'>('loading');
  const [retryTick, setRetryTick] = useState(0);

  // Moderation entry point (App Store 1.2): overflow → report / block.
  const [overflowVisible, setOverflowVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [blockConfirmVisible, setBlockConfirmVisible] = useState(false);
  const [unblockBusy, setUnblockBusy] = useState(false);

  async function handleBlock() {
    if (!user?.id || !id) return;
    try {
      await blockUser(user.id, id);
      await refreshBlocked(); // flips this screen to the blocked state
      setBlockConfirmVisible(false);
    } catch (e: unknown) {
      if (e instanceof ModerationUnavailableError) {
        setBlockConfirmVisible(false);
        Alert.alert('Not available yet', e.message);
        return;
      }
      throw e; // ConfirmSheet alerts and keeps the sheet open for retry
    }
  }

  async function handleUnblock() {
    if (!user?.id || !id || unblockBusy) return;
    setUnblockBusy(true);
    try {
      await unblockUser(user.id, id);
      await refreshBlocked();
    } catch (e: unknown) {
      Alert.alert(
        'Could not unblock',
        e instanceof ModerationUnavailableError ? e.message : 'Please try again.'
      );
    } finally {
      setUnblockBusy(false);
    }
  }

  // Follow state for the displayed user — loaded on mount, persisted on toggle.
  // followBusy guards against double-tap while the network call is in flight.
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!user?.id || !id || isOwnProfile) {
      setIsFollowingUser(false);
      return;
    }
    let cancelled = false;
    isFollowingService(user.id, id)
      .then((result) => {
        if (!cancelled) setIsFollowingUser(result);
      })
      .catch((err) => console.error('[user/[id]] isFollowing failed:', err));
    return () => {
      cancelled = true;
    };
  }, [user?.id, id, isOwnProfile]);

  async function handleToggleFollow() {
    if (!user?.id || !id || isOwnProfile || followBusy) return;
    const wasFollowing = isFollowingUser;
    // Optimistic flip + follower-count bump on the displayed profile so
    // the UI doesn't lag a network round trip.
    setIsFollowingUser(!wasFollowing);
    setDisplayProfile((prev) =>
      prev
        ? { ...prev, followersCount: Math.max(0, prev.followersCount + (wasFollowing ? -1 : 1)) }
        : prev
    );
    setFollowBusy(true);
    try {
      if (wasFollowing) {
        await unfollowUser(user.id, id);
      } else {
        await followUser(user.id, id);
      }
    } catch (err) {
      console.error('[user/[id]] toggle follow failed:', err);
      // Revert both pieces of optimistic state.
      setIsFollowingUser(wasFollowing);
      setDisplayProfile((prev) =>
        prev
          ? { ...prev, followersCount: Math.max(0, prev.followersCount + (wasFollowing ? 1 : -1)) }
          : prev
      );
    } finally {
      setFollowBusy(false);
    }
  }

  // Stats popup state — same model as /profile
  type OpenSheet = 'followers' | 'following' | 'circles' | 'activities' | null;
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<Profile[]>([]);
  const [userCircles, setUserCircles] = useState<CircleWithCounts[]>([]);
  const [userActivities, setUserActivities] = useState<EventWithRelations[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);

  // ── Initial fetch: Supabase only. The previous mock-profile fallback was
  // retired 2026-06-09 (Profile v2 #7): real DB profiles are the only
  // source of truth on the public profile page now. If the DB doesn't have
  // the id, the screen renders the ErrorState "Profile not found" path.
  useEffect(() => {
    if (!id) {
      setStatus('not_found');
      return;
    }
    let active = true;
    setStatus('loading');

    fetchRealProfile(id)
      .then((real) => {
        if (!active) return;
        if (real) {
          setDisplayProfile(real);
          setStatus('found');
        } else {
          setDisplayProfile(null);
          setStatus('not_found');
        }
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [id, retryTick]);

  // ── Lazy fetch for the three stats popups (same pattern as /profile)
  useEffect(() => {
    if (!id || !openSheet || status !== 'found') return;
    let active = true;
    setSheetLoading(true);

    const fetcher =
      openSheet === 'followers'
        ? getFollowers(id).then((data) => active && setFollowers(data))
        : openSheet === 'following'
        ? getFollowing(id).then((data) => active && setFollowing(data))
        : openSheet === 'circles'
        ? getMyCircles(id).then((data) => active && setUserCircles(data))
        : getMyRegisteredEvents(id).then((data) => active && setUserActivities(data));

    fetcher
      .catch(() => {
        if (active) {
          if (openSheet === 'followers') setFollowers([]);
          else if (openSheet === 'following') setFollowing([]);
          else if (openSheet === 'circles') setUserCircles([]);
          else setUserActivities([]);
        }
      })
      .finally(() => {
        if (active) setSheetLoading(false);
      });

    return () => {
      active = false;
    };
  }, [openSheet, id, status]);

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
        {/* Share + overflow hide in the blocked state — the only affordance
            there is the Unblock button in the body. */}
        {displayProfile && !isBlockedUser && (
          <View style={styles.navRight}>
            <TouchableOpacity
              onPress={() =>
                shareProfile({
                  id: displayProfile.id,
                  displayName: displayProfile.displayName,
                }).catch(() => {})
              }
              style={styles.navButton}
              accessibilityRole="button"
              accessibilityLabel="Share profile"
            >
              <Ionicons name="share-outline" size={22} color={colors.text.primary} />
            </TouchableOpacity>
            {!isOwnProfile && (
              <TouchableOpacity
                onPress={() => setOverflowVisible(true)}
                style={styles.navButton}
                accessibilityRole="button"
                accessibilityLabel="More options"
              >
                <Ionicons name="ellipsis-horizontal" size={22} color={colors.text.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {status === 'loading' && <ProfileSkeleton />}

      {status === 'not_found' && (
        <ErrorState
          icon="person-circle-outline"
          title="Profile not found"
          body="This account doesn't exist or may have been removed. Head back to find someone else."
          onBack={() => router.back()}
        />
      )}

      {status === 'error' && (
        <ErrorState
          icon="cloud-offline-outline"
          title="Couldn't load this profile"
          body="Check your connection and try again."
          onRetry={() => setRetryTick((t) => t + 1)}
          onBack={() => router.back()}
        />
      )}

      {/* Blocked state replaces the whole profile body (App Store 1.2):
          blocking must make the person's content disappear, not just
          disable a button. */}
      {status === 'found' && displayProfile && isBlockedUser && (
        <View style={styles.blockedState}>
          <Avatar
            uri={displayProfile.avatarUrl}
            name={displayProfile.displayName}
            size={BLOCKED_AVATAR}
          />
          <Text style={styles.blockedTitle}>
            You&apos;ve blocked {displayProfile.displayName}
          </Text>
          <Text style={styles.blockedBody}>
            They can&apos;t message you, and their activities are hidden from your feed.
          </Text>
          <Button label="Unblock" onPress={handleUnblock} isLoading={unblockBusy} size="md" />
        </View>
      )}

      {status === 'found' && displayProfile && !isBlockedUser && (
        <>
          <ProfileView
            profile={displayProfile}
            isOwnProfile={isOwnProfile}
            isFollowing={isOwnProfile ? undefined : isFollowingUser}
            onToggleFollow={isOwnProfile ? undefined : handleToggleFollow}
            followBusy={followBusy}
            onMessagePress={
              isOwnProfile ? undefined : () => router.push(`/messages/${id}`)
            }
            onFollowersPress={() => setOpenSheet('followers')}
            onFollowingPress={() => setOpenSheet('following')}
            onCirclesPress={() => setOpenSheet('circles')}
            onActivitiesPress={() => setOpenSheet('activities')}
          />

          <EntityListSheet
            visible={openSheet === 'followers'}
            title="Followers"
            subtitle={`${displayProfile.followersCount.toLocaleString('en-US')} followers`}
            type="user"
            items={followers}
            isLoading={sheetLoading && openSheet === 'followers'}
            emptyMessage="No followers yet."
            onClose={() => setOpenSheet(null)}
          />
          <EntityListSheet
            visible={openSheet === 'following'}
            title="Following"
            subtitle={`${displayProfile.followingCount.toLocaleString('en-US')} accounts`}
            type="user"
            items={following}
            isLoading={sheetLoading && openSheet === 'following'}
            emptyMessage="Not following anyone yet."
            onClose={() => setOpenSheet(null)}
          />
          <EntityListSheet
            visible={openSheet === 'circles'}
            title="Circles"
            subtitle={`${displayProfile.circlesCount.toLocaleString('en-US')} circles`}
            type="circle"
            items={userCircles}
            isLoading={sheetLoading && openSheet === 'circles'}
            emptyMessage="Not in any circles yet."
            onClose={() => setOpenSheet(null)}
          />
          <EntityListSheet
            visible={openSheet === 'activities'}
            title="Activities"
            subtitle={`${displayProfile.activitiesCount.toLocaleString('en-US')} total — created or registered`}
            type="activity"
            items={userActivities}
            withTimeTabs
            isLoading={sheetLoading && openSheet === 'activities'}
            emptyMessage="No activities yet."
            onClose={() => setOpenSheet(null)}
          />
        </>
      )}

      {/* Moderation sheets — outside the body branches so the block
          confirm can animate out while the body flips to the blocked state. */}
      <OverflowMenuSheet
        visible={overflowVisible}
        actions={[
          {
            label: 'Report user',
            icon: 'flag-outline',
            onPress: () => setReportVisible(true),
          },
          isBlockedUser
            ? { label: 'Unblock user', icon: 'person-add-outline', onPress: handleUnblock }
            : {
                label: 'Block user',
                icon: 'person-remove-outline',
                destructive: true,
                onPress: () => setBlockConfirmVisible(true),
              },
        ]}
        onClose={() => setOverflowVisible(false)}
      />
      <ReportSheet
        visible={reportVisible}
        targetType="profile"
        targetId={id ?? null}
        onClose={() => setReportVisible(false)}
      />
      <ConfirmSheet
        visible={blockConfirmVisible}
        title={`Block ${displayProfile?.displayName ?? 'this user'}?`}
        message="They won't be able to message you, and you won't see their activities or messages. They won't be notified."
        confirmLabel="Block"
        destructive
        onConfirm={handleBlock}
        onClose={() => setBlockConfirmVisible(false)}
      />
    </SafeAreaView>
  );
}

/**
 * Fetch a real user from Supabase, with all the same secondary queries the
 * personal /profile screen uses (counts + gallery). Returns null only when
 * no row for this id exists (genuine not-found); network/query errors from
 * getProfile propagate so the caller can show a retryable error state.
 * Secondary count/gallery queries still degrade silently — they must never
 * fail the whole page.
 */
async function fetchRealProfile(id: string): Promise<MockProfile | null> {
  const fullProfile = await getProfile(id);
  if (!fullProfile) return null;

  const [images, circleIds, activityCount] = await Promise.all([
    getProfileImages(id).catch(() => [] as ProfileImage[]),
    getMyCircleIds(id).catch(() => [] as string[]),
    getRegistrationCount(id).catch(() => 0),
  ]);

  return adaptProfileToDisplay(
    id,
    fullProfile,
    {
      followers: fullProfile.followers_count ?? 0,
      following: fullProfile.following_count ?? 0,
      circles: circleIds.length,
      activities: activityCount,
    },
    images,
  );
}

const BLOCKED_AVATAR = 96;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  navButton: { padding: spacing.sm },
  navRight: { flexDirection: 'row', alignItems: 'center' },
  blockedState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    // Lift the group toward the optical center — pure centering reads low
    // because the navBar already occupies the top.
    paddingBottom: spacing['3xl'],
  },
  blockedTitle: {
    fontFamily: typography.fontFamily.display,
    fontSize: 18,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  blockedBody: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  notFoundTitle: {
    fontFamily: typography.fontFamily.display,
    fontSize: 18,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  notFoundMessage: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('user-profile');
