/**
 * Helpers for mapping Supabase auth failures to user-facing form errors.
 *
 * GoTrue returns machine-readable codes (`user_already_exists`,
 * `invalid_credentials`, …) on `AuthApiError.code`, but the field only
 * exists on recent supabase-js versions — so callers should match on the
 * code first and fall back to the message text.
 */

/** Extract the GoTrue error code from a thrown auth error, if present. */
export function authErrorCode(e: unknown): string | null {
  if (
    e !== null &&
    typeof e === 'object' &&
    'code' in e &&
    typeof (e as { code: unknown }).code === 'string'
  ) {
    return (e as { code: string }).code;
  }
  return null;
}

/** True when the signup failed because the email already has an account. */
export function isAlreadyRegisteredError(e: unknown): boolean {
  if (authErrorCode(e) === 'user_already_exists') return true;
  return e instanceof Error && /already registered/i.test(e.message);
}

/** True when login failed because email/password don't match an account. */
export function isInvalidCredentialsError(e: unknown): boolean {
  if (authErrorCode(e) === 'invalid_credentials') return true;
  return e instanceof Error && /invalid login credentials/i.test(e.message);
}

/* ── Friendly error formatting ──────────────────────────── */

/** Which form field an auth error should attach to. */
export type AuthErrorField = 'name' | 'email' | 'password';

/** The screen calling formatAuthError — disambiguates context-specific copy. */
export type AuthErrorContext = 'signup' | 'login' | 'reset';

export interface FormattedAuthError {
  /**
   * Field to attach the message to (renders inline under that input with a
   * red border). Omitted → the caller shows it in the form-level banner.
   */
  field?: AuthErrorField;
  /** User-facing, friendly copy — never a raw GoTrue / fetch string. */
  message: string;
  /**
   * Set for the duplicate-email signup case so the caller can render a
   * tappable "Log in instead" recovery affordance.
   */
  offerLogin?: boolean;
}

/** HTTP status off a thrown Supabase AuthApiError, if present. */
function authErrorStatus(e: unknown): number | null {
  if (
    e !== null &&
    typeof e === 'object' &&
    'status' in e &&
    typeof (e as { status: unknown }).status === 'number'
  ) {
    return (e as { status: number }).status;
  }
  return null;
}

function errorName(e: unknown): string {
  return e !== null &&
    typeof e === 'object' &&
    'name' in e &&
    typeof (e as { name: unknown }).name === 'string'
    ? (e as { name: string }).name
    : '';
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === 'string' ? e : '';
}

/** The 15s fetch wrapper (src/lib/supabase.ts) aborts a hung request. */
function isTimeoutError(e: unknown): boolean {
  return errorName(e) === 'AbortError' || /\baborted\b|timed? ?out/i.test(errorMessage(e));
}

/** A dead network: RN throws "Network request failed", web "Failed to fetch". */
function isOfflineError(e: unknown): boolean {
  if (errorName(e) === 'AuthRetryableFetchError') return true;
  return /network request failed|failed to fetch|network ?error/i.test(errorMessage(e));
}

/** GoTrue weak-password reasons (['length'] | ['pwned'] | ['characters'] …). */
function weakPasswordReasons(e: unknown): string[] {
  if (
    e !== null &&
    typeof e === 'object' &&
    'reasons' in e &&
    Array.isArray((e as { reasons: unknown }).reasons)
  ) {
    return (e as { reasons: unknown[] }).reasons.filter(
      (r): r is string => typeof r === 'string'
    );
  }
  return [];
}

/**
 * Maps any auth failure — GoTrue error code, weak-password reasons, or a
 * network/timeout fetch rejection — to friendly, field-attributed copy.
 * The single source of truth for auth error text across signup, login, and
 * password reset. Network checks run first because a dead socket never
 * carries a GoTrue code.
 */
export function formatAuthError(e: unknown, context: AuthErrorContext): FormattedAuthError {
  if (isTimeoutError(e)) {
    return { message: 'The server took too long to respond. Please try again.' };
  }
  if (isOfflineError(e)) {
    return { message: "You're offline. Check your connection and try again." };
  }

  const code = authErrorCode(e);
  const msg = errorMessage(e);

  if (isAlreadyRegisteredError(e)) {
    return {
      field: 'email',
      message: 'An account already exists for this email.',
      offerLogin: true,
    };
  }

  if (isInvalidCredentialsError(e)) {
    // Attach to the password field on login (the likeliest fix); elsewhere
    // there's no single field to blame, so fall back to the banner.
    return {
      field: context === 'login' ? 'password' : undefined,
      message: 'Email or password is incorrect.',
    };
  }

  if (code === 'weak_password' || weakPasswordReasons(e).length > 0) {
    return weakPasswordReasons(e).includes('pwned')
      ? {
          field: 'password',
          message: 'That password showed up in a data breach. Please choose another.',
        }
      : {
          field: 'password',
          message: 'Please pick a stronger password — at least 8 characters.',
        };
  }

  if (
    code === 'validation_failed' ||
    code === 'email_address_invalid' ||
    /invalid format|unable to validate email/i.test(msg)
  ) {
    return { field: 'email', message: "That email address doesn't look right." };
  }

  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) {
    return { message: 'Please confirm your email first — check your inbox for the link.' };
  }

  if (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    authErrorStatus(e) === 429 ||
    /rate limit/i.test(msg)
  ) {
    return { message: 'Too many attempts — wait a minute and try again.' };
  }

  if (code === 'signup_disabled' || /signups? ?(?:are )?(?:not allowed|disabled)/i.test(msg)) {
    return { message: 'Sign-ups are paused right now. Please try again later.' };
  }

  return { message: 'Something went wrong on our end. Please try again.' };
}
