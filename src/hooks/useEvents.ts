import { useEffect, useState, useCallback, useMemo } from 'react';
import * as eventsService from '@/services/events.service';
import { useAppContext } from '@/context/AppContext';
import type { EventWithRelations, EventFilters } from '@/types/event.types';

export function useEvents(filters?: EventFilters) {
  const [events, setEvents] = useState<EventWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { blockedIds } = useAppContext();

  // Callers pass fresh `filters` object literals on every render — keying
  // the callback on the serialized value keeps fetchEvents stable unless
  // the actual filter values change (object identity would refetch on
  // every render).
  const filtersKey = JSON.stringify(filters);
  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await eventsService.getEvents(filters);
      setEvents(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load events');
    } finally {
      setIsLoading(false);
    }
    // `filters` is covered by filtersKey above — depending on the object
    // itself would defeat the serialization and refetch every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Single choke point for blocked-user filtering (App Store 1.2): every
  // feed surface — list, map, mural — consumes this hook, so dropping
  // blocked creators here hides their activities everywhere at once.
  // Client-side because blocked_users may not exist server-side yet.
  const visibleEvents = useMemo(
    () =>
      blockedIds.size === 0 ? events : events.filter((e) => !blockedIds.has(e.creator_id)),
    [events, blockedIds]
  );

  return { events: visibleEvents, isLoading, error, refetch: fetchEvents };
}

export function useEvent(id: string) {
  const [event, setEvent] = useState<EventWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setEvent(await eventsService.getEventById(id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load event');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  return { event, isLoading, error, refetch: fetchEvent };
}
