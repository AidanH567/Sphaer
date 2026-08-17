import {
  isTicketed,
  ticketBadgeTarget,
  hasFinished,
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
    ends_at: null,
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

describe('ticketBadgeTarget', () => {
  it('routes a registered, ticketed activity to the local QR', () => {
    const event = makeEvent('e1', soon(2), { is_free: false });
    expect(ticketBadgeTarget(event, true)).toEqual({ kind: 'local', eventId: 'e1' });
  });

  it('routes an unregistered activity with only a ticket_url to that external page', () => {
    // There is no local registration row, so /ticket/e2 would render
    // "No ticket found" — sending the user there would be a lie.
    const event = makeEvent('e2', soon(2), { ticket_url: 'https://tickets.example/e2' });
    expect(ticketBadgeTarget(event, false)).toEqual({
      kind: 'external',
      url: 'https://tickets.example/e2',
    });
  });

  it('prefers the local QR over the external link when the user is registered', () => {
    const event = makeEvent('e3', soon(2), {
      is_free: false,
      ticket_url: 'https://tickets.example/e3',
    });
    expect(ticketBadgeTarget(event, true)).toEqual({ kind: 'local', eventId: 'e3' });
  });

  it('shows nothing for a paid activity the user neither registered for nor can buy here', () => {
    // Saved-but-not-registered, no link: the user holds nothing.
    const event = makeEvent('e4', soon(2), { is_free: false });
    expect(ticketBadgeTarget(event, false)).toBeNull();
  });

  it('shows nothing for a free activity', () => {
    expect(ticketBadgeTarget(makeEvent('e5', soon(2)), true)).toBeNull();
  });
});

describe('hasFinished', () => {
  it('uses ends_at when the creator set one', () => {
    // Started three hours ago, runs until midnight — you are AT this, not
    // done with it.
    const nightOut = makeEvent('n', ago(3), { ends_at: soon(4) });
    expect(hasFinished(nightOut)).toBe(false);
  });

  it('falls back to starts_at when there is no end time', () => {
    expect(hasFinished(makeEvent('n', ago(3)))).toBe(true);
  });

  it('treats a fully elapsed activity as finished', () => {
    expect(hasFinished(makeEvent('n', ago(30), { ends_at: ago(26) }))).toBe(true);
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
  // Deliberately lopsided toward the past, because Aidan's real account is:
  // 56 activities, 6 upcoming. Past being the fullest tab is the normal case.
  const going = [
    makeEvent('g1', soon(1), { is_free: false }), // upcoming, ticketed
    makeEvent('g2', soon(2)), // upcoming, free
    makeEvent('gp1', ago(24)), // finished
    makeEvent('gp2', ago(72)), // finished
  ];
  const saved = [
    makeEvent('g2', soon(2)), // also in going — the overlap
    makeEvent('s1', soon(4)), // upcoming save
    makeEvent('sp1', ago(48)), // a save whose date passed
  ];

  describe('own profile', () => {
    const tabs = buildActivityTabs({ going, saved, isOwnProfile: true });
    const byKey = (k: string) => tabs.find((t) => t.key === k)!;

    it('exposes All, Going, Saved and Past — and no Tickets tab', () => {
      expect(tabs.map((t) => t.key)).toEqual(['all', 'going', 'saved', 'past']);
    });

    it('makes All the first tab, so the default lands on the full list', () => {
      expect(tabs[0].key).toBe('all');
    });

    it('does not double-count the activity present in both going and saved', () => {
      // 4 going + 3 saved with 1 shared = 6 distinct, not 7.
      expect(byKey('all').count).toBe(6);
    });

    it('limits Going to what is still upcoming', () => {
      expect(byKey('going').events.map((e) => e.id)).toEqual(['g1', 'g2']);
    });

    it('limits Saved to what is still upcoming', () => {
      expect(byKey('saved').events.map((e) => e.id)).toEqual(['g2', 's1']);
    });

    it('sweeps everything finished into Past, saves included', () => {
      // A save whose date passed must live SOMEWHERE other than All —
      // otherwise it is reachable from one tab only.
      expect(byKey('past').events.map((e) => e.id).sort()).toEqual(['gp1', 'gp2', 'sp1']);
    });

    it('partitions All exactly — every activity is upcoming or finished, never neither', () => {
      const visible = new Set([
        ...byKey('going').events.map((e) => e.id),
        ...byKey('saved').events.map((e) => e.id),
        ...byKey('past').events.map((e) => e.id),
      ]);
      const all = byKey('all').events.map((e) => e.id);
      expect(all.every((id) => visible.has(id))).toBe(true);
      expect(visible.size).toBe(byKey('all').count);
    });

    it('never lets a subset tab exceed All', () => {
      for (const tab of tabs.slice(1)) {
        expect(tab.count).toBeLessThanOrEqual(byKey('all').count);
      }
    });
  });

  describe("someone else's profile", () => {
    const hosting = [makeEvent('h1', ago(96))];
    const tabs = buildActivityTabs({
      going,
      saved: [],
      hosting,
      isOwnProfile: false,
      displayName: 'Lara',
    });

    it('shows All, Going and Past — never Saved', () => {
      expect(tabs.map((t) => t.key)).toEqual(['all', 'going', 'past']);
      expect(tabs.map((t) => t.key)).not.toContain('saved');
    });

    it('folds what they hosted into the set even if a registration row is missing', () => {
      expect(tabs.find((t) => t.key === 'past')!.events.map((e) => e.id)).toContain('h1');
    });

    it('cannot leak a saved list even if one is handed in by mistake', () => {
      const leaky = buildActivityTabs({
        going: [],
        saved: [makeEvent('secret', soon(1))],
        isOwnProfile: false,
      });
      // buildActivityTabs is not the privacy boundary (the hook and RLS are),
      // but it must not become a second way for a saved row to surface.
      expect(leaky.every((t) => t.events.every((e) => e.id !== 'secret'))).toBe(true);
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

    it('still renders every category, so the structure is visible from day one', () => {
      expect(tabs.map((t) => t.key)).toEqual(['all', 'going', 'saved', 'past']);
    });

    it('reports honest zero counts rather than hiding', () => {
      expect(tabs.every((t) => t.count === 0)).toBe(true);
    });

    it('gives every category its own considered empty copy', () => {
      for (const tab of tabs) {
        expect(tab.emptyBody.length).toBeGreaterThan(20);
      }
      // Generic "nothing here" four times would tell the user nothing about
      // what each category is for.
      expect(new Set(tabs.map((t) => t.emptyBody)).size).toBe(4);
    });

    it('spells out the upcoming/finished rule in the copy, so it is not a guess', () => {
      const byKey = (k: string) => tabs.find((t) => t.key === k)!;
      expect(byKey('going').emptyBody).toMatch(/Past/);
      expect(byKey('past').emptyBody).toMatch(/over|finished/i);
    });
  });

  describe('an account like Aidan\'s — almost everything already happened', () => {
    const many = [
      ...Array.from({ length: 50 }, (_, i) => makeEvent(`p${i}`, ago(24 * (i + 1)))),
      ...Array.from({ length: 6 }, (_, i) => makeEvent(`u${i}`, soon(i + 1))),
    ];
    const tabs = buildActivityTabs({ going: many, saved: [], isOwnProfile: true });
    const byKey = (k: string) => tabs.find((t) => t.key === k)!;

    it('puts the bulk in Past and leaves Going small without either looking broken', () => {
      expect(byKey('all').count).toBe(56);
      expect(byKey('past').count).toBe(50);
      expect(byKey('going').count).toBe(6);
    });
  });
});
