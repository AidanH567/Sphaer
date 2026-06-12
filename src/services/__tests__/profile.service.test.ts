import { searchProfiles } from '../profile.service';

// Fluent stub of the one PostgREST chain searchProfiles uses:
// from('profiles').select('*').or(...).order(...).limit(n) → { data, error }.
// All consts are `mock`-prefixed so jest's babel plugin allows them inside
// the factory; the arrow defers evaluation until after they're initialized.
const mockLimit = jest.fn();
const mockOrder = jest.fn(() => ({ limit: mockLimit }));
const mockOr = jest.fn(() => ({ order: mockOrder }));
const mockSelect = jest.fn(() => ({ or: mockOr }));
const mockFrom = jest.fn((..._args: unknown[]) => ({ select: mockSelect }));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockLimit.mockResolvedValue({ data: [], error: null });
});

describe('searchProfiles', () => {
  it('ilike-matches display_name + username, ordered, capped at the default limit of 5', async () => {
    await searchProfiles('anna');

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockOr).toHaveBeenCalledWith('display_name.ilike.%anna%,username.ilike.%anna%');
    expect(mockOrder).toHaveBeenCalledWith('display_name', { ascending: true });
    expect(mockLimit).toHaveBeenCalledWith(5);
  });

  it('strips PostgREST-reserved characters (, ( ) : *) from the query edges', async () => {
    // Same sanitization as events.service getEvents — reserved chars become
    // spaces, then the result is trimmed. 'dj,(:*)' must collapse to 'dj'.
    await searchProfiles('dj,(:*)');

    expect(mockOr).toHaveBeenCalledWith('display_name.ilike.%dj%,username.ilike.%dj%');
  });

  it('replaces interior reserved characters with spaces instead of deleting them', async () => {
    await searchProfiles('kreuz*berg');

    expect(mockOr).toHaveBeenCalledWith(
      'display_name.ilike.%kreuz berg%,username.ilike.%kreuz berg%'
    );
  });

  it('returns [] without querying when the query sanitizes to nothing', async () => {
    const result = await searchProfiles(' ,():* ');

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('passes a custom limit through and returns the matched rows', async () => {
    const rows = [{ id: 'p1' }, { id: 'p2' }];
    mockLimit.mockResolvedValue({ data: rows, error: null });

    const result = await searchProfiles('anna', 2);

    expect(mockLimit).toHaveBeenCalledWith(2);
    expect(result).toEqual(rows);
  });

  it('throws when supabase reports an error', async () => {
    mockLimit.mockResolvedValue({ data: null, error: new Error('boom') });

    await expect(searchProfiles('anna')).rejects.toThrow('boom');
  });
});
