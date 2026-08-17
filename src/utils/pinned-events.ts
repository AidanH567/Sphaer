/**
 * Date logic behind the pinned-events section + mini-calendar strip that sit
 * above a circle group chat (Lara meeting notes 2026-08-17, point 5).
 *
 * Deliberately pure and dependency-free so the ordering, the "still relevant"
 * rule, and the day bucketing are unit-testable without a renderer or a
 * network. Everything here works in LOCAL time — the strip shows the user's
 * days, not UTC days, and day arithmetic goes through the Date(y, m, d)
 * constructor rather than adding 86_400_000ms so DST transitions don't shift
 * a cell by an hour and land it on the wrong date.
 */

/** How many days forward the mini-calendar strip covers. Two weeks reads as
 *  "what's coming up" without becoming a calendar page. */
export const PINNED_WINDOW_DAYS = 14;

/** Minimal shape the date logic needs — real events satisfy it structurally. */
export interface UpcomingEventLike {
  id: string;
  starts_at: string;
  ends_at?: string | null;
}

/** Local `YYYY-MM-DD` key for a date. Not `toISOString()` — that is UTC and
 *  would bucket a 01:00 Berlin event onto the previous day. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Midnight at the start of `date`'s local day. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** `date` shifted by whole local days (DST-safe). */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * The moment an event stops being relevant to the pinned section.
 * `ends_at` when the organiser set one, otherwise the start time — an event
 * with no stated end is treated as over once it has started, which is the
 * honest reading rather than inventing a default duration.
 */
export function relevantUntil(event: UpcomingEventLike): number {
  return new Date(event.ends_at ?? event.starts_at).getTime();
}

/**
 * Upcoming (and currently-running) events, soonest first.
 *
 * An event survives the filter while `relevantUntil` is still in the future,
 * so a party that started an hour ago and runs until 04:00 stays pinned —
 * that is precisely when people open the chat looking for it.
 *
 * Ties on `starts_at` break on `id` so the order is stable across refetches
 * (two events at the same minute must not swap places on every render).
 * Rows with an unparseable `starts_at` are dropped rather than sorted to a
 * random position.
 */
export function selectUpcoming<T extends UpcomingEventLike>(events: T[], now: Date): T[] {
  const nowMs = now.getTime();
  return events
    .filter((e) => {
      const startMs = new Date(e.starts_at).getTime();
      if (Number.isNaN(startMs)) return false;
      const untilMs = relevantUntil(e);
      return !Number.isNaN(untilMs) && untilMs >= nowMs;
    })
    .sort((a, b) => {
      const diff = new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });
}

/** One cell of the mini-calendar strip. */
export interface CalendarDay {
  /** Local `YYYY-MM-DD` — the identity used for selection + filtering. */
  key: string;
  /** Midnight of this day, local. */
  date: Date;
  /** 1–31, rendered large in the cell. */
  dayOfMonth: number;
  /** Short weekday initial-ish label, e.g. "Fri". */
  weekdayLabel: string;
  /** How many events start on this day. */
  eventCount: number;
  isToday: boolean;
}

/**
 * The strip: `days` consecutive local days starting today, each annotated
 * with how many of `events` start on it.
 *
 * Counting is by START day only. A multi-day festival marks the day it opens
 * rather than smearing a dot across a fortnight — the strip answers "what
 * kicks off when", and the list underneath carries the full detail.
 */
export function buildCalendarDays(
  events: UpcomingEventLike[],
  now: Date,
  days: number = PINNED_WINDOW_DAYS
): CalendarDay[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const start = new Date(event.starts_at);
    if (Number.isNaN(start.getTime())) continue;
    const key = dayKey(start);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const todayKey = dayKey(now);
  const first = startOfDay(now);

  return Array.from({ length: Math.max(0, days) }, (_, i) => {
    const date = addDays(first, i);
    const key = dayKey(date);
    return {
      key,
      date,
      dayOfMonth: date.getDate(),
      weekdayLabel: date.toLocaleDateString('en-GB', { weekday: 'short' }),
      eventCount: counts.get(key) ?? 0,
      isToday: key === todayKey,
    };
  });
}

/** Events that START on the given local day key. `null` means "no filter". */
export function filterEventsByDay<T extends UpcomingEventLike>(
  events: T[],
  key: string | null
): T[] {
  if (!key) return events;
  return events.filter((e) => {
    const start = new Date(e.starts_at);
    return !Number.isNaN(start.getTime()) && dayKey(start) === key;
  });
}

/**
 * Human label for the collapsed summary row: "Today", "Tomorrow", or a short
 * date. Keeps the one-line pinned bar readable at a glance without a second
 * date format appearing elsewhere in the section.
 */
export function relativeDayLabel(dateStr: string, now: Date): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const key = dayKey(date);
  if (key === dayKey(now)) return 'Today';
  if (key === dayKey(addDays(now, 1))) return 'Tomorrow';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
