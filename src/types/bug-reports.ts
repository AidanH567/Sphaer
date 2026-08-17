/**
 * Hand-written row types for the designer bug-reporting system
 * (migration 20260817000000_bug_reports.sql).
 *
 * WHY HAND-WRITTEN: src/types/supabase.ts is generated from the LIVE
 * database, which does not have `bug_reports` / `profiles.is_designer`
 * until Aidan applies the migration. Once he runs `npx supabase db push`
 * and regenerates types, the generated Database type replaces this file's
 * schema shim — delete `BugReportsDatabase` (and the cast in
 * bugReport.service.ts) and re-point the row aliases at the generated
 * types, exactly like the moderation tables will be migrated some day.
 */

export type BugReportStatus =
  | 'new'
  | 'awaiting_ok'
  | 'approved'
  | 'rejected'
  | 'fixed';

// Declared as `type`, not `interface`: only type aliases get the implicit
// index signature that satisfies postgrest-js's `Row: Record<string, unknown>`
// GenericTable constraint (see moderation.service.ts for the war story).
export type BugReportRow = {
  id: string;
  reporter: string;
  description: string;
  screen: string | null;
  app_version: string | null;
  status: BugReportStatus;
  status_reason: string | null;
  fix_prompt: string | null;
  screenshot_path: string | null;
  created_at: string;
  updated_at: string;
};

export type BugReportInsert = {
  id?: string;
  reporter: string;
  description: string;
  screen?: string | null;
  app_version?: string | null;
  status?: BugReportStatus;
  status_reason?: string | null;
  fix_prompt?: string | null;
  screenshot_path?: string | null;
  created_at?: string;
  updated_at?: string;
};

/** The one profiles column this feature reads that the generated types
 *  don't know yet. Kept deliberately minimal — everything else about
 *  profiles goes through the real typed client. */
type DesignerProfileRow = {
  id: string;
  is_designer: boolean;
};

/** Minimal schema for the bug-report surface, mirroring the generated
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
        Update: Partial<BugReportRow>;
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
