import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateImageUpload } from '@/utils/upload-validation';
import {
  isReportKind,
  isReportSeverity,
  type ReportKind,
  type ReportSeverity,
} from '@/constants/report-kinds';
import type {
  BugReportDetails,
  BugReportRow,
  BugReportStatus,
  BugReportsDatabase,
  TriageReport,
} from '@/types/bug-reports';

// ---------------------------------------------------------------------------
// Reports — bugs, features and changes (design doc "Sphaer Bug System —
// 2026-08-17" plus the 2026-08-17 "not everything we want to add is a bug"
// grill). The `bug_reports` table, `profiles.is_designer` flag, and
// `bug-screenshots` bucket come from migration 20260817000000; `kind`,
// `severity`, `details`, `triage_note` and the designer RLS policies from
// 20260817120000. BOTH ARE APPLIED ON PRODUCTION.
//
// The graceful-degradation machinery below is kept anyway: a native build
// installed on someone's phone can be older or newer than the schema, and a
// hard crash on a missing column is a worse failure than a polite notice.
//   reads  → degrade to "not a designer" (admin entry stays hidden)
//   writes → throw BugReportUnavailableError so the UI can say
//            "available after the next app update" instead of a raw error.
// Mirrors moderation.service.ts (the reports/blocked_users twin) exactly.
// ---------------------------------------------------------------------------

/**
 * Thrown by report writes when the backing table / column / bucket isn't
 * there. UI catches this by instance and shows the "available after the next
 * app update" notice.
 */
export class BugReportUnavailableError extends Error {
  constructor() {
    super('Reporting will be available after the next app update.');
    this.name = 'BugReportUnavailableError';
  }
}

/**
 * Thrown when a triage write changed nothing. Under RLS an UPDATE that
 * matches no row is a SUCCESS with zero rows, not an error — so without this
 * check a non-designer would see "Approved!" and nothing would have happened.
 * The honest reading is "you are not allowed, or the report is gone".
 */
export class TriageNotPermittedError extends Error {
  constructor() {
    super("That didn't save — your account can't triage reports.");
    this.name = 'TriageNotPermittedError';
  }
}

