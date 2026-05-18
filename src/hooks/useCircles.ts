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

export function useCircle(id: string) {
  const [circle, setCircle] = useState<CircleWithCounts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    circlesService
      .getCircleById(id)
      .then(setCircle)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load circle'))
      .finally(() => setIsLoading(false));
  }, [id]);

  return { circle, isLoading, error };
}
