import { useEffect, useState, useCallback } from 'react';
import * as eventsService from '@/services/events.service';
import type { EventWithRelations, EventFilters } from '@/types/event.types';

export function useEvents(filters?: EventFilters) {
  const [events, setEvents] = useState<EventWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, isLoading, error, refetch: fetchEvents };
}

export function useEvent(id: string) {
  const [event, setEvent] = useState<EventWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    eventsService
      .getEventById(id)
      .then(setEvent)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load event'))
      .finally(() => setIsLoading(false));
  }, [id]);

  return { event, isLoading, error };
}
