import { useCallback, useEffect, useState } from 'react';
import {
  getIsDesigner,
  submitBugReport,
  BugReportUnavailableError,
  type SubmitBugReportInput,
} from '@/services/bugReport.service';
import { UploadValidationError } from '@/utils/upload-validation';

/**
 * May this user see the "Report a bug" entry? Currently: anyone signed in.
 *
 * Opened 2026-08-17 (Aidan): "right now let's just open it for everyone" —
 * the userbase is three people and a per-account flag is pure friction on
 * exactly the people whose feedback we want.
 *
 * ⚠️ THE PLANNED END STATE IS TWO SCREENS, NOT A RE-GATE. Aidan's call:
 * a light USER-facing "report a problem / suggest a change", and a fuller
 * ADMIN one (triage, status, the drafted fix-prompt). When that is built,
 * this hook splits — `useCanReportBug` for everyone, `useIsDesigner` for the
 * admin surface — and `profiles.is_designer` becomes the switch between them.
 * That is why the column is still there and still populated.
 */
export function useCanReportBug(userId: string | undefined): boolean {
  return Boolean(userId);
}

/**
 * Is the given user a flagged designer? No longer gates reporting — kept for
 * the admin/triage surface described above. Fails closed to false.
 */
export function useIsDesigner(userId: string | undefined): boolean {
  const [isDesigner, setIsDesigner] = useState(false);

  useEffect(() => {
    if (!userId) {
      setIsDesigner(false);
      return;
    }
    let active = true;
    getIsDesigner(userId)
      .then((flag) => {
        if (active) setIsDesigner(flag);
      })
      .catch(() => {
        if (active) setIsDesigner(false); // fail closed — hide the entry
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return isDesigner;
}

export type BugReportSubmitState = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Submission state machine for the bug-report screen. Errors are mapped to
 * honest user-facing messages here (not in the component) so the screen
 * just renders `errorMessage` — offline/RLS/validation failures all surface,
 * nothing is silently dropped.
 */
export function useBugReportSubmit(userId: string | undefined) {
  const [state, setState] = useState<BugReportSubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = useCallback(
    async (input: SubmitBugReportInput) => {
      if (!userId) {
        setState('error');
        setErrorMessage('You need to be signed in to report a bug.');
        return;
      }
      setState('submitting');
      setErrorMessage(null);
      try {
        await submitBugReport(userId, input);
        setState('success');
      } catch (err) {
        setState('error');
        if (err instanceof BugReportUnavailableError || err instanceof UploadValidationError) {
          setErrorMessage(err.message);
        } else if (err instanceof Error && err.message === 'Please describe the bug before submitting.') {
          setErrorMessage(err.message);
        } else {
          console.error('[useBugReport] submit failed:', err);
          setErrorMessage(
            "Couldn't send the report — check your connection and try again. Nothing was saved."
          );
        }
      }
    },
    [userId]
  );

  const reset = useCallback(() => {
    setState('idle');
    setErrorMessage(null);
  }, []);

  return { state, errorMessage, submit, reset };
}
