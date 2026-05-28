import type { MockProfile } from '@/data/mockProfiles';
import type { Profile, ProfileImage, ProfileExperienceEntry } from '@/types/user.types';
import { getGalleryImageUrl } from '@/services/profile.service';

export interface ProfileCounts {
  followers: number;
  following: number;
  circles: number;
  activities: number;
}

/**
 * Map a real Supabase `Profile` (+ live counts + gallery rows) onto the
 * `MockProfile` shape that ProfileView consumes. Keeping the adapter shared
 * means the personal /profile screen and the public /user/[id] screen both
 * present user data through one consistent transform.
 *
 * Empty arrays + sensible string defaults mean ProfileView's empty-state
 * branches still work for sparse profiles.
 */
export function adaptProfileToDisplay(
  userId: string,
  profile: Profile | null,
  counts: ProfileCounts,
  gallery: ProfileImage[],
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
    followingCount: counts.following,
    circlesCount: counts.circles,
    activitiesCount: counts.activities,
    about: profile?.about ?? '',
    activities: [], // events-by-creator list TBD (count is live; list not yet)
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
