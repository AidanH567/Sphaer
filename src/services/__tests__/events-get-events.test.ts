import { getEvents } from '../events.service';

/**
 * getEvents' PostgREST chain, specifically the `origin` (provenance) filter.
 *
 * Lives in its own file rather than events.service.test.ts because that file's
 * mock is a hand-rolled stub of the ONE chain getCircleUpcomingEvents uses
 * (select→eq→gte→order→limit) and getEvents' chain is longer and
 * order-dependent. A jest.mock factory is per-module, so a second shape needs
 * a second file.
 *
 * The builder below records every filter call and is itself thenable, which
 * is what `await query` at the end of getEvents needs.
 */

type Call = { method: string; args: unknown[] };
const mockCalls: Call[] = [];
const mockRows: { current: unknown[] } = { current: [] };

jest.mock('@/lib/supabase', () => {
  const methods = [
    'select',
    'order',
    'or',
    'overlaps',
    'eq',
    'gte',
    'is',
    'not',
    'like',
  ] as const;

  function makeBuilder() {
    const builder: Record<string, unknown> = {};
    for (const method of methods) {
      builder[method] = (...args: unknown[]) => {
        mockCalls.push({ method, args });
        return builder;
      };
    }
    // getEvents ends in `await query` — PostgREST builders are thenable, so
    // the stub must be too, otherwise the await resolves to the builder
    // itself and destructuring { data, error } silently yields undefined.
    builder.then = (
      resolve: (v: { data: unknown[]; error: null }) => unknown,
    ) => Promise.resolve({ data: mockRows.current, error: null }).then(resolve);
    return builder;
  }

  return {
    supabase: {
      from: (table: string) => {
        mockCalls.push({ method: 'from', args: [table] });
        return makeBuilder();
      },
    },
  };
});

beforeEach(() => {
  mockCalls.length = 0;
  mockRows.current = [];
});

/** Every call to `name`, in order. */
function callsTo(name: string): unknown[][] {
  return mockCalls.filter((c) => c.method === name).map((c) => c.args);
}

describe('getEvents — origin (provenance) filter', () => {
  it('adds NO source filter by default, so "All" is byte-for-byte the old query', () => {
    // The regression that matters most: the default feed must not start
    // hiding half the events because a filter leaked into the base query.
    return getEvents().then(() => {
      expect(callsTo('is')).toEqual([]);
      expect(callsTo('not')).toEqual([]);
      expect(mockCalls[0]).toEqual({ method: 'from', args: ['events'] });
    });
  });

  it('adds no source filter when other filters are set but origin is absent', async () => {
    await getEvents({ categories: ['Music'], isFree: true });
    expect(callsTo('is')).toEqual([]);
    expect(callsTo('not')).toEqual([]);
    // ...and the pre-existing filters still go out.
    expect(callsTo('overlaps')).toEqual([['categories', ['Music']]]);
    expect(callsTo('eq')).toEqual([['is_free', true]]);
  });

  it("origin: 'community' asks for source IS NULL", async () => {
    await getEvents({ origin: 'community' });
    expect(callsTo('is')).toEqual([['source', null]]);
    expect(callsTo('not')).toEqual([]);
  });

  it("origin: 'aggregated' asks for source IS NOT NULL", async () => {
    await getEvents({ origin: 'aggregated' });
    // supabase-js has no .isNot(); `.not(col, 'is', null)` is the documented
    // spelling of `source=not.is.null`.
    expect(callsTo('not')).toEqual([['source', 'is', null]]);
    expect(callsTo('is')).toEqual([]);
  });

  it('filters on source IS NULL rather than a tina: prefix match', async () => {
    // Deliberate: the migration's rule is NULL vs NOT NULL. A `like
    // 'tina:%'` here would quietly mis-file any future importer that used a
    // different prefix as a human post.
    await getEvents({ origin: 'aggregated' });
    expect(callsTo('like')).toEqual([]);
  });

  it('layers on top of the existing filters instead of replacing them', async () => {
    await getEvents({ origin: 'community', categories: ['Music'], isFree: true });
    expect(callsTo('overlaps')).toEqual([['categories', ['Music']]]);
    expect(callsTo('eq')).toEqual([['is_free', true]]);
    expect(callsTo('is')).toEqual([['source', null]]);
  });

  it('still keeps the public-visibility clause with a provenance filter on', async () => {
    await getEvents({ origin: 'aggregated' });
    expect(callsTo('or')).toContainEqual(['visibility.is.null,visibility.eq.anyone']);
  });

  it('passes the provenance columns through to the caller', async () => {
    mockRows.current = [
      {
        id: 'evt-1',
        source: 'tina:jsonld',
        external_id: 'https://privatclub-berlin.de/e/1',
        source_url: 'https://privatclub-berlin.de/e/1',
        going: [{ count: 0 }],
      },
    ];
    const [event] = await getEvents({ origin: 'aggregated' });
    expect(event.source).toBe('tina:jsonld');
    expect(event.source_url).toBe('https://privatclub-berlin.de/e/1');
    expect(event.external_id).toBe('https://privatclub-berlin.de/e/1');
  });
});
