import {
  blockUser,
  unblockUser,
  getBlockedIds,
  isBlocked,
  listBlockedProfiles,
  submitReport,
  ModerationUnavailableError,
} from '../moderation.service';

// ---------------------------------------------------------------------------
// One shared PostgREST stub. Each test sets `next*` results before calling the
// service; the fluent builder ignores intermediate `.eq()/.order()/.select()`
// links and resolves at the terminal the service awaits:
//   - inserts/deletes await the builder itself (thenable) → nextWrite
//   - getBlockedIds awaits after .eq()                     → nextRead
//   - isBlocked awaits .maybeSingle()                      → nextMaybeSingle
//   - listBlockedProfiles awaits .order() on blocked_users → nextRead,
//     then .in() on profiles                                → nextProfiles
// All consts are `mock`-prefixed so jest's babel factory allows them.
// ---------------------------------------------------------------------------

type Result = { data?: unknown; error: unknown };

let mockNextWrite: Result;
let mockNextRead: Result;
let mockNextMaybeSingle: Result;
let mockNextProfiles: Result;

const mockFromImpl = (_table: string) => {
  // A single chainable + awaitable builder. `.select()/.eq()/.delete()/
  // .order()` all return the same builder, so awaiting at any point (the
  // service awaits after `.eq()` for reads and after `.order()` for the
  // blocked_users list) resolves the read result for the current table.
  // `.insert()` and `.in()` resolve their own dedicated terminals, and
  // `.maybeSingle()` returns a plain promise.
  // Read/select chain: `.select()/.eq()/.order()` return the same node, and
  // awaiting it (after `.eq()` for getBlockedIds, after `.order()` for the
  // list's step 1) resolves the read result. `.maybeSingle()` resolves the
  // single-row result. `profiles` is only read via `.in()` (its own
  // terminal), so this await path is always a blocked_users read.
  const readChain = makeChainThenable(() => mockNextRead, ['select', 'eq', 'order']);
  readChain.maybeSingle = () => Promise.resolve(mockNextMaybeSingle);
  // listBlockedProfiles step 2: `from('profiles').select('*').in('id', ids)`.
  readChain.in = () => makeChainThenable(() => mockNextProfiles, []);

  // Delete chain: `.delete().eq().eq()` resolves the write result.
  const deleteChain = makeChainThenable(() => mockNextWrite, ['eq']);

  return {
    select: () => readChain,
    delete: () => deleteChain,
    insert: () => makeChainThenable(() => mockNextWrite, []),
  };
};

/** A node that is awaitable (resolves `resolve()`) and also returns itself
 *  from each of the given chain methods, so `.eq().eq()…` stays fluent. */
function makeChainThenable(resolve: () => Result, chainMethods: string[]) {
  const node: Record<string, unknown> = {
    then: (onFulfilled: (v: Result) => unknown) => Promise.resolve(resolve()).then(onFulfilled),
  };
  for (const m of chainMethods) node[m] = () => node;
  return node;
}

const mockFrom = jest.fn(mockFromImpl);

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

// Postgres / PostgREST "table is missing from the schema cache" shapes.
const MISSING_TABLE_42P01 = { code: '42P01', message: 'relation "blocked_users" does not exist' };
const MISSING_TABLE_PGRST205 = {
  code: 'PGRST205',
  message: "Could not find the table 'public.reports' in the schema cache",
};
const MISSING_TABLE_MESSAGE_ONLY = { message: 'Something something schema cache reload needed' };

beforeEach(() => {
  jest.clearAllMocks();
  mockNextWrite = { error: null };
  mockNextRead = { data: [], error: null };
  mockNextMaybeSingle = { data: null, error: null };
  mockNextProfiles = { data: [], error: null };
});

describe('blockUser', () => {
  it('inserts the (blocker, blocked) row and resolves on success', async () => {
    await expect(blockUser('me', 'them')).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith('blocked_users');
  });

  it('treats a unique_violation (23505) as already-blocked, no throw', async () => {
    mockNextWrite = { error: { code: '23505', message: 'duplicate key' } };
    await expect(blockUser('me', 'them')).resolves.toBeUndefined();
  });

  it('throws ModerationUnavailableError when the table is missing (42P01)', async () => {
    mockNextWrite = { error: MISSING_TABLE_42P01 };
    await expect(blockUser('me', 'them')).rejects.toBeInstanceOf(ModerationUnavailableError);
  });

  it('rethrows an unrelated error untouched', async () => {
    const boom = { code: '42501', message: 'permission denied' };
    mockNextWrite = { error: boom };
    await expect(blockUser('me', 'them')).rejects.toBe(boom);
  });
});

