import type { ReportKind, ReportSeverity } from '@/constants/report-kinds';

/**
 * Hand-written row types for the report system (migrations
 * 20260817000000_bug_reports.sql and
 * 20260817120000_bug_reports_kind_and_triage.sql).
 *
 * WHY HAND-WRITTEN: src/types/supabase.ts is generated from the live
 * database, and regenerating it is currently blocked — local and remote
 * migration history have completely diverged, so `supabase gen types`
 * against the linked project would also drag in five months of schema the
 * repo has never described. Both migrations ARE applied on production; this
 * file is the typed view of them until that reconciliation happens. When it
 * does, delete `BugReportsDatabase` (and the cast in bugReport.service.ts)
 * and re-point the row aliases at the generated types.
 */

export type BugReportStatus =
  | 'new'
  | 'awaiting_ok'
  | 'approved'
  | 'rejected'
  | 'fixed';

/** Statuses triage can move a report INTO from the app. */
export const TRIAGE_STATUSES: readonly BugReportStatus[] = [
  'new',
  'awaiting_ok',
  'approved',
  'rejected',
  'fixed',
] as const;

export const STATUS_LABEL: Record<BugReportStatus, string> = {
  new: 'New',
  awaiting_ok: 'Awaiting OK',
  approved: 'Approved',
  rejected: 'Rejected',
  fixed: 'Fixed',
};

/**
 * The per-kind structured answers, stored as JSONB. Typed as a loose record
 * on the way OUT of the database on purpose: a row written by an older (or
 * newer) app version may carry keys this build has never heard of, and
 * `detailEntriesForRow` skips them rather than crashing on them.
 */
export type BugReportDetails = Record<string, unknown>;

// Declared as `type`, not `interface`: only type aliases get the implicit
// index signature that satisfies postgrest-js's `Row: Record<string, unknown>`
// GenericTable constraint (see moderation.service.ts for the war story).
export type BugReportRow = {
  id: string;
  /** NULL = filed by Tina via the service role (Telegram inlet). */
  reporter: string | null;
  /** The PRIMARY answer, whatever the kind asked for. Never null. */
  description: string;
  /** 'bug' | 'feature' | 'change'. Defaults to 'bug' — pre-kind rows are bugs. */
  kind: ReportKind;
  /** Bug-only, and optional even there. */
  severity: ReportSeverity | null;
  /** Per-kind extra answers — see constants/report-kinds.ts. */
  details: BugReportDetails;
  screen: string | null;
  app_version: string | null;
  status: BugReportStatus;
  /** Rejection reason — shown back to the reporter. */
  status_reason: string | null;
  /** Triage's working note. Distinct from status_reason. */
  triage_note: string | null;
  fix_prompt: string | null;
  screenshot_path: string | null;
  created_at: string;
  updated_at: string;
};

export type BugReportInsert = {
  id?: string;
  reporter: string;
  description: string;
  kind?: ReportKind;
  severity?: ReportSeverity | null;
  details?: BugReportDetails;
  screen?: string | null;
  app_version?: string | null;
  status?: BugReportStatus;
  status_reason?: string | null;
  triage_note?: string | null;
  fix_prompt?: string | null;
  screenshot_path?: string | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * The only columns an in-app triager may write. Mirrors the column-level
 * GRANT in migration 20260817120000 — the database rejects anything else,
 * so this type keeps the client honest about it rather than discovering it
 * as a 42501 at runtime.
 */
export type BugReportTriageUpdate = {
  status?: BugReportStatus;
  status_reason?: string | null;
  triage_note?: string | null;
  fix_prompt?: string | null;
};

/** A report joined with the little we show about its reporter. */
export interface TriageReport extends BugReportRow {
  reporterName: string;
}

/** The one profiles column this feature reads that the generated types
 *  don't know yet. Kept deliberately minimal — everything else about
 *  profiles goes through the real typed client. */
type DesignerProfileRow = {
  id: string;
  is_designer: boolean;
};

/** Minimal schema for the report surface, mirroring the generated
 *  Database layout so a cast SupabaseClient resolves identical builder
 *  behavior. Same pattern as ModerationDatabase in moderation.service.ts. */
export type BugReportsDatabase = {
  // Same PostgREST version marker as the generated Database type.
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      bug_reports: {
        Row: BugReportRow;
        Insert: BugReportInsert;
        Update: BugReportTriageUpdate;
        Relationships: [];
      };
      profiles: {
        Row: DesignerProfileRow;
        Insert: DesignerProfileRow;
        Update: Partial<DesignerProfileRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
