import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ProfileView } from '@/components/profile/ProfileView';
import { ProfileIncompleteBanner } from '@/components/profile/ProfileIncompleteBanner';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { getMockProfileById, CURRENT_USER_PROFILE_ID } from '@/data/mockProfiles';
import { adaptProfileToDisplay } from '@/components/profile/adaptProfile';
import {
  getProfile,
  getProfileImages,
  getFollowers,
  getFollowing,
} from '@/services/profile.service';
import { getMyCircleIds, getMyCircles } from '@/services/circles.service';
import { getRegistrationCount, getMyRegisteredEvents } from '@/services/registrations.service';
import { getSavedEvents } from '@/services/events.service';
import { signOut } from '@/services/auth.service';
import { useAuthContext } from '@/context/AuthContext';
import type { Profile, ProfileImage } from '@/types/user.types';
import type { CircleWithCounts } from '@/types/circle.types';
import type { EventWithRelations } from '@/types/event.types';
import { EntityListSheet } from '@/components/ui/EntityListSheet';
import { colors, typography, spacing } from '@/constants/theme';

const INK = '#1B1B18';
const META = '#767779';
const SUCCESS_DOT = '#2A7E3B';

// NOTE: real authed users come from Supabase. In __DEV__ with no session
// we still fall back to mockProfiles for UI iteration without auth.

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, isLoading: authLoading } = useAuthContext();

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

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [signOutSheetVisible, setSignOutSheetVisible] = useState(false);

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
        <View style={styles.center}>
          <ActivityIndicator color={INK} />
        </View>
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
        <TopBar onSignOut={handleSignOut} />
        <ProfileView
          profile={mock}
          isOwnProfile
          trailingSlot={<AvailableForWorkBar location={mock.location} />}
        />
        {signOutSheet}
      </SafeAreaView>
    );
  }

  // ── Real authed user ─────────────────────────────────────────────────────
  const displayProfile = adaptProfileToDisplay(user.id, profile, counts, gallery);
  const missing = computeMissing(profile);
  const showBanner = missing.length > 0 && !bannerDismissed;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopBar onSignOut={handleSignOut} />

      {showBanner && (
        <ProfileIncompleteBanner
          missing={missing}
          onDismiss={() => setBannerDismissed(true)}
          onEditPress={handleEdit}
        />
      )}

      {extrasLoading && gallery.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={INK} />
        </View>
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
          trailingSlot={<AvailableForWorkBar location={displayProfile.location} />}
        />
      )}

      {signOutSheet}
      {statsSheets}
    </SafeAreaView>
  );
}

// ─── Top nav row ─────────────────────────────────────────────────────────────

function TopBar({ onSignOut }: { onSignOut: () => void }) {
  return (
    <View style={styles.navBar}>
      <View style={styles.navButton} />
      <TouchableOpacity onPress={onSignOut} style={styles.navButton}>
        <Ionicons name="log-out-outline" size={24} color={colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Available for work — placeholder until the feature ships ────────────────

function AvailableForWorkBar({ location }: { location: string }) {
  return (
    <View style={styles.availableBar}>
      <View style={styles.availableLeft}>
        <View style={styles.availableTitleRow}>
          <View style={styles.availableDot} />
          <Text style={styles.availableTitle}>Available for work</Text>
        </View>
        <View style={styles.availableLocationRow}>
          <Ionicons name="navigate" size={11} color={META} />
          <Text style={styles.availableLocation}>{location || 'Berlin'}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.getInTouchButton}
        onPress={() =>
          Alert.alert('Coming soon', 'DMs are not wired up yet — sit tight.')
        }
        activeOpacity={0.85}
      >
        <Text style={styles.getInTouchText}>Get in touch</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * What's missing from the profile for the soft-gate banner. The banner only
 * shows when this list is non-empty.
 */
function computeMissing(profile: Profile | null): string[] {
  if (!profile) return [];
  const missing: string[] = [];
  if (!profile.avatar_url) missing.push('a profile photo');
  if (!profile.bio || profile.bio.trim().length === 0) missing.push('a tagline');
  if (!profile.about || profile.about.trim().length === 0) missing.push('an about section');
  return missing;
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

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Available-for-work placeholder bar
  availableBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.base,
    paddingHorizontal: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  availableLeft: { flex: 1, gap: 2 },
  availableTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  availableDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: SUCCESS_DOT,
  },
  availableTitle: {
    fontFamily: typography.fontFamily.display,
    fontSize: 15,
    fontWeight: typography.fontWeight.bold,
    color: INK,
  },
  availableLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 17,
  },
  availableLocation: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: META,
  },
  getInTouchButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
    backgroundColor: INK,
  },
  getInTouchText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.medium,
    color: colors.white,
  },
});
