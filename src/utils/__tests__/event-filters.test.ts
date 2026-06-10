import {
  applyChipFilters,
  currentWeekendWindow,
  isThisWeekend,
  isTonight,
} from '../event-filters';
import type { EventWithRelations } from '@/types/event.types';

// All assertions pin `now` explicitly — these predicates take an optional
// `now` param precisely so tests never depend on the wall clock.

// Wed 10 Jun 2026, 15:00 local
const WEDNESDAY = new Date(2026, 5, 10, 15, 0, 0);
// Fri 12 Jun 2026, 12:00 local (before the 18:00 weekend anchor)
const FRIDAY_NOON = new Date(2026, 5, 12, 12, 0, 0);
// Sat 13 Jun 2026, 14:00 local
const SATURDAY = new Date(2026, 5, 13, 14, 0, 0);
// Sun 14 Jun 2026, 20:00 local
const SUNDAY_EVENING = new Date(2026, 5, 14, 20, 0, 0);

function iso(y: number, m: number, d: number, h: number, min = 0): string {
  return new Date(y, m, d, h, min).toISOString();
}

describe('isTonight', () => {
  it('matches an event later the same day', () => {
    expect(isTonight(iso(2026, 5, 10, 21), WEDNESDAY)).toBe(true);
  });
  it('rejects an event earlier the same day (already started)', () => {
    expect(isTonight(iso(2026, 5, 10, 12), WEDNESDAY)).toBe(false);
  });
  it('rejects tomorrow', () => {
    expect(isTonight(iso(2026, 5, 11, 21), WEDNESDAY)).toBe(false);
  });
  it('rejects null and garbage input', () => {
    expect(isTonight(null, WEDNESDAY)).toBe(false);
    expect(isTonight('not-a-date', WEDNESDAY)).toBe(false);
  });
});

describe('currentWeekendWindow', () => {
  it('Mon–Thu anchors on upcoming Friday 18:00', () => {
    const { from, to } = currentWeekendWindow(WEDNESDAY);
    expect(from.getDay()).toBe(5); // Friday
    expect(from.getHours()).toBe(18);
    expect(to.getDay()).toBe(0); // Sunday
    expect(to.getHours()).toBe(23);
  });
  it('Friday before 18:00 anchors on today 18:00', () => {
    const { from } = currentWeekendWindow(FRIDAY_NOON);
    expect(from.getDate()).toBe(12);
    expect(from.getHours()).toBe(18);
  });
  it('mid-weekend the window starts NOW (no rolling forward)', () => {
    const { from, to } = currentWeekendWindow(SATURDAY);
    expect(from.getTime()).toBe(SATURDAY.getTime());
    expect(to.getDay()).toBe(0);
  });
});

describe('isThisWeekend', () => {
  it('matches Saturday night seen from Wednesday', () => {
    expect(isThisWeekend(iso(2026, 5, 13, 22), WEDNESDAY)).toBe(true);
  });
  it('rejects Friday afternoon (before the 18:00 anchor)', () => {
    expect(isThisWeekend(iso(2026, 5, 12, 15), WEDNESDAY)).toBe(false);
  });
  it('rejects next weekend', () => {
    expect(isThisWeekend(iso(2026, 5, 20, 22), WEDNESDAY)).toBe(false);
  });
  it('mid-weekend: excludes events that already started', () => {
    expect(isThisWeekend(iso(2026, 5, 13, 10), SATURDAY)).toBe(false);
    expect(isThisWeekend(iso(2026, 5, 13, 20), SATURDAY)).toBe(true);
  });
  it('Sunday evening still matches later-tonight events', () => {
    expect(isThisWeekend(iso(2026, 5, 14, 22), SUNDAY_EVENING)).toBe(true);
  });
});

describe('applyChipFilters', () => {
  const ev = (over: Partial<EventWithRelations>): EventWithRelations =>
    ({ id: 'e', title: 't', is_free: false, starts_at: null, ...over } as EventWithRelations);

  const tonightEv = ev({ id: 'tonight', starts_at: iso(2026, 5, 10, 21) });
  const weekendEv = ev({ id: 'weekend', starts_at: iso(2026, 5, 13, 22) });
  const freeEv = ev({ id: 'free', is_free: true, starts_at: iso(2026, 5, 20, 21) });
  const all = [tonightEv, weekendEv, freeEv];

  it('no flags → passthrough (same reference)', () => {
    expect(applyChipFilters(all, {}, WEDNESDAY)).toBe(all);
  });
  it('tonight narrows to today-later events', () => {
    expect(applyChipFilters(all, { tonight: true }, WEDNESDAY).map((e) => e.id)).toEqual([
      'tonight',
    ]);
  });
  it('thisWeekend narrows to the weekend window', () => {
    expect(
      applyChipFilters(all, { thisWeekend: true }, WEDNESDAY).map((e) => e.id),
    ).toEqual(['weekend']);
  });
  it('isFree narrows to free events', () => {
    expect(applyChipFilters(all, { isFree: true }, WEDNESDAY).map((e) => e.id)).toEqual([
      'free',
    ]);
  });
  it('isFree stacks with thisWeekend (AND semantics)', () => {
    expect(
      applyChipFilters(all, { thisWeekend: true, isFree: true }, WEDNESDAY),
    ).toEqual([]);
  });
});
