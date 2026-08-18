import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSavedEvents, getEventsByCreator } from '@/services/events.service';
import { getMyRegisteredEvents } from '@/services/registrations.service';
import { buildActivityTabs, type ActivityTab } from '@/utils/profile-activities';
import type { EventWithRelations } from '@/types/event.types';

interface UseProfileActivitiesResult {
  tabs: ActivityTab[];
  /**
   * Ids the profile owner holds a LOCAL registration for — the set that has a
   * real ticket row, and therefore a QR at /ticket/[id]. Only meaningful on
   * your own profile; on someone else's this is their registrations, which
   * are not your tickets, so the badge is suppressed there.
   */
  registeredIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * The activities behind the Activities sheet's segmented control.
 *
 * Two queries, not four: All / Going / Saved / Past are all derived
 * client-side from the registered and saved lists (see
 * utils/profile-activities), because they are subsets and unions of the same
 * two sets. Deriving rather than re-querying is what makes switching tabs
 * instant — the old per-button sheets each re-fetched on every open.
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
    // whole list (same posture as fetchRealProfile's per-query catch).
    //
    // Exactly one of `saved` / `hosting` is fetched, never both: Saved is
    // own-profile-only, and hosting only earns its round trip on someone
    // else's page (own-profile Going already contains what you host).
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
    // A FAILED query and an EMPTY one must not look the same.
    //
    // Only `going` used to raise the error, so a network timeout on the saved
    // query fell through to `savedResult ?? []` and the sheet said, calmly and
    // with no error anywhere, that you have saved nothing. That is the worst
    // possible reading of a failure — it is indistinguishable from the truth,
    // and it lands on the exact feature Lara already reported as losing her
    // saves.
    //
    // `null` unambiguously means "attempted and failed": the branches that are
    // deliberately NOT fetched resolve to `[]`, never null. So checking all
    // three cannot report an error for a query that was never run.
    if (goingResult === null || savedResult === null || hostingResult === null) {
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

  const registeredIds = useMemo(() => new Set(going.map((e) => e.id)), [going]);

  return { tabs, registeredIds, isLoading, error, refetch };
}
