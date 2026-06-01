import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ProfileView } from '@/components/profile/ProfileView';
import { adaptProfileToDisplay } from '@/components/profile/adaptProfile';
import { useAuthContext } from '@/context/AuthContext';
import { getProfile, getProfileImages, getFollowers, getFollowing } from '@/services/profile.service';
import { getMyCircleIds, getMyCircles } from '@/services/circles.service';
import { getRegistrationCount, getMyRegisteredEvents } from '@/services/registrations.service';
import { EntityListSheet } from '@/components/ui/EntityListSheet';
import { getMockProfileByExactId, type MockProfile } from '@/data/mockProfiles';
import { colors, typography, spacing } from '@/constants/theme';
import type { Profile, ProfileImage } from '@/types/user.types';
import type { CircleWithCounts } from '@/types/circle.types';
import type { EventWithRelations } from '@/types/event.types';

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
  const isOwnProfile = Boolean(user?.id && id && user.id === id);

  const [displayProfile, setDisplayProfile] = useState<MockProfile | null>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found'>('loading');

  // Stats popup state — same model as /profile
  type OpenSheet = 'followers' | 'following' | 'circles' | 'activities' | null;
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<Profile[]>([]);
  const [userCircles, setUserCircles] = useState<CircleWithCounts[]>([]);
  const [userActivities, setUserActivities] = useState<EventWithRelations[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);

  // ── Initial fetch: Supabase first, then mock fallback, then "not found" ──
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
          return;
        }
        // Supabase didn't have this id — try the mock catalog by exact id
        const mock = getMockProfileByExactId(id);
        if (mock) {
          setDisplayProfile(mock);
          setStatus('found');
        } else {
          setDisplayProfile(null);
          setStatus('not_found');
        }
      })
      .catch(() => {
        if (active) setStatus('not_found');
      });

    return () => {
      active = false;
    };
  }, [id]);

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
        <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {status === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.black} />
        </View>
      )}

      {status === 'not_found' && (
        <View style={styles.center}>
          <Ionicons name="person-circle-outline" size={56} color={colors.text.tertiary} />
          <Text style={styles.notFoundTitle}>Profile not found</Text>
          <Text style={styles.notFoundMessage}>
            This account doesn't exist or may have been removed.
          </Text>
        </View>
      )}

      {status === 'found' && displayProfile && (
        <>
          <ProfileView
            profile={displayProfile}
            isOwnProfile={isOwnProfile}
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
    </SafeAreaView>
  );
}

/**
 * Fetch a real user from Supabase, with all the same secondary queries the
 * personal /profile screen uses (counts + gallery). Returns null if no row
 * for this id exists — caller falls back to mock by id then "not found."
 */
async function fetchRealProfile(id: string): Promise<MockProfile | null> {
  try {
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
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  navBar: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  navButton: { padding: spacing.sm },
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
