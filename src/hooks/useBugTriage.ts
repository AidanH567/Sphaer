import { useCallback, useEffect, useState } from 'react';
import {
  listTriageReports,
  setReportStatus,
  saveTriageNote,
  getScreenshotUrl,
  BugReportUnavailableError,
  TriageNotPermittedError,
} from '@/services/bugReport.service';
import type { ReportKind } from '@/constants/report-kinds';
import type { BugReportStatus, TriageReport } from '@/types/bug-reports';

/**
 * State for the triage screen (app/bug-triage.tsx) — the admin surface
 * `profiles.is_designer` finally gates.
 *
 * `enabled` is the caller's is_designer answer. When false this hook loads
 * NOTHING: no query, no spinner, no empty-state flash. That is not the
 * security boundary — RLS is — it just stops a non-designer's device firing
 * a query it is guaranteed to get nothing back from.
 */
export function useBugTriage(enabled: boolean) {
  const [statusFilter, setStatusFilter] = useState<BugReportStatus | null>(null);
  const [kindFilter, setKindFilter] = useState<ReportKind | null>(null);

  const [reports, setReports] = useState<TriageReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** id of the report currently being written, so only its card spins. */
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setReports([]);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const rows = await listTriageReports({ status: statusFilter, kind: kindFilter });
      setReports(rows);
    } catch (err) {
      console.error('[useBugTriage] load failed:', err);
      setLoadError("Couldn't load the queue — check your connection and pull to retry.");
    } finally {
      setIsLoading(false);
    }
  }, [enabled, statusFilter, kindFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Run one triage write, then reload. Reloading rather than patching state
   * in place is deliberate: with a status filter active, a report that no
   * longer matches MUST leave the list, and `updated_at` comes from a
   * trigger the client cannot compute.
   */
  const runAction = useCallback(
    async (id: string, action: () => Promise<void>) => {
      setPendingId(id);
      setActionError(null);
      try {
        await action();
        await refresh();
        return true;
      } catch (err) {
        if (
          err instanceof TriageNotPermittedError ||
          err instanceof BugReportUnavailableError
        ) {
          setActionError(err.message);
        } else if (err instanceof Error && err.message.startsWith('Give a reason')) {
          setActionError(err.message);
        } else {
          console.error('[useBugTriage] action failed:', err);
          setActionError("Couldn't save that — nothing was changed.");
        }
        return false;
      } finally {
        setPendingId(null);
      }
    },
    [refresh]
  );

  const approve = useCallback(
    (id: string) => runAction(id, () => setReportStatus(id, 'approved')),
    [runAction]
  );

  const reject = useCallback(
    (id: string, reason: string) => runAction(id, () => setReportStatus(id, 'rejected', reason)),
    [runAction]
  );

  const setStatus = useCallback(
    (id: string, status: BugReportStatus) => runAction(id, () => setReportStatus(id, status)),
    [runAction]
  );

  const saveNote = useCallback(
    (id: string, note: string) => runAction(id, () => saveTriageNote(id, note)),
    [runAction]
  );

  return {
    reports,
    isLoading,
    loadError,
    pendingId,
    actionError,
    statusFilter,
    setStatusFilter,
    kindFilter,
    setKindFilter,
    refresh,
    approve,
    reject,
    setStatus,
    saveNote,
  };
}

/**
 * A signed URL for one report's screenshot, or null.
 *
 * The bucket is PRIVATE (screenshots of a logged-in session can contain DMs),
 * so there is no permanent URL to render — every view needs a fresh signature.
 * Signing is permission-checked server-side, so this returns null rather than
 * an image for anyone who shouldn't see it, and null on any failure: a
 * screenshot that won't load must not take the card down with it.
 */
export function useScreenshotUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let active = true;
    getScreenshotUrl(path)
      .then((signed) => {
        if (active) setUrl(signed);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
    };
  }, [path]);

  return url;
}
