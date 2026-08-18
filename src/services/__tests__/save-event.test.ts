/**
 * `saveEvent` must be idempotent.
 *
 * `saved_events` is `PRIMARY KEY (user_id, event_id)` (initial_schema.sql), and
 * the service used `.insert()` — so a second tap on the bookmark raised a
 * duplicate-key error, the caller threw, and the optimistic fill VISIBLY
 * reverted. To the user the app un-saved their event because they tapped it
 * twice. That reads as "saving is broken", on the exact feature Lara has
 * already reported losing her saves on.
 *
 * These tests pin the CALL, not a round trip: which verb, and which conflict
 * target. The conflict target is the half worth asserting — an upsert with an
 * inferred target would pass a "does it use upsert" test and still break the
 * moment another unique constraint is added to the table.
 */

import { saveEvent, unsaveEvent } from '../events.service';

const mockUpsert = jest.fn();
const mockInsert = jest.fn();
const mockEqSecond = jest.fn();
const mockEqFirst = jest.fn(() => ({ eq: mockEqSecond }));
const mockDelete = jest.fn(() => ({ eq: mockEqFirst }));
const mockFrom = jest.fn((..._args: unknown[]) => ({
  upsert: mockUpsert,
  insert: mockInsert,
  delete: mockDelete,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsert.mockResolvedValue({ error: null });
  mockInsert.mockResolvedValue({ error: null });
  mockEqSecond.mockResolvedValue({ error: null });
});

describe('saveEvent', () => {
  it('upserts on the composite primary key rather than inserting', () => {
    saveEvent('user-1', 'event-1');

    expect(mockFrom).toHaveBeenCalledWith('saved_events');
    expect(mockUpsert).toHaveBeenCalledWith(
      { user_id: 'user-1', event_id: 'event-1' },
      { onConflict: 'user_id,event_id' },
    );
    // The whole point: the insert path is gone, not merely wrapped.
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('names the conflict target explicitly instead of letting it be inferred', () => {
    // An inferred target silently re-points at a different constraint the day
    // one is added, and the failure would be this same bug with no diff to
    // blame it on.
    saveEvent('user-1', 'event-1');
    const [, options] = mockUpsert.mock.calls[0] as [unknown, { onConflict?: string }];
    expect(options?.onConflict).toBe('user_id,event_id');
  });

  it('saving the same event twice does not throw', async () => {
    await expect(saveEvent('user-1', 'event-1')).resolves.toBeUndefined();
    await expect(saveEvent('user-1', 'event-1')).resolves.toBeUndefined();
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it('still surfaces a real database error', async () => {
    // Idempotence must not become "swallow everything" — a genuine failure has
    // to reach the caller so the optimistic bookmark can be rolled back.
    mockUpsert.mockResolvedValue({ error: { message: 'permission denied' } });
    await expect(saveEvent('user-1', 'event-1')).rejects.toBeTruthy();
  });
});

describe('unsaveEvent', () => {
  it('deletes exactly the one row, scoped by both keys', async () => {
    await unsaveEvent('user-1', 'event-1');
    expect(mockFrom).toHaveBeenCalledWith('saved_events');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEqFirst).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mockEqSecond).toHaveBeenCalledWith('event_id', 'event-1');
  });
});
