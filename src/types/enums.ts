/**
 * String-literal aliases for DB enum-like columns.
 *
 * The schema enforces these values via Postgres CHECK constraints — but the
 * generated `Database` types in `supabase.ts` widen them all to `string`,
 * which means a typo like `'circle_evnt'` instead of `'circle_event'`
 * silently breaks routing / display without any compile error.
 *
 * Use these aliases everywhere we read or write the relevant column to get
 * autocomplete + typo protection back.
 */

/** `notifications.type` — matched against the CHECK constraint in the
 * 20240101000000 schema. */
export type NotificationType =
  | 'follow'
  | 'event_reminder'
  | 'circle_event'
  | 'message';

/** `circle_members.role` — matched against the CHECK constraint in the
 * 20240101000000 schema. */
export type CircleRole = 'admin' | 'member';
