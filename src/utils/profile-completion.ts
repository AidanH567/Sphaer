import type { Profile } from '@/types/user.types';

export interface ProfileCompletionField {
  /** Stable key for diagnostics + edit-routing later. */
  key: 'avatar_url' | 'bio' | 'about' | 'location' | 'disciplines' | 'experiences';
  /** Reader-friendly fragment for the "Add X and Y" copy. */
  label: string;
}

export interface ProfileCompletion {
  /** 0–100 integer. */
  percentage: number;
  /** Fields that are still missing, in display order. */
  missing: ProfileCompletionField[];
}

// Six fields, equal weight. cover_url is intentionally excluded — there's no
// editor for it today (ProfileForm exposes avatar only), so counting it would
// cap every real user below 100% with no way to fix it. neighborhood is set
// automatically by the location-onboarding flow, not by the profile editor —
// counting it would double-penalise users who skipped that flow.
const FIELDS: ProfileCompletionField[] = [
  { key: 'avatar_url',  label: 'a profile photo' },
  { key: 'bio',         label: 'a tagline' },
  { key: 'about',       label: 'an about section' },
  { key: 'location',    label: 'your city' },
  { key: 'disciplines', label: 'your disciplines' },
  { key: 'experiences', label: 'your experience' },
];

/**
 * Compute how complete a user's profile is and which fields are still empty.
 *
 * Returns 100% for `null` profiles so the UI doesn't show a nag bar to a user
 * whose data hasn't loaded yet — the bar only shows once we know it's needed.
 *
 * Hand-tested examples (re-verify if you change FIELDS):
 *   computeProfileCompletion(null)                                      → { 100, [] }
 *   computeProfileCompletion({ ...empty })                              → { 0,   6 items }
 *   computeProfileCompletion({ avatar_url: 'x' })                        → { 17,  5 items }
 *   computeProfileCompletion({ avatar_url: 'x', bio: 'y', about: 'z',
 *                              location: 'Berlin', disciplines: ['Art'],
 *                              experiences: [{ id: '1', ... }] })        → { 100, [] }
 *
 * Whitespace-only strings count as empty (a single space in `bio` shouldn't
 * silently mark the field as filled).
 */
export function computeProfileCompletion(profile: Profile | null): ProfileCompletion {
  if (!profile) return { percentage: 100, missing: [] };

  const missing: ProfileCompletionField[] = [];
  for (const field of FIELDS) {
    if (!isFilled(profile, field.key)) missing.push(field);
  }

  const filled = FIELDS.length - missing.length;
  const percentage = Math.round((filled / FIELDS.length) * 100);
  return { percentage, missing };
}

function isFilled(profile: Profile, key: ProfileCompletionField['key']): boolean {
  switch (key) {
    case 'avatar_url':
      return nonEmptyString(profile.avatar_url);
    case 'bio':
      return nonEmptyString(profile.bio);
    case 'about':
      return nonEmptyString(profile.about);
    case 'location':
      return nonEmptyString(profile.location);
    case 'disciplines':
      return Array.isArray(profile.disciplines) && profile.disciplines.length > 0;
    case 'experiences':
      return Array.isArray(profile.experiences) && profile.experiences.length > 0;
  }
}

function nonEmptyString(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
