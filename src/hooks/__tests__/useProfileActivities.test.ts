/**
 * `useProfileActivities` — a FAILED query and an EMPTY one must not look alike.
 *
 * Only the `going` query used to raise the error. So a network timeout on the
 * saved-events query fell through to `savedResult ?? []` and the Activities
 * sheet said, calmly and with no error anywhere, that you have saved nothing.
 * That is the worst possible reading of a failure: it is indistinguishable from
 * the truth, and it lands on the exact feature Lara reported as losing her
 * saves — so it would have been read as confirmation of a different bug.
 *
 * The distinction the fix relies on, and the reason these tests check both
 * directions: `null` means "attempted and failed", while a query that is
 * deliberately NOT run resolves to `[]`. Checking all three results for `null`
 * therefore cannot raise an error for a query nobody made.
 */

import { renderHook, waitFor } from '@testing-library/react-native';

import { useProfileActivities } from '../useProfileActivities';

const mockGetSavedEvents = jest.fn();
const mockGetEventsByCreator = jest.fn();
const mockGetMyRegisteredEvents = jest.fn();

jest.mock('@/services/events.service', () => ({
  getSavedEvents: (...a: unknown[]) => mockGetSavedEvents(...a),
  getEventsByCreator: (...a: unknown[]) => mockGetEventsByCreator(...a),
}));
jest.mock('@/services/registrations.service', () => ({
  getMyRegisteredEvents: (...a: unknown[]) => mockGetMyRegisteredEvents(...a),
}));

const event = (id: string) => ({ id, title: id, starts_at: '2026-09-01T20:00:00+00:00' });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMyRegisteredEvents.mockResolvedValue([]);
  mockGetSavedEvents.mockResolvedValue([]);
  mockGetEventsByCreator.mockResolvedValue([]);
});

describe('useProfileActivities', () => {
  it('reports no error when every query simply came back empty', async () => {
    const { result } = renderHook(() => useProfileActivities('user-1', true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it('raises an error when the SAVED query fails, instead of showing zero saves', async () => {
    mockGetSavedEvents.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useProfileActivities('user-1', true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Could not load activities');
  });

  it('raises an error when the HOSTING query fails on someone else\'s profile', async () => {
    mockGetEventsByCreator.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useProfileActivities('user-2', false));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Could not load activities');
  });

  it('still raises an error when the GOING query fails', async () => {
    mockGetMyRegisteredEvents.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useProfileActivities('user-1', true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Could not load activities');
  });

  it('does not raise an error for a query it deliberately never ran', async () => {
    // Saved is own-profile-only; hosting is other-profile-only. The skipped one
    // resolves to [], not null, so neither may be mistaken for a failure — this
    // is what stops the stricter check from crying wolf on every profile view.
    const own = renderHook(() => useProfileActivities('user-1', true));
    await waitFor(() => expect(own.result.current.isLoading).toBe(false));
    expect(own.result.current.error).toBeNull();
    expect(mockGetEventsByCreator).not.toHaveBeenCalled();

    jest.clearAllMocks();
    mockGetMyRegisteredEvents.mockResolvedValue([]);
    mockGetSavedEvents.mockResolvedValue([]);
    mockGetEventsByCreator.mockResolvedValue([]);

    const other = renderHook(() => useProfileActivities('user-2', false));
    await waitFor(() => expect(other.result.current.isLoading).toBe(false));
    expect(other.result.current.error).toBeNull();
    expect(mockGetSavedEvents).not.toHaveBeenCalled();
  });

  it('keeps the queries that DID succeed, rather than blanking everything', async () => {
    // Degrading independently is the existing posture and the fix must not
    // trade it away: an error alongside real data beats an empty sheet.
    mockGetMyRegisteredEvents.mockResolvedValue([event('going-1')]);
    mockGetSavedEvents.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useProfileActivities('user-1', true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Could not load activities');
    expect(result.current.registeredIds.has('going-1')).toBe(true);
  });

  it('is idle with no user, and raises nothing', async () => {
    const { result } = renderHook(() => useProfileActivities(undefined, true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(mockGetMyRegisteredEvents).not.toHaveBeenCalled();
  });
});