describe('unblockUser', () => {
  it('resolves on a clean delete', async () => {
    await expect(unblockUser('me', 'them')).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith('blocked_users');
  });

  it('throws ModerationUnavailableError when the table is missing (message-only)', async () => {
    mockNextWrite = { error: MISSING_TABLE_MESSAGE_ONLY };
    await expect(unblockUser('me', 'them')).rejects.toBeInstanceOf(ModerationUnavailableError);
  });
});

describe('getBlockedIds', () => {
  it('maps rows to a flat array of blocked ids', async () => {
    mockNextRead = { data: [{ blocked_id: 'a' }, { blocked_id: 'b' }], error: null };
    await expect(getBlockedIds('me')).resolves.toEqual(['a', 'b']);
  });

  it('degrades to [] when the table is missing (PGRST205)', async () => {
    mockNextRead = { data: null, error: MISSING_TABLE_PGRST205 };
    await expect(getBlockedIds('me')).resolves.toEqual([]);
  });

  it('rethrows a non-missing-table error', async () => {
    const boom = { code: '42501', message: 'permission denied' };
    mockNextRead = { data: null, error: boom };
    await expect(getBlockedIds('me')).rejects.toBe(boom);
  });
});

describe('isBlocked', () => {
  it('returns true when a block row exists', async () => {
    mockNextMaybeSingle = { data: { blocked_id: 'them' }, error: null };
    await expect(isBlocked('me', 'them')).resolves.toBe(true);
  });

  it('returns false when there is no row', async () => {
    mockNextMaybeSingle = { data: null, error: null };
    await expect(isBlocked('me', 'them')).resolves.toBe(false);
  });

  it('degrades to false when the table is missing (42P01)', async () => {
    mockNextMaybeSingle = { data: null, error: MISSING_TABLE_42P01 };
    await expect(isBlocked('me', 'them')).resolves.toBe(false);
  });
});

describe('listBlockedProfiles', () => {
  it('returns [] without hitting profiles when there are no blocks', async () => {
    mockNextRead = { data: [], error: null };
    await expect(listBlockedProfiles('me')).resolves.toEqual([]);
    expect(mockFrom).toHaveBeenCalledWith('blocked_users');
    expect(mockFrom).not.toHaveBeenCalledWith('profiles');
  });

  it('hydrates profiles and re-sorts them by block recency', async () => {
    // blocked_users comes back newest-first: [b, a]. profiles.in() returns
    // them in arbitrary order; the service must restore the [b, a] order.
    mockNextRead = {
      data: [
        { blocked_id: 'b', created_at: '2026-02-01' },
        { blocked_id: 'a', created_at: '2026-01-01' },
      ],
      error: null,
    };
    mockNextProfiles = {
      data: [
        { id: 'a', display_name: 'Anna' },
        { id: 'b', display_name: 'Bea' },
      ],
      error: null,
    };

    const result = await listBlockedProfiles('me');

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(result.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('drops ids whose profile no longer exists', async () => {
    mockNextRead = {
      data: [
        { blocked_id: 'a', created_at: '2026-01-02' },
        { blocked_id: 'gone', created_at: '2026-01-01' },
      ],
      error: null,
    };
    mockNextProfiles = { data: [{ id: 'a', display_name: 'Anna' }], error: null };

    const result = await listBlockedProfiles('me');
    expect(result.map((p) => p.id)).toEqual(['a']);
  });

  it('degrades to [] when the blocked_users table is missing', async () => {
    mockNextRead = { data: null, error: MISSING_TABLE_42P01 };
    await expect(listBlockedProfiles('me')).resolves.toEqual([]);
    expect(mockFrom).not.toHaveBeenCalledWith('profiles');
  });
});

describe('submitReport', () => {
  it('inserts a report and resolves on success', async () => {
    await expect(
      submitReport('me', { targetType: 'event', targetId: 'e1', reason: 'spam' })
    ).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith('reports');
  });

  it('throws ModerationUnavailableError when the reports table is missing', async () => {
    mockNextWrite = { error: MISSING_TABLE_PGRST205 };
    await expect(
      submitReport('me', { targetType: 'profile', targetId: 'p1', reason: 'harassment' })
    ).rejects.toBeInstanceOf(ModerationUnavailableError);
  });

  it('rethrows an unrelated insert error', async () => {
    const boom = { code: '23514', message: 'check constraint violation' };
    mockNextWrite = { error: boom };
    await expect(
      submitReport('me', { targetType: 'circle', targetId: 'c1', reason: 'other', details: 'x' })
    ).rejects.toBe(boom);
  });
});
