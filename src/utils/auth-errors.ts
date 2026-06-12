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
