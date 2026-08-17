import { getCircleUpcomingEvents } from '../events.service';
import { dayKey } from '@/utils/pinned-events';

// Fluent stub of the one PostgREST chain getCircleUpcomingEvents uses:
// from('events').select(...).eq(...).gte(...).order(...).limit(n).
// `mock`-prefixed so jest's babel plugin allows them inside the factory.
const mockLimit = jest.fn();
const mockOrder = jest.fn(() => ({ limit: mockLimit }));
const mockGte = jest.fn(() => ({ order: mockOrder }));
const mockEq = jest.fn(() => ({ gte: mockGte }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
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

describe('getCircleUpcomingEvents', () => {
  it('scopes to the circle, orders soonest-first, and caps the window', async () => {
    await getCircleUpcomingEvents('circle-1', { from: new Date(2026, 7, 17, 14, 30) });

    expect(mockFrom).toHaveBeenCalledWith('events');
    expect(mockEq).toHaveBeenCalledWith('circle_id', 'circle-1');
    expect(mockOrder).toHaveBeenCalledWith('starts_at', { ascending: true });
    expect(mockLimit).toHaveBeenCalledWith(20);
  });

  it('opens the window at LOCAL midnight, not "now"', async () => {
    // An event that started at 20:00 and runs until 04:00 must still come
    // back at 23:00 — filtering on `now` server-side would drop it, and it is
    // precisely the event people open the chat to find.
    const at = new Date(2026, 7, 17, 23, 0);
    await getCircleUpcomingEvents('circle-1', { from: at });

    const [column, isoBound] = mockGte.mock.calls[0] as unknown as [string, string];
    expect(column).toBe('starts_at');

    const bound = new Date(isoBound);
    expect(dayKey(bound)).toBe('2026-08-17');
    expect(bound.getHours()).toBe(0);
    expect(bound.getMinutes()).toBe(0);
  });

  it('honours a custom limit', async () => {
    await getCircleUpcomingEvents('circle-1', { from: new Date(2026, 7, 17), limit: 5 });

    expect(mockLimit).toHaveBeenCalledWith(5);
  });

  it('returns the rows the query yields', async () => {
    const rows = [{ id: 'evt-1' }, { id: 'evt-2' }];
    mockLimit.mockResolvedValue({ data: rows, error: null });

    const result = await getCircleUpcomingEvents('circle-1');

    expect(result.map((e) => e.id)).toEqual(['evt-1', 'evt-2']);
  });

  it('returns an empty array when the query yields null data', async () => {
    mockLimit.mockResolvedValue({ data: null, error: null });

    await expect(getCircleUpcomingEvents('circle-1')).resolves.toEqual([]);
  });

  it('throws the PostgREST error so the hook can surface a retry line', async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    await expect(getCircleUpcomingEvents('circle-1')).rejects.toEqual({
      message: 'permission denied',
    });
  });
});
