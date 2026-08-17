import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateImageUpload } from '@/utils/upload-validation';
import type { BugReportsDatabase } from '@/types/bug-reports';

// ---------------------------------------------------------------------------
// Designer bug reports (design doc "Sphaer Bug System — 2026-08-17"). The
// `bug_reports` table, `profiles.is_designer` flag, and `bug-screenshots`
// bucket land with migration 20260817000000_bug_reports.sql, which is
// AUTHORED but not applied until Aidan runs `npx supabase db push` — so
// every function here must survive the schema not existing at runtime:
//   reads  → degrade to "not a designer" (entry point stays hidden)
//   writes → throw BugReportUnavailableError so the UI can say
//            "available after the next app update" instead of a raw error.
// Mirrors moderation.service.ts (the reports/blocked_users twin) exactly.
// ---------------------------------------------------------------------------

/**
 * Thrown by bug-report writes when the backing table / bucket doesn't exist
 * yet (migration 20260817000000 not pushed). UI catches this by instance and
 * shows the "available after the next app update" notice.
 */
export class BugReportUnavailableError extends Error {
  constructor() {
    super('Bug reporting will be available after the next app update.');
    this.name = 'BugReportUnavailableError';
  }
}

export interface SubmitBugReportInput {
  description: string;
  /** Human-readable screen name ("Feed", "Event detail", …) — optional. */
  screen?: string | null;
  /** Local image URI from the picker — optional. */
  screenshotUri?: string | null;
}

/** The single documented cast at the bug-report boundary (same rule as
 *  moderation.service.ts's moderationDb): widen through `unknown` here —
 *  and ONLY here — until `supabase gen types` knows the new schema. */
const bugReportDb = supabase as unknown as SupabaseClient<BugReportsDatabase>;

/** Does this error mean "the table/column doesn't exist yet"? Covers the
 *  moderation-service shapes (42P01 relation missing, PGRST205 schema
 *  cache) plus 42703/PGRST204 — `profiles.is_designer` is a COLUMN added
 *  to an existing table, which PostgREST reports differently. */
function isMissingSchemaError(error: { code?: string; message?: string }): boolean {
  if (
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === 'PGRST205' ||
    error.code === 'PGRST204'
  ) {
    return true;
  }
  const msg = (error.message ?? '').toLowerCase();
  return msg.includes('does not exist') || msg.includes('schema cache');
}

/** Storage errors don't carry Postgres codes — a missing bucket comes back
 *  as a 404 with "Bucket not found". */
function isMissingBucketError(error: { message?: string }): boolean {
  return (error.message ?? '').toLowerCase().includes('bucket not found');
}

/**
 * May this user report a bug? Currently: ANY signed-in user.
 *
 * Opened up 2026-08-17 on Aidan's call — "we are just testing". While the
 * userbase is three people, a per-account flag buys nothing and costs a manual
 * SQL step for each of them, which is friction on exactly the people whose
 * feedback we want. The RLS policy was opened to match, before the migration
 * was ever applied.
 *
 * ⚠️ To re-gate before real users arrive: return the `is_designer` lookup
 * below AND restore the matching clause in the RLS insert policy. BOTH are
 * required — this function only hides the entry point; the policy is what
 * actually stops an insert. Changing one and not the other gives you either a
 * hidden-but-open API or a visible-but-refusing button.
 *
 * The `profiles.is_designer` column is deliberately kept for that reason.
 */
export async function canReportBug(userId: string): Promise<boolean> {
  return Boolean(userId);
}

/**
 * Is this user a flagged designer? No longer gates reporting (see
 * `canReportBug`), but kept for the triage view, which will need to tell a
 * team report from a user report.
 * Fails CLOSED on any error, including the column not existing yet.
 */
export async function getIsDesigner(userId: string): Promise<boolean> {
  try {
    const { data, error } = await bugReportDb
      .from('profiles')
      .select('is_designer')
      .eq('id', userId)
      .maybeSingle();
    if (error) return false;
    return data?.is_designer === true;
  } catch {
    return false;
  }
}

/**
 * File a bug report as `reporterId`. Uploads the screenshot (if any) first,
 * then inserts the row with status 'new'. If the row insert fails after a
 * successful upload, best-effort deletes the orphan storage object.
 *
 * Throws:
 *   - BugReportUnavailableError when the table/bucket isn't live yet
 *   - UploadValidationError for a bad screenshot (type/size)
 *   - the raw Supabase error otherwise (network, RLS, …) — the screen
 *     surfaces it as an honest inline error, never a silent drop.
 */
export async function submitBugReport(
  reporterId: string,
  input: SubmitBugReportInput
): Promise<void> {
  const description = input.description.trim();
  if (!description) {
    throw new Error('Please describe the bug before submitting.');
  }

  let screenshotPath: string | null = null;
  if (input.screenshotUri) {
    screenshotPath = await uploadBugScreenshot(reporterId, input.screenshotUri);
  }

  const { error } = await bugReportDb.from('bug_reports').insert({
    reporter: reporterId,
    description,
    screen: input.screen?.trim() || null,
    app_version: getAppVersion(),
    screenshot_path: screenshotPath,
  });
  if (!error) return;

  if (screenshotPath) {
    // Insert failed after upload — clean up the orphan (mirrors
    // uploadGalleryImage in profile.service.ts).
    await supabase.storage
      .from('bug-screenshots')
      .remove([screenshotPath])
      .catch((err) => {
        console.warn('[bugReport.service] Failed to remove orphan screenshot', err);
      });
  }
  if (isMissingSchemaError(error)) throw new BugReportUnavailableError();
  throw error;
}

/**
 * Upload one screenshot to the private `bug-screenshots` bucket.
 * Path scheme: `<userId>/<timestamp>.<ext>` (bucket RLS requires the
 * user's own folder AND the is_designer flag). Returns the storage path
 * stored in `bug_reports.screenshot_path`.
 */
async function uploadBugScreenshot(userId: string, uri: string): Promise<string> {
  const ext = inferExtension(uri);
  const path = `${userId}/${Date.now()}.${ext}`;
  const blob = await uriToBlob(uri);
  validateImageUpload(blob);

  const { error } = await supabase.storage
    .from('bug-screenshots')
    .upload(path, blob, { upsert: false, contentType: blob.type || `image/${ext}` });
  if (error) {
    if (isMissingBucketError(error)) throw new BugReportUnavailableError();
    throw error;
  }
  return path;
}

/** App version for triage context — expo.version from app config. Null when
 *  unavailable (bare jest env) rather than a fabricated string. */
function getAppVersion(): string | null {
  return Constants.expoConfig?.version ?? null;
}

/* ── Internal helpers (duplicated from profile.service.ts, where they are
      module-private — kept local rather than widening that file's API) ── */

function inferExtension(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const ext = match?.[1]?.toLowerCase();
  if (!ext || ext.length > 5) return 'jpg';
  return ext === 'jpeg' ? 'jpg' : ext;
}

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}
