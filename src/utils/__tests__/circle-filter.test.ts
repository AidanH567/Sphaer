import { filterCircles } from '@/utils/circle-filter';
import type { CircleWithCounts } from '@/types/circle.types';

function circle(over: Partial<CircleWithCounts> & { id: string; name: string }): CircleWithCounts {
  return {
    description: null,
    tags: null,
    creator_id: 'creator-1',
    avatar_url: null,
    cover_url: null,
    is_public: true,
    created_at: '2026-01-01T00:00:00Z',
    members_count: 0,
    activities_count: 0,
    ...over,
  } as CircleWithCounts;
}

const CIRCLES = [
  circle({ id: 'a', name: 'Techno Collective', description: 'Warehouse nights', tags: ['Music'] }),
  circle({ id: 'b', name: 'Film Club', description: 'Weekly screenings', tags: ['Film'] }),
  circle({ id: 'c', name: 'Print Room', description: 'Riso and techno zines', tags: ['Art', 'Music'] }),
  circle({ id: 'd', name: 'Untagged Crew', description: null, tags: null }),
];

const ids = (list: CircleWithCounts[]) => list.map((c) => c.id);

describe('filterCircles', () => {
  it('returns everything when there is no search text and no categories', () => {
    expect(ids(filterCircles(CIRCLES, '', []))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('matches on name, case-insensitively', () => {
    expect(ids(filterCircles(CIRCLES, 'FILM', []))).toEqual(['b']);
  });

  it('matches on description as well as name', () => {
    // "techno" is in a's NAME and in c's DESCRIPTION — both must come back.
    expect(ids(filterCircles(CIRCLES, 'techno', []))).toEqual(['a', 'c']);
  });

  it('matches on tags', () => {
    expect(ids(filterCircles(CIRCLES, 'art', []))).toEqual(['c']);
  });

  it('ignores surrounding whitespace in the query', () => {
    expect(ids(filterCircles(CIRCLES, '   film  ', []))).toEqual(['b']);
  });

  it('keeps a circle sharing at least one selected category (intersection, not superset)', () => {
    // c is tagged Art AND Music; selecting only Music must still keep it.
    expect(ids(filterCircles(CIRCLES, '', ['Music']))).toEqual(['a', 'c']);
  });

  it('treats multiple categories as OR', () => {
    expect(ids(filterCircles(CIRCLES, '', ['Film', 'Art']))).toEqual(['b', 'c']);
  });

  it('drops untagged circles once any category is selected', () => {
    expect(ids(filterCircles(CIRCLES, '', ['Music']))).not.toContain('d');
  });

  it('applies search AND category together', () => {
    expect(ids(filterCircles(CIRCLES, 'techno', ['Art']))).toEqual(['c']);
  });

  it('returns empty when nothing matches', () => {
    expect(filterCircles(CIRCLES, 'nonexistent', [])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = [...CIRCLES];
    filterCircles(input, 'film', ['Film']);
    expect(input).toEqual(CIRCLES);
  });
});
