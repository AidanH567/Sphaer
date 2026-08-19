import {
  getVenues,
  getSavedVenueIds,
  getSavedVenues,
  saveVenue,
  unsaveVenue,
  createVenue,
  withSavedState,
  VenuesUnavailableError,
} from '../venues.service';

/**
 * venues.service, and specifically the thing that matters right now: the
 * venues migration is NOT APPLIED, so every call in production today hits
 * a table that does not exist. Reads must come back empty and writes must
 * throw something the UI can name — anything else takes the map down.
 *
 * The builder records every call and is thenable, same shape as
 * events-get-events.test.ts.
 */

type Call = { method: string; args: unknown[] };
type Result = { data: unknown; error: unknown };

const mockCalls: Call[] = [];
/** Default result for any table without a specific one set. */
const mockResult: Result = { data: [], error: null };
/** Per-table overrides — getSavedVenues issues two queries against two
 *  different tables and needs to give a different answer to each. */
const mockByTable: Record<string, Result> = {};

jest.mock('@/lib/supabase', () => {
  const methods = ['select', 'order', 'eq', 'in', 'insert', 'delete', 'single'] as const;

  function makeBuilder(table: string) {
    const builder: Record<string, unknown> = {};
    for (const method of methods) {
      builder[method] = (...args: unknown[]) => {
        mockCalls.push({ method, args });
        return builder;
      };
    }
    builder.then = (resolve: (v: unknown) => unknown) => {
      const result = mockByTable[table] ?? mockResult;
      return Promise.resolve({ data: result.data, error: result.error }).then(resolve);
    };
    return builder;
  }

  return {
    supabase: {
      from: (table: string) => {
        mockCalls.push({ method: 'from', args: [table] });
        return makeBuilder(table);
      },
    },
  };
});

beforeEach(() => {
  mockCalls.length = 0;
  mockResult.data = [];
  mockResult.error = null;
  for (const key of Object.keys(mockByTable)) delete mockByTable[key];
});

/** What PostgREST returns when the relation is missing from its cache. */
const MISSING_TABLE = { code: 'PGRST205', message: "Could not find the table 'public.venues' in the schema cache" };
const MISSING_RELATION = { code: '42P01', message: 'relation "public.saved_venues" does not exist' };

describe('reads degrade to empty while the migration is unapplied', () => {
  it('getVenues returns [] on a missing table instead of throwing', async () => {
    mockResult.error = MISSING_TABLE;
    await expect(getVenues()).resolves.toEqual([]);
    expect(mockCalls[0]).toEqual({ method: 'from', args: ['venues'] });
  });

  it('getSavedVenueIds returns [] on a missing relation', async () => {
    mockResult.error = MISSING_RELATION;
    await expect(getSavedVenueIds('user-1')).resolves.toEqual([]);
  });

  it('getSavedVenues returns [] on a missing relation', async () => {
    mockResult.error = MISSING_RELATION;
    await expect(getSavedVenues('user-1')).resolves.toEqual([]);
  });

  it('a REAL error still throws — degradation must not swallow genuine failures', async () => {
    mockResult.error = { code: '42501', message: 'permission denied for table venues' };
    await expect(getVenues()).rejects.toMatchObject({ code: '42501' });
  });
});

