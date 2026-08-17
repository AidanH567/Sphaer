import {
  isTicketed,
  dedupeActivities,
  sortActivities,
  buildActivityTabs,
} from '@/utils/profile-activities';
import type { EventWithRelations } from '@/types/event.types';

const HOUR = 60 * 60 * 1000;

function makeEvent(
  id: string,
  startsAt: string,
  over: Partial<EventWithRelations> = {},
): EventWithRelations {
  return {
    id,
    title: `Event ${id}`,
    starts_at: startsAt,
    is_free: true,
    price: null,
    ticket_url: null,
    creator: null,
    circle: null,
    ...over,
  } as EventWithRelations;
}

const soon = (h: number) => new Date(Date.now() + h * HOUR).toISOString();
const ago = (h: number) => new Date(Date.now() - h * HOUR).toISOString();

describe('isTicketed', () => {
  it('treats an explicitly non-free activity as ticketed', () => {
    expect(isTicketed(makeEvent('a', soon(1), { is_free: false }))).toBe(true);
  });

  it('treats a positive price as ticketed even when is_free is unset', () => {
    expect(isTicketed(makeEvent('a', soon(1), { is_free: null, price: 12 }))).toBe(true);
  });

  it('treats an external ticket_url as ticketed', () => {
    expect(
      isTicketed(makeEvent('a', soon(1), { ticket_url: 'https://tickets.example/x' })),
    ).toBe(true);
  });

  it('does not treat a free activity as ticketed', () => {
    expect(isTicketed(makeEvent('a', soon(1), { is_free: true }))).toBe(false);
  });

  it('does not treat a zero price as ticketed', () => {
    expect(isTicketed(makeEvent('a', soon(1), { is_free: null, price: 0 }))).toBe(false);
  });

  it('does not infer a ticket from an unset is_free alone', () => {
    // An unset flag is not evidence of a price.
    expect(isTicketed(makeEvent('a', soon(1), { is_free: null }))).toBe(false);
  });
});

describe('dedupeActivities', () => {
  it('keeps one row per id across lists', () => {
    const shared = makeEvent('shared', soon(1));
    const onlyA = makeEvent('a', soon(2));
    const onlyB = makeEvent('b', soon(3));

    const merged = dedupeActivities([shared, onlyA], [shared, onlyB]);

    expect(merged.map((e) => e.id).sort()).toEqual(['a', 'b', 'shared']);
  });

  it('returns an empty list when given nothing', () => {
    expect(dedupeActivities([], [])).toEqual([]);
  });
});

describe('sortActivities', () => {
  it('orders upcoming soonest-first, then past most-recent-first', () => {
    const list = [
      makeEvent('later', soon(5)),
      makeEvent('last-week', ago(7 * 24)),
      makeEvent('yesterday', ago(24)),
      makeEvent('soon', soon(1)),
    ];

    expect(sortActivities(list).map((e) => e.id)).toEqual([
      'soon',
      'later',
      'yesterday',
      'last-week',
    ]);
  });
});

describe('buildActivityTabs', () => {
  const going = [
    makeEvent('g1', soon(1), { is_free: false }), // ticketed
    makeEvent('g2', soon(2)), // free
    makeEvent('g3', soon(3), { price: 15 }), // ticketed
  ];
  const saved = [
    makeEvent('g2', soon(2)), // also in going — the overlap
    makeEvent('s1', soon(4)),
  ];

  describe('own profile', () => {
    const tabs = buildActivityTabs({ going, saved, isOwnProfile: true });
    const byKey = (k: string) => tabs.find((t) => t.key === k)!;

    it('exposes all four tabs', () => {
      expect(tabs.map((t) => t.key)).toEqual(['all', 'going', 'saved', 'tickets']);
    });

    it('does not double-count the activity present in both going and saved', () => {
      // 3 going + 2 saved with 1 shared = 4 distinct, not 5.
      expect(byKey('all').count).toBe(4);
    });

    it('counts Going as every registration', () => {
      expect(byKey('going').count).toBe(3);
    });

    it('counts Tickets as only the ticketed subset of Going', () => {
      expect(byKey('tickets').count).toBe(2);
      expect(byKey('tickets').events.map((e) => e.id).sort()).toEqual(['g1', 'g3']);
    });

    it('keeps Tickets a strict subset of Going', () => {
      const goingIds = new Set(byKey('going').events.map((e) => e.id));
      expect(byKey('tickets').events.every((e) => goingIds.has(e.id))).toBe(true);
    });

    it('never lets a subset tab exceed its parent', () => {
      expect(byKey('tickets').count).toBeLessThanOrEqual(byKey('going').count);
      expect(byKey('going').count).toBeLessThanOrEqual(byKey('all').count);
    });

    it('does not draw Saved from the Going list', () => {
      expect(byKey('saved').events.map((e) => e.id).sort()).toEqual(['g2', 's1']);
    });
  });

  describe('someone else\'s profile', () => {
    const hosting = [going[0]];
    const tabs = buildActivityTabs({
      going,
      saved: [],
      hosting,
      isOwnProfile: false,
      displayName: 'Lara',
    });

    it('hides the private tabs — their saved list is unknowable under RLS', () => {
      expect(tabs.map((t) => t.key)).toEqual(['all', 'hosting']);
    });

    it('does NOT ship All and Going side by side', () => {
      // Without their saved list, All and Going are the same query. Two tabs
      // over one list is the exact redundancy this change removed — it must
      // not reappear on the public profile.
      expect(tabs.map((t) => t.key)).not.toContain('going');
    });

    it('offers Hosting as a genuinely different second tab', () => {
      const all = tabs.find((t) => t.key === 'all')!;
      const host = tabs.find((t) => t.key === 'hosting')!;
      expect(host.count).toBe(1);
      expect(host.count).toBeLessThan(all.count);
    });

    it('names the person in the empty copy rather than addressing the viewer', () => {
      const empty = buildActivityTabs({
        going: [],
        saved: [],
        isOwnProfile: false,
        displayName: 'Lara',
      });
      expect(empty[0].emptyBody).toContain('Lara');
      expect(empty[0].emptyBody).not.toContain('You');
    });

    it('falls back to a neutral noun when there is no display name', () => {
      const empty = buildActivityTabs({ going: [], saved: [], isOwnProfile: false });
      expect(empty[0].emptyBody).toContain('This artist');
    });
  });

  describe('a brand-new user with nothing', () => {
    const tabs = buildActivityTabs({ going: [], saved: [], isOwnProfile: true });

    it('still renders every tab, so the structure is visible from day one', () => {
      expect(tabs.map((t) => t.key)).toEqual(['all', 'going', 'saved', 'tickets']);
    });

    it('reports honest zero counts rather than hiding', () => {
      expect(tabs.every((t) => t.count === 0)).toBe(true);
    });

    it('gives every tab its own considered empty copy', () => {
      for (const tab of tabs) {
        expect(tab.emptyBody.length).toBeGreaterThan(20);
      }
      // The copy must differ per tab — a generic "nothing here" four times
      // would tell the user nothing about what each tab is for.
      expect(new Set(tabs.map((t) => t.emptyBody)).size).toBe(4);
    });
  });
});
