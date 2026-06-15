import { formatAuthError } from '@/utils/auth-errors';

/**
 * Build an Error shaped like a thrown supabase-js AuthApiError / fetch
 * rejection: a real Error (so `instanceof Error` + `.message` hold) with the
 * GoTrue `code` / `status` / weak-password `reasons` / `name` grafted on.
 */
function authErr(message: string, extra: Record<string, unknown> = {}): Error {
  return Object.assign(new Error(message), extra);
}

describe('formatAuthError', () => {
  it('maps a duplicate email to the email field with a login offer', () => {
    const r = formatAuthError(
      authErr('User already registered', { code: 'user_already_exists', status: 422 }),
      'signup'
    );
    expect(r.field).toBe('email');
    expect(r.offerLogin).toBe(true);
    expect(r.message).toMatch(/already exists/i);
  });

  it('maps a weak/short password to the password field', () => {
    const r = formatAuthError(
      authErr('Password should be at least 6 characters.', {
        code: 'weak_password',
        status: 422,
        reasons: ['length'],
      }),
      'signup'
    );
    expect(r.field).toBe('password');
    expect(r.message).toMatch(/stronger password/i);
  });

  it('distinguishes a breached (pwned) password', () => {
    const r = formatAuthError(
      authErr('weak', { code: 'weak_password', reasons: ['pwned'] }),
      'signup'
    );
    expect(r.field).toBe('password');
    expect(r.message).toMatch(/data breach/i);
  });

  it('maps a server-rejected email to the email field', () => {
    const r = formatAuthError(
      authErr('Unable to validate email address: invalid format', {
        code: 'validation_failed',
        status: 400,
      }),
      'signup'
    );
    expect(r.field).toBe('email');
    expect(r.message).toMatch(/doesn't look right/i);
  });

  it('maps invalid credentials to the password field on login', () => {
    const r = formatAuthError(
      authErr('Invalid login credentials', { code: 'invalid_credentials', status: 400 }),
      'login'
    );
    expect(r.field).toBe('password');
    expect(r.message).toMatch(/incorrect/i);
  });

  it('keeps invalid credentials in the banner outside login', () => {
    const r = formatAuthError(
      authErr('Invalid login credentials', { code: 'invalid_credentials' }),
      'signup'
    );
    expect(r.field).toBeUndefined();
  });

  it('maps an unconfirmed email to a banner hint', () => {
    const r = formatAuthError(
      authErr('Email not confirmed', { code: 'email_not_confirmed' }),
      'login'
    );
    expect(r.field).toBeUndefined();
    expect(r.message).toMatch(/confirm your email/i);
  });

  it('maps rate limiting (429) to the banner', () => {
    const r = formatAuthError(
      authErr('email rate limit exceeded', {
        code: 'over_email_send_rate_limit',
        status: 429,
      }),
      'signup'
    );
    expect(r.field).toBeUndefined();
    expect(r.message).toMatch(/too many attempts/i);
  });

  it('maps disabled signups to the banner', () => {
    const r = formatAuthError(
      authErr('Signups not allowed for this instance', { code: 'signup_disabled' }),
      'signup'
    );
    expect(r.message).toMatch(/paused/i);
  });

  it('maps an offline fetch failure to the banner', () => {
    const r = formatAuthError(
      authErr('Network request failed', { name: 'AuthRetryableFetchError' }),
      'signup'
    );
    expect(r.field).toBeUndefined();
    expect(r.message).toMatch(/offline/i);
  });

  it('maps a timeout (AbortError) to the banner', () => {
    const r = formatAuthError(authErr('Aborted', { name: 'AbortError' }), 'login');
    expect(r.message).toMatch(/too long/i);
  });

  it('falls back to a generic banner message for unknown errors', () => {
    const r = formatAuthError(new Error('kaboom'), 'signup');
    expect(r.field).toBeUndefined();
    expect(r.message).toMatch(/something went wrong/i);
  });

  it('handles non-Error inputs without throwing', () => {
    expect(formatAuthError(null, 'signup').message).toMatch(/something went wrong/i);
    expect(formatAuthError('weird', 'login').message).toMatch(/something went wrong/i);
  });
});
