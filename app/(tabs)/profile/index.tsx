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
import { getMockProfileById, CURRENT_USER_PROFILE_ID, type MockProfile } from '@/data/mockProfiles';
import {
  getProfile,
  getProfileImages,
  getGalleryImageUrl,
} from '@/services/profile.service';
import { getMyCircleIds } from '@/services/circles.service';
import { getRegistrationCount } from '@/services/registrations.service';
import { signOut } from '@/services/auth.service';
import { useAuthContext } from '@/context/AuthContext';
import type { Profile, ProfileImage, ProfileExperienceEntry } from '@/types/user.types';
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
    circles: number;
    activities: number;
  }>({ followers: 0, circles: 0, activities: 0 });
  const [gallery, setGallery] = useState<ProfileImage[]>([]);
  const [extrasLoading, setExtrasLoading] = useState(true);

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [signOutSheetVisible, setSignOutSheetVisible] = useState(false);

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
          trailingSlot={<AvailableForWorkBar location={displayProfile.location} />}
        />
      )}

      {signOutSheet}
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
 * Map a real `Profile` (+ counts + gallery rows) onto the `MockProfile` shape
 * that ProfileView still consumes. Keeping the adapter local means ProfileView
 * doesn't need to know whether its data came from Supabase or mock files.
 */
function adaptProfileToDisplay(
  userId: string,
  profile: Profile | null,
  counts: { followers: number; circles: number; activities: number },
  gallery: ProfileImage[]
): MockProfile {
  const locationLine = combineLocation(profile?.location ?? null, profile?.neighborhood ?? null);

  return {
    id: userId,
    displayName: profile?.display_name?.trim() || 'New member',
    role: (profile?.bio ?? '').trim(),
    location: locationLine,
    website: profile?.website ?? '',
    avatarUrl: profile?.avatar_url ?? '',
    verified: false, // deferred — see BACKLOG.md "Verified badge"
    followersCount: counts.followers,
    circlesCount: counts.circles,
    activitiesCount: counts.activities,
    about: profile?.about ?? '',
    activities: [], // events-by-creator not wired in the activity *list* yet
    experience: (profile?.experiences ?? []).map(experienceToDisplay),
    testimonials: [], // testimonials feature deferred — see BACKLOG.md
    images: gallery.map((g) => getGalleryImageUrl(g.path)),
  };
}

function experienceToDisplay(exp: ProfileExperienceEntry) {
  const parts = [exp.title, exp.organisation, formatDateRange(exp.start_date, exp.end_date)]
    .filter(Boolean)
    .join(' • ');
  return {
    id: exp.id,
    title: parts || exp.title || 'Experience',
    description: exp.description ?? '',
  };
}

function formatDateRange(start: string | null, end: string | null | undefined): string {
  if (!start && end === null) return 'Present';
  if (!start) return '';
  if (end === null || end === undefined || end === '') return `${start}–Present`;
  return `${start}–${end}`;
}

function combineLocation(location: string | null, neighborhood: string | null): string {
  if (location && neighborhood) return `${neighborhood}, ${location}`;
  return neighborhood || location || '';
}

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
