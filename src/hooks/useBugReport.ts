import { useCallback, useEffect, useState } from 'react';
import {
  getIsDesigner,
  submitBugReport,
  BugReportUnavailableError,
  type SubmitBugReportInput,
} from '@/services/bugReport.service';
import { UploadValidationError } from '@/utils/upload-validation';

/**
 * Is the given user a flagged designer? Gates the hidden "Report a bug"
 * entry point. Defaults to (and fails closed to) false — the row simply
 * doesn't render until the check resolves true.
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