describe('reads on a live schema', () => {
  it('getVenues asks for every venue, name-ordered', async () => {
    mockResult.data = [{ id: 'v-1', name: 'Tresor', slug: 'tresor' }];
    const venues = await getVenues();

    expect(venues).toHaveLength(1);
    expect(venues[0].name).toBe('Tresor');
    expect(mockCalls).toContainEqual({ method: 'from', args: ['venues'] });
    expect(mockCalls).toContainEqual({
      method: 'order',
      args: ['name', { ascending: true }],
    });
  });

  it('getSavedVenueIds flattens to plain ids, scoped to the user', async () => {
    mockResult.data = [{ venue_id: 'v-1' }, { venue_id: 'v-2' }];
    await expect(getSavedVenueIds('user-7')).resolves.toEqual(['v-1', 'v-2']);
    expect(mockCalls).toContainEqual({ method: 'from', args: ['saved_venues'] });
    expect(mockCalls).toContainEqual({ method: 'eq', args: ['user_id', 'user-7'] });
  });

  it('getSavedVenues restores newest-saved-first order, which `in` does not preserve', async () => {
    mockByTable['saved_venues'] = {
      data: [{ venue_id: 'v-3' }, { venue_id: 'v-1' }, { venue_id: 'v-2' }],
      error: null,
    };
    // PostgREST returns `in` results in planner order, deliberately not the
    // order asked for.
    mockByTable['venues'] = {
      data: [
        { id: 'v-1', name: 'Tresor' },
        { id: 'v-2', name: 'Il Kino' },
        { id: 'v-3', name: 'SO36' },
      ],
      error: null,
    };

    const venues = await getSavedVenues('user-7');
    expect(venues.map((v) => v.id)).toEqual(['v-3', 'v-1', 'v-2']);
    expect(mockCalls).toContainEqual({ method: 'in', args: ['id', ['v-3', 'v-1', 'v-2']] });
  });

  it('getSavedVenues drops an id whose venue row has vanished', async () => {
    mockByTable['saved_venues'] = { data: [{ venue_id: 'v-1' }, { venue_id: 'gone' }], error: null };
    mockByTable['venues'] = { data: [{ id: 'v-1', name: 'Tresor' }], error: null };

    const venues = await getSavedVenues('user-7');
    expect(venues.map((v) => v.id)).toEqual(['v-1']);
  });

  it('getSavedVenues short-circuits without a second query when nothing is saved', async () => {
    mockResult.data = [];
    await expect(getSavedVenues('user-7')).resolves.toEqual([]);
    // Only saved_venues was touched — no pointless `in ()` against venues.
    expect(mockCalls.filter((c) => c.method === 'from')).toEqual([
      { method: 'from', args: ['saved_venues'] },
    ]);
  });
});

describe('saving a venue', () => {
  it('inserts the (user, venue) pair — the saved_events shape', async () => {
    await saveVenue('user-7', 'v-1');
    expect(mockCalls).toContainEqual({ method: 'from', args: ['saved_venues'] });
    expect(mockCalls).toContainEqual({
      method: 'insert',
      args: [{ user_id: 'user-7', venue_id: 'v-1' }],
    });
  });

  it('deletes by both keys on unsave, never by user alone', async () => {
    await unsaveVenue('user-7', 'v-1');
    expect(mockCalls).toContainEqual({ method: 'delete', args: [] });
    expect(mockCalls).toContainEqual({ method: 'eq', args: ['user_id', 'user-7'] });
    expect(mockCalls).toContainEqual({ method: 'eq', args: ['venue_id', 'v-1'] });
  });

  it('throws VenuesUnavailableError, not a raw PostgREST error, when unapplied', async () => {
    mockResult.error = MISSING_RELATION;
    await expect(saveVenue('user-7', 'v-1')).rejects.toBeInstanceOf(VenuesUnavailableError);
    await expect(unsaveVenue('user-7', 'v-1')).rejects.toBeInstanceOf(VenuesUnavailableError);
  });
});

describe('createVenue', () => {
  it('stamps created_by and lets the DB trigger decide the slug', async () => {
    mockResult.data = { id: 'v-new', name: 'Säälchen', slug: 'saeaelchen' };
    await createVenue('user-7', { name: 'Säälchen', lat: 52.5052, lng: 13.4282 });

    const insert = mockCalls.find((c) => c.method === 'insert');
    expect(insert?.args[0]).toMatchObject({ name: 'Säälchen', created_by: 'user-7' });
    // Identity is the database's job — a client that sent its own slug could
    // disagree with another app version about what the same place is called.
    expect(insert?.args[0]).not.toHaveProperty('slug');
  });

  it('rejects a name that carries no identity, before touching the network', async () => {
    await expect(createVenue('user-7', { name: '!!!' })).rejects.toThrow(/too short/i);
    expect(mockCalls).toHaveLength(0);
  });
});

describe('withSavedState', () => {
  it('marks exactly the hearted venues', () => {
    const venues = [
      { id: 'v-1', name: 'Tresor' },
      { id: 'v-2', name: 'Il Kino' },
    ] as unknown as Parameters<typeof withSavedState>[0];
    const out = withSavedState(venues, new Set(['v-2']));
    expect(out.map((v) => v.is_saved)).toEqual([false, true]);
  });
});
