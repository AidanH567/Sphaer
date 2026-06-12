import { adaptProfileToDisplay, isVerified } from '@/components/profile/adaptProfile';
import type { Profile } from '@/types/user.types';

// adaptProfile only uses profile.service for gallery URL resolution — stub
// it so the Supabase client never loads in the test environment.
jest.mock('@/services/profile.service', () => ({
  getGalleryImageUrl: (path: string) => `https://cdn.test/${path}`,
}));

/**
 * The generated Row type is wide; tests only care about a handful of fields,
 * so we build sparse rows through `unknown` — same boundary trick the app
 * uses for not-yet-generated columns.
 */
function makeProfile(extra: Record<string, unknown> = {}): Profile {
  return {
    id: 'user-1',
    username: 'lea',
    display_name: 'Lea Weber',
    bio: 'Filmmaker',
    avatar_url: null,
    location: 'Berlin',
    neighborhood: null,
    website: null,
    about: null,
    experiences: null,
    ...extra,
  } as unknown as Profile;
}

const counts = { followers: 1, following: 2, circles: 3, activities: 4 };

describe('isVerified', () => {
  it('is false for a null profile', () => {
    expect(isVerified(null)).toBe(false);
  });

  it('is false when the column does not exist yet (pre-migration database)', () => {
    expect(isVerified(makeProfile())).toBe(false);
  });

  it('is false when verified is false', () => {
    expect(isVerified(makeProfile({ verified: false }))).toBe(false);
  });

  it('is true only for a strict boolean true', () => {
    expect(isVerified(makeProfile({ verified: true }))).toBe(true);
    // Non-boolean junk must never light the badge.
    expect(isVerified(makeProfile({ verified: 'true' }))).toBe(false);
    expect(isVerified(makeProfile({ verified: 1 }))).toBe(false);
    expect(isVerified(makeProfile({ verified: null }))).toBe(false);
  });
});

describe('adaptProfileToDisplay', () => {
  it('threads verified through to the display profile', () => {
    const display = adaptProfileToDisplay('user-1', makeProfile({ verified: true }), counts, []);
    expect(display.verified).toBe(true);
  });

  it('defaults verified to false when the row lacks the column', () => {
    const display = adaptProfileToDisplay('user-1', makeProfile(), counts, []);
    expect(display.verified).toBe(false);
  });

  it('defaults verified to false for a null profile', () => {
    const display = adaptProfileToDisplay('user-1', null, counts, []);
    expect(display.verified).toBe(false);
    expect(display.displayName).toBe('New member');
  });
});
