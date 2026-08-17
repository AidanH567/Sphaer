import { useEffect, useState, useCallback } from 'react';
import * as circlesService from '@/services/circles.service';
import type { CircleWithCounts } from '@/types/circle.types';

export function useCircles(search?: string) {
  const [circles, setCircles] = useState<CircleWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCircles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await circlesService.getCircles(search);
      setCircles(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load circles');
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCircles();
  }, [fetchCircles]);

  return { circles, isLoading, error, refetch: fetchCircles };
}

/**
 * The circles the signed-in user actually belongs to or follows — the data
 * behind the "My circles" section on the Circles screen (Lara #8).
 *
 * Passing `undefined` (no session) short-circuits to an empty, non-loading
 * result rather than querying: without a user we genuinely do not know what
 * "my circles" means, and the caller renders nothing instead of an empty
 * state that would falsely claim the user has joined none.
 */
export function useMyCircles(userId: string | undefined) {
  const [circles, setCircles] = useState<CircleWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const fetchMyCircles = useCallback(async () => {
    if (!userId) {
      setCircles([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setCircles(await circlesService.getMyCircles(userId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load your circles');
      setCircles([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMyCircles();
  }, [fetchMyCircles]);

  return { circles, isLoading, error, refetch: fetchMyCircles };
}

export function useCircle(id: string) {
  const [circle, setCircle] = useState<CircleWithCounts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCircle = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setCircle(await circlesService.getCircleById(id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load circle');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCircle();
  }, [fetchCircle]);

  return { circle, isLoading, error, refetch: fetchCircle };
}
