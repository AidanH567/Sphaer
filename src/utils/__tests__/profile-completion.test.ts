import { computeProfileCompletion } from '../profile-completion';
import type { Profile } from '@/types/user.types';

// computeProfileCompletion only reads 6 fields — partial objects cast via
// unknown keep the fixtures readable without faking the full DB row.
const profile = (over: Record<string, unknown>): Profile =>
  ({
    avatar_url: null,
    bio: null,
    about: null,
    location: null,
    disciplines: null,
    experiences: null,
    ...over,
  } as unknown as Profile);

const FULL = {
  avatar_url: 'https://x/a.jpg',
  bio: 'Filmmaker',
  about: 'About me',
  location: 'Berlin',
  disciplines: ['film'],
  experiences: [{ id: '1' }],
};

describe('computeProfileCompletion', () => {
  it('null profile → 100% (no nag before data loads)', () => {
    expect(computeProfileCompletion(null)).toEqual({ percentage: 100, missing: [] });
  });

  it('empty profile → 0% with all six fields missing', () => {
    const r = computeProfileCompletion(profile({}));
    expect(r.percentage).toBe(0);
    expect(r.missing).toHaveLength(6);
  });

  it('full profile → 100% with nothing missing', () => {
    expect(computeProfileCompletion(profile(FULL))).toEqual({
      percentage: 100,
      missing: [],
    });
  });

  it('one of six filled → 17%', () => {
    const r = computeProfileCompletion(profile({ avatar_url: 'x' }));
    expect(r.percentage).toBe(17);
    expect(r.missing.map((m) => m.key)).not.toContain('avatar_url');
  });

  it('whitespace-only strings count as empty', () => {
    const r = computeProfileCompletion(profile({ bio: '   ' }));
    expect(r.missing.map((m) => m.key)).toContain('bio');
  });

  it('empty arrays count as empty', () => {
    const r = computeProfileCompletion(profile({ disciplines: [], experiences: [] }));
    expect(r.missing.map((m) => m.key)).toEqual(
      expect.arrayContaining(['disciplines', 'experiences']),
    );
  });
});
