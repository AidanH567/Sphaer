import { useCallback, useEffect, useMemo, useState } from 'react';
import * as eventsService from '@/services/events.service';
import type { EventWithRelations } from '@/types/event.types';
import {
  buildCalendarDays,
  filterEventsByDay,
  selectUpcoming,
  type CalendarDay,
} from '@/utils/pinned-events';

export interface UseCirclePinnedEventsResult {
  /** Every still-relevant event for this circle, soonest first. */
  events: EventWithRelations[];
  /** `events`, narrowed to `selectedDay` when the user taps a day cell. */
  visibleEvents: EventWithRelations[];
  /** Mini-calendar cells — the next two weeks, annotated with event counts. */
  days: CalendarDay[];
  /** Local `YYYY-MM-DD` of the tapped day, or null for "show everything". */
  selectedDay: string | null;
  /** Tap a day: selects it, or clears the filter when it was already selected. */
  toggleDay: (key: string) => void;
  clearDay: () => void;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Backing data for the pinned-events section above a circle group chat.
 *
 * `now` is pinned into state at fetch time rather than read on every render:
 * the derived memos below depend on it, and a fresh `new Date()` each render
 * would invalidate them constantly and make the strip re-render on every
 * incoming chat message. It is refreshed on refetch, which is when a moved
 * "now" can actually change what is upcoming.
 */
export function useCirclePinnedEvents(circleId: string | undefined): UseCirclePinnedEventsResult {
  const [rows, setRows] = useState<EventWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [refetchTick, setRefetchTick] = useState(0);

  const refetch = useCallback(() => setRefetchTick((n) => n + 1), []);

  useEffect(() => {
    if (!circleId) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    const at = new Date();
    setIsLoading(true);
    setError(null);

    eventsService
      .getCircleUpcomingEvents(circleId, { from: at })
      .then((data) => {
        if (cancelled) return;
        setNow(at);
        setRows(data);
      })
      .catch((err) => {
        if (cancelled) return;
        // Dev log only — `error` below is the user-visible signal, and the
        // section degrades to its quiet empty state rather than blocking chat.
        if (__DEV__) console.error('[useCirclePinnedEvents] fetch failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to load events.');
        setRows([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [circleId, refetchTick]);

  // A day that no longer exists in the window (or has no events after a
  // refetch) must not leave the list showing an empty filtered view forever.
  const events = useMemo(() => selectUpcoming(rows, now), [rows, now]);
  const days = useMemo(() => buildCalendarDays(events, now), [events, now]);
  const visibleEvents = useMemo(
    () => filterEventsByDay(events, selectedDay),
    [events, selectedDay]
  );

  useEffect(() => {
    if (selectedDay && !days.some((d) => d.key === selectedDay && d.eventCount > 0)) {
      setSelectedDay(null);
    }
  }, [days, selectedDay]);

  const toggleDay = useCallback((key: string) => {
    setSelectedDay((current) => (current === key ? null : key));
  }, []);
  const clearDay = useCallback(() => setSelectedDay(null), []);

  return {
    events,
    visibleEvents,
    days,
    selectedDay,
    toggleDay,
    clearDay,
    isLoading,
    error,
    refetch,
  };
}
