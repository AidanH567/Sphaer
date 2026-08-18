/**
 * Venues + venue favourites, wrapped for components.
 *
 * Follows the repo's layering rule (CLAUDE.md): components never call
 * services, only hooks. Loading/error shape matches useEvents so the map
 * screen can treat both the same way.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as venuesService from '@/services/venues.service';
import { useAuthContext } from '@/context/AuthContext';
import type { Venue, VenueWithMeta } from '@/types/venue.types';

/**
 * Every venue, plus the signed-in user's hearts.
 *
 * Both reads degrade to [] when the venues migration isn't applied yet
 * (see venues.service.ts), so this hook never surfaces an error for the
 * one situation that is currently guaranteed — it just reports an empty
 * city, which is what the map should show.
 */
export function useVenues() {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;

  const [venues, setVenues] = useState<Venue[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [allVenues, saved] = await Promise.all([
        venuesService.getVenues(),
        userId ? venuesService.getSavedVenueIds(userId) : Promise.resolve([]),
      ]);
      setVenues(allVenues);
      setSavedIds(new Set(saved));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load venues');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /**
   * Heart / unheart, applied optimistically.
   *
   * The map redraws on every toggle, and a round-trip before the heart
   * fills would make it feel broken. On failure the previous set is put
   * back and the error surfaced — no silent divergence between what the
   * map shows and what the database holds.
   */
  const toggleSaved = useCallback(
    async (venueId: string) => {
      if (!userId) return;
      const wasSaved = savedIds.has(venueId);

      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(venueId);
        else next.add(venueId);
        return next;
      });

      try {
        if (wasSaved) await venuesService.unsaveVenue(userId, venueId);
        else await venuesService.saveVenue(userId, venueId);
      } catch (e: unknown) {
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(venueId);
          else next.delete(venueId);
          return next;
        });
        setError(
          e instanceof venuesService.VenuesUnavailableError
            ? 'Saving venues is not available yet.'
            : e instanceof Error
              ? e.message
              : 'Could not save that venue',
        );
      }
    },
    [userId, savedIds],
  );

  const venuesWithMeta: VenueWithMeta[] = useMemo(
    () => venuesService.withSavedState(venues, savedIds),
    [venues, savedIds],
  );

  return {
    venues: venuesWithMeta,
    savedVenueIds: savedIds,
    isLoading,
    error,
    refetch: fetchAll,
    toggleSaved,
    canSave: userId !== null,
  };
}
