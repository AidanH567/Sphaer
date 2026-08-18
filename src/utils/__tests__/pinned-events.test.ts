import {
  PINNED_WINDOW_DAYS,
  addDays,
  buildCalendarDays,
  dayKey,
  filterEventsByDay,
  relativeDayLabel,
  relevantUntil,
  selectUpcoming,
  startOfDay,
  type UpcomingEventLike,
} from '../pinned-events';

/** Local-time event factory — the strip buckets in local time, so the tests
 *  must construct local dates rather than hand-writing UTC `Z` strings. */
function localIso(
  y: number,
  m: number,
  d: number,
  hh = 0,
  mm = 0
): string {
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

function makeEvent(
  id: string,
  starts_at: string,
  ends_at: string | null = null
): UpcomingEventLike {
  return { id, starts_at, ends_at };
}

describe('dayKey / startOfDay / addDays', () => {
  it('keys on the LOCAL calendar day, not the UTC day', () => {
    // 00:30 local. In any timezone east of UTC this is the previous day in
    // UTC — toISOString().slice(0,10) would bucket it wrong.
    const justAfterMidnight = new Date(2026, 7, 22, 0, 30);
    expect(dayKey(justAfterMidnight)).toBe('2026-08-22');
  });

  it('zero-pads month and day', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('startOfDay strips the time, keeping the same calendar day', () => {
    const mid = startOfDay(new Date(2026, 7, 22, 23, 59, 59));
    expect(mid.getHours()).toBe(0);
    expect(mid.getMinutes()).toBe(0);
    expect(dayKey(mid)).toBe('2026-08-22');
  });

  it('addDays rolls over month boundaries', () => {
    expect(dayKey(addDays(new Date(2026, 7, 30), 3))).toBe('2026-09-02');
  });

  it('addDays crosses a DST transition without losing or repeating a day', () => {
    // Europe/Berlin springs forward on 2026-03-29. Adding 24h in
    // milliseconds across that boundary lands on the 29th twice; the
    // constructor-based arithmetic must not.
    const keys = Array.from({ length: 4 }, (_, i) =>
      dayKey(addDays(new Date(2026, 2, 27), i))
    );
    expect(keys).toEqual(['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30']);
  });
});

describe('relevantUntil', () => {
  it('uses ends_at when the organiser set one', () => {
    const e = makeEvent('a', localIso(2026, 8, 22, 20), localIso(2026, 8, 23, 4));
    expect(relevantUntil(e)).toBe(new Date(localIso(2026, 8, 23, 4)).getTime());
  });

  it('falls back to starts_at when there is no end time', () => {
    const e = makeEvent('a', localIso(2026, 8, 22, 20));
    expect(relevantUntil(e)).toBe(new Date(localIso(2026, 8, 22, 20)).getTime());
  });
});

describe('selectUpcoming — ordering', () => {
  const now = new Date(2026, 7, 17, 12, 0);

  it('orders soonest-first regardless of input order', () => {
    const events = [
      makeEvent('c', localIso(2026, 8, 30, 21)),
      makeEvent('a', localIso(2026, 8, 18, 19)),
      makeEvent('b', localIso(2026, 8, 22, 20)),
    ];
    expect(selectUpcoming(events, now).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('breaks ties on id so the order is stable across refetches', () => {
    const sameMinute = localIso(2026, 8, 22, 20);
    const forward = [makeEvent('zeta', sameMinute), makeEvent('alpha', sameMinute)];
    const reversed = [...forward].reverse();

    expect(selectUpcoming(forward, now).map((e) => e.id)).toEqual(['alpha', 'zeta']);
    expect(selectUpcoming(reversed, now).map((e) => e.id)).toEqual(['alpha', 'zeta']);
  });

  it('drops events that already finished', () => {
    const events = [
      makeEvent('over', localIso(2026, 8, 16, 20), localIso(2026, 8, 16, 23)),
      makeEvent('next', localIso(2026, 8, 18, 20)),
    ];
    expect(selectUpcoming(events, now).map((e) => e.id)).toEqual(['next']);
  });

  it('keeps an event that started earlier today but is still running', () => {
    // Started at 10:00, runs to 18:00, "now" is 12:00 — this is exactly when
    // someone opens the chat looking for it, so it must stay pinned.
    const running = makeEvent('running', localIso(2026, 8, 17, 10), localIso(2026, 8, 17, 18));
    expect(selectUpcoming([running], now).map((e) => e.id)).toEqual(['running']);
  });

  it('drops an event with no end time once its start has passed', () => {
    const started = makeEvent('started', localIso(2026, 8, 17, 10));
    expect(selectUpcoming([started], now)).toEqual([]);
  });

  it('ignores rows with an unparseable start date instead of sorting them randomly', () => {
    const events = [makeEvent('bad', 'not-a-date'), makeEvent('good', localIso(2026, 8, 18, 20))];
    expect(selectUpcoming(events, now).map((e) => e.id)).toEqual(['good']);
  });

  it('returns an empty array for an empty input', () => {
    expect(selectUpcoming([], now)).toEqual([]);
  });
});

describe('buildCalendarDays', () => {
  const now = new Date(2026, 7, 17, 12, 0); // Mon 17 Aug 2026

  it('covers PINNED_WINDOW_DAYS consecutive days starting today', () => {
    const days = buildCalendarDays([], now);
    expect(days).toHaveLength(PINNED_WINDOW_DAYS);
    expect(days[0].key).toBe('2026-08-17');
    expect(days[0].isToday).toBe(true);
    expect(days[PINNED_WINDOW_DAYS - 1].key).toBe('2026-08-30');
    expect(days.filter((d) => d.isToday)).toHaveLength(1);
  });

  it('counts events onto their local start day', () => {
    const days = buildCalendarDays(
      [
        makeEvent('a', localIso(2026, 8, 18, 19)),
        makeEvent('b', localIso(2026, 8, 18, 23)),
        makeEvent('c', localIso(2026, 8, 22, 20)),
      ],
      now
    );
    const byKey = Object.fromEntries(days.map((d) => [d.key, d.eventCount]));
    expect(byKey['2026-08-18']).toBe(2);
    expect(byKey['2026-08-22']).toBe(1);
    expect(byKey['2026-08-19']).toBe(0);
  });

  it('counts a multi-day event once, on the day it starts', () => {
    const festival = makeEvent('fest', localIso(2026, 8, 21, 18), localIso(2026, 8, 24, 2));
    const days = buildCalendarDays([festival], now);
    const marked = days.filter((d) => d.eventCount > 0).map((d) => d.key);
    expect(marked).toEqual(['2026-08-21']);
  });

  it('carries the day number and a short weekday label for each cell', () => {
    const days = buildCalendarDays([], now);
    expect(days[0].dayOfMonth).toBe(17);
    expect(days[0].weekdayLabel).toBe('Mon');
    expect(days[1].weekdayLabel).toBe('Tue');
  });

  it('leaves every cell at zero when there are no events (the empty strip)', () => {
    const days = buildCalendarDays([], now);
    expect(days.every((d) => d.eventCount === 0)).toBe(true);
  });

  it('ignores events outside the window without breaking the cell count', () => {
    const faraway = makeEvent('far', localIso(2026, 12, 31, 20));
    const days = buildCalendarDays([faraway], now);
    expect(days).toHaveLength(PINNED_WINDOW_DAYS);
    expect(days.every((d) => d.eventCount === 0)).toBe(true);
  });

  it('returns no cells for a non-positive window rather than throwing', () => {
    expect(buildCalendarDays([], now, 0)).toEqual([]);
    expect(buildCalendarDays([], now, -3)).toEqual([]);
  });
});

describe('filterEventsByDay', () => {
  const events = [
    makeEvent('a', localIso(2026, 8, 18, 19)),
    makeEvent('b', localIso(2026, 8, 18, 23)),
    makeEvent('c', localIso(2026, 8, 22, 20)),
  ];

  it('returns only the events starting on that local day', () => {
    expect(filterEventsByDay(events, '2026-08-18').map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('returns everything when no day is selected', () => {
    expect(filterEventsByDay(events, null)).toHaveLength(3);
  });

  it('returns nothing for a day with no events', () => {
    expect(filterEventsByDay(events, '2026-08-19')).toEqual([]);
  });
});

describe('relativeDayLabel', () => {
  const now = new Date(2026, 7, 17, 12, 0);

  it('says Today for later the same day', () => {
    expect(relativeDayLabel(localIso(2026, 8, 17, 22), now)).toBe('Today');
  });

  it('says Tomorrow for the next calendar day', () => {
    expect(relativeDayLabel(localIso(2026, 8, 18, 1), now)).toBe('Tomorrow');
  });

  it('falls back to a short date further out', () => {
    expect(relativeDayLabel(localIso(2026, 8, 22, 20), now)).toBe('Sat 22 Aug');
  });

  it('returns an empty string for an unparseable date', () => {
    expect(relativeDayLabel('nope', now)).toBe('');
  });
});

/**
 * The label rule at hostile instants.
 *
 * This is where the Today/Tomorrow question is settled, deliberately and at
 * chosen moments, instead of in the component test — which for weeks built
 * its fixtures as millisecond offsets from the real `Date.now()` and so
 * asserted a different thing depending on what time the suite ran.
 * `PinnedEventsSection.test.tsx` was false between 19:00 and midnight for one
 * assertion and after 22:00 for another; both were mistaken for feature
 * regressions. `relativeDayLabel` already takes `now` as an argument, so the
 * rigorous version of those assertions costs nothing but writing them here.
 *
 * The rule under test: the label is a LOCAL CALENDAR DAY comparison, never a
 * duration. "Tomorrow" can be 31 minutes away and "Today" can be 22 hours
 * away.
 */
describe('relativeDayLabel — hour-independence', () => {
  it('says Today for the same calendar day at every hour of the clock', () => {
    const labels = Array.from({ length: 24 }, (_, hour) =>
      relativeDayLabel(localIso(2026, 8, 17, 20), new Date(2026, 7, 17, hour, 30))
    );
    expect(labels).toEqual(Array(24).fill('Today'));
  });

  it('says Tomorrow for the next calendar day at every hour of the clock', () => {
    const labels = Array.from({ length: 24 }, (_, hour) =>
      relativeDayLabel(localIso(2026, 8, 18, 2), new Date(2026, 7, 17, hour, 30))
    );
    expect(labels).toEqual(Array(24).fill('Tomorrow'));
  });

  it('labels by calendar day, not by how many hours away the event is', () => {
    // 23:30 plus two hours is 01:30 the NEXT day. This exact shape — a
    // fixture "two hours from now" asserted to read "Today" — is what broke
    // the component test every night after 22:00.
    expect(relativeDayLabel(localIso(2026, 8, 18, 1, 30), new Date(2026, 7, 17, 23, 30))).toBe(
      'Tomorrow'
    );
    // Thirty-one minutes away, and already Tomorrow.
    expect(relativeDayLabel(localIso(2026, 8, 18, 0, 30), new Date(2026, 7, 17, 23, 59))).toBe(
      'Tomorrow'
    );
    // Twenty-two hours away, and still Today.
    expect(relativeDayLabel(localIso(2026, 8, 18, 22, 0), new Date(2026, 7, 18, 0, 1))).toBe(
      'Today'
    );
  });

  it('never calls yesterday Today, however few minutes ago it ended', () => {
    expect(relativeDayLabel(localIso(2026, 8, 16, 23, 30), new Date(2026, 7, 17, 0, 30))).toBe(
      'Sun 16 Aug'
    );
  });

  it('never calls the day after tomorrow Tomorrow', () => {
    expect(relativeDayLabel(localIso(2026, 8, 19, 0, 30), new Date(2026, 7, 17, 23, 59))).toBe(
      'Wed 19 Aug'
    );
  });

  it('holds across both DST transitions, where the day is 23 or 25 hours long', () => {
    // Europe/Berlin springs forward on 2026-03-29 (a 23-hour day) and falls
    // back on 2026-10-25 (a 25-hour day). A rule that compared timestamps
    // against a 24-hour constant would misread one of these; a calendar-day
    // comparison reads both correctly, and does so in any timezone.
    expect(relativeDayLabel(localIso(2026, 3, 29, 12), new Date(2026, 2, 28, 23, 30))).toBe(
      'Tomorrow'
    );
    expect(relativeDayLabel(localIso(2026, 3, 29, 12), new Date(2026, 2, 29, 3, 30))).toBe('Today');
    expect(relativeDayLabel(localIso(2026, 10, 25, 12), new Date(2026, 9, 24, 23, 30))).toBe(
      'Tomorrow'
    );
    expect(relativeDayLabel(localIso(2026, 10, 25, 12), new Date(2026, 9, 25, 2, 30))).toBe('Today');
  });
});
