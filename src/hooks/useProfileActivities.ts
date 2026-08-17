import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSavedEvents, getEventsByCreator } from '@/services/events.service';
import { getMyRegisteredEvents } from '@/services/registrations.service';
import { buildActivityTabs, type ActivityTab } from '@/utils/profile-activities';
import type { EventWithRelations } from '@/types/event.types';

interface UseProfileActivitiesResult {
  tabs: ActivityTab[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * The activities behind a profile's tab strip.
 *
 * Two queries, not four: "All" and "Tickets" are derived client-side from
 * Going and Saved (see utils/profile-activities), because Tickets is a strict
 * subset of Going and All is their union. Deriving rather than re-querying is
 * what makes the tabs instant to switch — the whole point of replacing the
 * sheets, which re-fetched on every open.
 *
 * `saved` is only fetched for your own profile. `saved_events` RLS is
 * `USING (auth.uid() = user_id)`, so asking for someone else's saved list
 * returns an empty array no matter what — a wasted round trip whose result
 * would be indistinguishable from "they saved nothing".
 */
export function useProfileActivities(
  userId: string | undefined,
  isOwnProfile: boolean,
  displayName?: string,
): UseProfileActivitiesResult {
  const [going, setGoing] = useState<EventWithRelations[]>([]);
  const [saved, setSaved] = useState<EventWithRelations[]>([]);
  const [hosting, setHosting] = useState<EventWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      setGoing([]);
      setSaved([]);
      setHosting([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    // Each query degrades independently — one failure must not blank the
    // whole panel (same posture as the old fetchRealProfile's per-query catch).
    //
    // Exactly one of `saved` / `hosting` is fetched, never both: they back the
    // tabs of two mutually exclusive layouts (own profile vs someone else's).
    const [goingResult, savedResult, hostingResult] = await Promise.all([
      getMyRegisteredEvents(userId).catch(() => null),
      isOwnProfile ? getSavedEvents(userId).catch(() => null) : Promise.resolve([]),
      isOwnProfile
        ? Promise.resolve([])
        : getEventsByCreator(userId).catch(() => null),
    ]);
    setGoing(goingResult ?? []);
    setSaved(savedResult ?? []);
    setHosting(hostingResult ?? []);
    if (goingResult === null) {
      setError('Could not load activities');
    }
    setIsLoading(false);
  }, [userId, isOwnProfile]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const tabs = useMemo(
    () => buildActivityTabs({ going, saved, hosting, isOwnProfile, displayName }),
    [going, saved, hosting, isOwnProfile, displayName],
  );

  return { tabs, isLoading, error, refetch };
}