export interface SubmitBugReportInput {
  /** The PRIMARY answer for the chosen kind — lands in `description`. */
  description: string;
  /** bug | feature | change. Defaults to 'bug' when omitted. */
  kind?: ReportKind;
  /** Bug-only; null for every other kind. */
  severity?: ReportSeverity | null;
  /** The remaining per-kind answers — see constants/report-kinds.ts. */
  details?: Record<string, string>;
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
 * Is this user a flagged designer? Does NOT gate reporting (see
 * `canReportBug`) — since 2026-08-17 it gates the ADMIN surface: the triage
 * screen and its entry row.
 *
 * This is a convenience for HIDING the UI, never the security boundary. The
 * boundary is `bug_reports_select_designer` / `bug_reports_update_designer`
 * in migration 20260817120000, which call `public.current_user_is_designer()`
 * server-side. A client that lies here still reads and writes nothing.
 *
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
 * File a report as `reporterId`. Uploads the screenshot (if any) first,
 * then inserts the row with status 'new'. If the row insert fails after a
 * successful upload, best-effort deletes the orphan storage object.
 *
 * `kind` defaults to 'bug' — matching the column default, so a caller that
 * predates the kind picker files exactly what it always filed.
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
    throw new Error('Please fill in the first question before submitting.');
  }

  const kind: ReportKind = input.kind ?? 'bug';
  // Severity is bug-only. Enforced HERE as well as in the form, because a
  // stale severity left over from a kind switch would otherwise show up on a
  // feature request in triage and be quietly believed.
  const severity = kind === 'bug' && input.severity ? input.severity : null;
  const screen = kind === 'bug' ? input.screen?.trim() || null : null;

  let screenshotPath: string | null = null;
  if (input.screenshotUri) {
    screenshotPath = await uploadBugScreenshot(reporterId, input.screenshotUri);
  }

  const { error } = await bugReportDb.from('bug_reports').insert({
    reporter: reporterId,
    description,
    kind,
    severity,
    details: input.details ?? {},
    screen,
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

// ─── Triage (designers only) ────────────────────────────────────────────────
// Everything below is gated SERVER-SIDE by the RLS policies in migration
// 20260817120000. None of these functions check `is_designer` themselves,
// deliberately: a client-side check is a UI affordance, and duplicating it
// here would create a fifth place the permission lives (the previous version
// of this feature already had four, and one of them was wrong for a day).
// A non-designer calling these reads an empty list and writes nothing.

export interface TriageFilter {
  /** null = all statuses. */
  status?: BugReportStatus | null;
  /** null = all kinds. */
  kind?: ReportKind | null;
  limit?: number;
}

const TRIAGE_PAGE_SIZE = 100;

/**
 * Every report the caller is allowed to see, newest first.
 *
 * Two queries, not a PostgREST embed: the hand-written `BugReportsDatabase`
 * shim declares no relationships (it can't — the generated types are stale
 * for unrelated reasons), so an embedded select would not type. Fetching the
 * reporter profiles separately through the REAL typed client is both simpler
 * and honest about what it costs — one extra round trip on an admin screen
 * that loads at most a page of rows.
 *
 * Returns [] rather than throwing when the schema is missing, so an old
 * build shows an empty queue instead of a red screen.
 */
export async function listTriageReports(
  filter: TriageFilter = {}
): Promise<TriageReport[]> {
  let query = bugReportDb
    .from('bug_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? TRIAGE_PAGE_SIZE);

  if (filter.status) query = query.eq('status', filter.status);
  if (filter.kind) query = query.eq('kind', filter.kind);

  const { data, error } = await query;
  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }

  const rows = (data ?? []).map(normalizeRow);
  const names = await fetchReporterNames(rows);
  return rows.map((row) => ({
    ...row,
    reporterName: row.reporter
      ? (names.get(row.reporter) ?? 'Unknown account')
      : 'Tina (Telegram)',
  }));
}

/**
 * Move a report to a new status. A rejection MUST carry a reason — that is
 * the whole difference between "rejected" and a row that silently stopped
 * moving, and it is what the reporter would be shown.
 *
 * Throws TriageNotPermittedError when the update matched no row (RLS said
 * no, or the report was deleted) — see the class comment for why a plain
 * success check is not enough here.
 */
export async function setReportStatus(
  id: string,
  status: BugReportStatus,
  reason?: string | null
): Promise<void> {
  const trimmedReason = reason?.trim() || null;
  if (status === 'rejected' && !trimmedReason) {
    throw new Error('Give a reason when rejecting a report.');
  }

  const { data, error } = await bugReportDb
    .from('bug_reports')
    .update(
      // Only send status_reason when rejecting, so approving a
      // previously-rejected report doesn't leave its old rejection text
      // hanging underneath the new status.
      status === 'rejected'
        ? { status, status_reason: trimmedReason }
        : { status, status_reason: null }
    )
    .eq('id', id)
    .select('id');

  if (error) {
    if (isMissingSchemaError(error)) throw new BugReportUnavailableError();
    throw error;
  }
  if (!data || data.length === 0) throw new TriageNotPermittedError();
}

/** Save (or clear) triage's working note on a report. */
export async function saveTriageNote(id: string, note: string): Promise<void> {
  const { data, error } = await bugReportDb
    .from('bug_reports')
    .update({ triage_note: note.trim() || null })
    .eq('id', id)
    .select('id');

  if (error) {
    if (isMissingSchemaError(error)) throw new BugReportUnavailableError();
    throw error;
  }
  if (!data || data.length === 0) throw new TriageNotPermittedError();
}

/**
 * A time-limited URL for a screenshot in the PRIVATE bucket. Signing is
 * itself permission-checked: Supabase refuses to sign an object the caller
 * cannot SELECT, so a non-designer gets null here for someone else's shot.
 * Returns null on any failure — a missing thumbnail must never take the
 * triage list down with it.
 */
export async function getScreenshotUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('bug-screenshots')
      .createSignedUrl(path, expiresInSeconds);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Coerce a row read from the database into the typed shape. `kind` and
 * `severity` are CHECK-constrained server-side, but a row written by a
 * NEWER app version (a fourth kind, say) would otherwise flow into the UI
 * as an unhandled value and index into KIND_LABEL as undefined.
 */
function normalizeRow(row: BugReportRow): BugReportRow {
  return {
    ...row,
    kind: isReportKind(row.kind) ? row.kind : 'bug',
    severity: isReportSeverity(row.severity) ? row.severity : null,
    details: isPlainObject(row.details) ? row.details : {},
  };
}

function isPlainObject(value: unknown): value is BugReportDetails {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** username / display_name for the distinct reporters in a page of rows. */
async function fetchReporterNames(rows: BugReportRow[]): Promise<Map<string, string>> {
  const ids = Array.from(
    new Set(rows.map((row) => row.reporter).filter((id): id is string => Boolean(id)))
  );
  const names = new Map<string, string>();
  if (ids.length === 0) return names;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', ids);
  if (error || !data) return names;

  for (const profile of data) {
    names.set(profile.id, profile.username || profile.display_name || 'Unknown account');
  }
  return names;
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
