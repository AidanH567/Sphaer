import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Report & block (App Store Guideline 1.2). The `blocked_users` and `reports`
// tables land with migration 20260612020000_reports_blocked_users.sql, which
// is AUTHORED but not applied until the user runs `npx supabase db push` —
// so every function here must survive the tables not existing at runtime:
//   reads  → degrade to empty results (no blocks, not blocked)
//   writes → throw ModerationUnavailableError so the UI can say
//            "This will be available after the next app update."
// Mirrors the events.service.ts v3-columns degradation pattern.
// ---------------------------------------------------------------------------

export type ReportTargetType = 'event' | 'circle' | 'profile' | 'message';
export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'scam' | 'other';

export interface ReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}

/**
 * Thrown by moderation writes when the backing table doesn't exist yet
 * (migration 20260612020000 not pushed). UI catches this by name/instance
 * and shows the "available after the next app update" notice instead of a
 * raw Postgres error.
 */
export class ModerationUnavailableError extends Error {
  constructor() {
    super('This will be available after the next app update.');
    this.name = 'ModerationUnavailableError';
  }
}

// Declared as `type`, not `interface`: only type aliases get the implicit
// index signature that satisfies postgrest-js's `Row: Record<string, unknown>`
// GenericTable constraint — with an interface here, SupabaseClient's Schema
// parameter silently collapses to `never` and every query stops typechecking.
type BlockedUserRow = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details: string | null;
  created_at: string;
};

/** Minimal schema for the two moderation tables, mirroring the generated
 *  Database layout. The generated types in src/types/supabase.ts won't know
 *  these tables until migration 20260612020000 is applied and types are
 *  regenerated — this local schema plus the single cast below keeps the
 *  service fully typed without sprinkling casts over every query. */
type ModerationDatabase = {
  // Same PostgREST version marker as the generated Database type so the
  // casted client resolves identical builder behavior.
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      blocked_users: {
        Row: BlockedUserRow;
        Insert: { blocker_id: string; blocked_id: string; created_at?: string };
        Update: Partial<BlockedUserRow>;
        Relationships: [];
      };
      reports: {
        Row: ReportRow;
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: ReportTargetType;
          target_id: string;
          reason: ReportReason;
          details?: string | null;
          created_at?: string;
        };
        Update: Partial<ReportRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/** The single documented cast at the moderation boundary (same rule as
 *  events.service.ts's asGeneratedInsert): widen through `unknown` here —
 *  and ONLY here — until `supabase gen types` knows the new tables. */
const moderationDb = supabase as unknown as SupabaseClient<ModerationDatabase>;

/** Does this error mean "the table doesn't exist yet"? PostgREST reports a
 *  table missing from its schema cache as PGRST205 ("Could not find the
 *  table 'public.blocked_users' in the schema cache") and raw Postgres as
 *  42P01 ("relation \"blocked_users\" does not exist"). The message checks
 *  cover proxies/older PostgREST versions that reword but keep the phrases. */
function isMissingTableError(error: { code?: string; message?: string }): boolean {
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const msg = (error.message ?? '').toLowerCase();
  return msg.includes('does not exist') || msg.includes('schema cache');
}

/** Block a user. Idempotent: blocking someone already blocked succeeds. */
export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await moderationDb
    .from('blocked_users')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (!error) return;
  if (error.code === '23505') return; // unique_violation — already blocked
  if (isMissingTableError(error)) throw new ModerationUnavailableError();
  throw error;
}

/** Unblock a user. Deleting a non-existent block is a silent no-op. */
export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await moderationDb
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (!error) return;
  if (isMissingTableError(error)) throw new ModerationUnavailableError();
  throw error;
}

/** All profile ids this user has blocked. AppContext hydrates its
 *  `blockedIds` Set from this — cheap id-only select. Returns [] when the
 *  table doesn't exist yet (nothing can have been blocked). */
export async function getBlockedIds(userId: string): Promise<string[]> {
  const { data, error } = await moderationDb
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', userId);
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => r.blocked_id);
}

/** Has `userId` blocked `otherId`? One-directional by design. */
export async function isBlocked(userId: string, otherId: string): Promise<boolean> {
  const { data, error } = await moderationDb
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', userId)
    .eq('blocked_id', otherId)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return false;
    throw error;
  }
  return data !== null;
}

/** File a report. Moderators review via the Supabase dashboard for v1. */
export async function submitReport(reporterId: string, report: ReportInput): Promise<void> {
  const details = report.details?.trim();
  const { error } = await moderationDb.from('reports').insert({
    reporter_id: reporterId,
    target_type: report.targetType,
    target_id: report.targetId,
    reason: report.reason,
    details: details ? details : null,
  });
  if (!error) return;
  if (isMissingTableError(error)) throw new ModerationUnavailableError();
  throw error;
}
