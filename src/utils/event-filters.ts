import type { EventWithRelations } from '@/types/event.types';

/**
 * Time-window predicates for the quick-filter chips.
 *
 * "Tonight" = the event's `starts_at` is later today, i.e. between right
 * now (clamped to NOW, so a 1pm event isn't "tonight" at 4pm) and the end
 * of the local day. Events already past are excluded.
 *
 * "This weekend" = the event starts between the upcoming Friday 18:00 and
 * the upcoming Sunday 23:59:59, both inclusive, all in local time. If
 * today IS Saturday or Sunday, the window collapses to NOW → end of
 * Sunday (we don't roll forward — "this weekend" should keep meaning
 * THIS one). On Fri before 18:00, the window starts at Fri 18:00, not now.
 */

export function isTonight(startsAtIso: string | null, now: Date = new Date()): boolean {
  if (!startsAtIso) return false;
  const start = new Date(startsAtIso);
  if (Number.isNaN(start.getTime())) return false;
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return start >= now && start <= endOfDay;
}

export function isThisWeekend(
  startsAtIso: string | null,
  now: Date = new Date(),
): boolean {
  if (!startsAtIso) return false;
  const start = new Date(startsAtIso);
  if (Number.isNaN(start.getTime())) return false;

  const { from, to } = currentWeekendWindow(now);
  return start >= from && start <= to;
}

/**
 * Returns the window we consider "this weekend" relative to `now`:
 *   - Mon–Thu → upcoming Fri 18:00 → upcoming Sun 23:59:59
 *   - Fri before 18:00 → today 18:00 → upcoming Sun 23:59:59
 *   - Fri after 18:00, Sat, Sun → now → upcoming Sun 23:59:59
 */
export function currentWeekendWindow(now: Date = new Date()): { from: Date; to: Date } {
  const day = now.getDay(); // 0 Sun, 1 Mon, ..., 6 Sat
  const friday = new Date(now);

  if (day === 0) {
    // Sunday — Friday already passed, anchor on "today" so the window is
    // now → end of today.
    friday.setHours(0, 0, 0, 0);
  } else if (day === 6) {
    // Saturday — Friday was yesterday.
    friday.setDate(now.getDate() - 1);
    friday.setHours(18, 0, 0, 0);
  } else if (day === 5) {
    // Friday — today
    friday.setHours(18, 0, 0, 0);
  } else {
    // Mon–Thu — upcoming Friday
    const daysUntilFriday = 5 - day;
    friday.setDate(now.getDate() + daysUntilFriday);
    friday.setHours(18, 0, 0, 0);
  }

  // From is the later of the friday anchor or now (so events already past
  // are excluded mid-weekend).
  const from = friday > now ? friday : now;

  // To is upcoming Sunday at 23:59:59.999 local
  const sunday = new Date(now);
  const daysUntilSunday = (7 - now.getDay()) % 7;
  sunday.setDate(now.getDate() + daysUntilSunday);
  sunday.setHours(23, 59, 59, 999);

  return { from, to: sunday };
}

/**
 * Apply the shared chip filters — tonight, thisWeekend, isFree — to a
 * list of events. The Feed/Map/Mural visibleEvents memos all delegate
 * here so the three views stay coherent when a chip toggles.
 */
export function applyChipFilters(
  events: EventWithRelations[],
  filters: { tonight?: boolean; thisWeekend?: boolean; isFree?: boolean },
  now: Date = new Date(),
): EventWithRelations[] {
  if (!filters.tonight && !filters.thisWeekend && !filters.isFree) return events;
  return events.filter((e) => {
    if (filters.tonight && !isTonight(e.starts_at ?? null, now)) return false;
    if (filters.thisWeekend && !isThisWeekend(e.starts_at ?? null, now)) return false;
    if (filters.isFree && !e.is_free) return false;
    return true;
  });
}
