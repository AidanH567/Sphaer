-- ───────────────────────────────────────────────────────────────
-- Report & block — UGC moderation (App Store Guideline 1.2)
--
-- AUTHORED ONLY — review, then apply with `npx supabase db push`.
-- The client ships ahead of this migration and degrades gracefully:
-- moderation.service.ts detects the missing tables (42P01 / PGRST205 /
-- "schema cache") and returns empty reads, while writes surface a typed
-- ModerationUnavailableError ("available after the next app update").
--
-- v1 review workflow: moderators triage `reports` rows directly in the
-- Supabase dashboard (Table Editor / SQL, service role bypasses RLS).
-- No moderator role or in-app admin UI ships with this migration —
-- under RLS, reporters can only ever see their own reports.
-- ───────────────────────────────────────────────────────────────

-- 1. blocked_users — one row per (blocker → blocked) pair. Blocking is
--    one-directional and client-enforced for v1: the app filters the
--    blocked user's events, conversations, and chat messages out of the
--    blocker's UI. Server-side filtering (RLS on events/messages) is a
--    deliberate non-goal until the moderation backend matures.
CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Blocker manages and reads only their own block list. Deliberately no
-- SELECT for the blocked side — users must not be able to discover who
-- blocked them. auth.uid() wrapped in (SELECT ...) so it's evaluated once
-- per query, not per row (matches direct_message_reads policies).
DROP POLICY IF EXISTS "blocked_users_select_own" ON public.blocked_users;
CREATE POLICY "blocked_users_select_own" ON public.blocked_users
  FOR SELECT USING ((SELECT auth.uid()) = blocker_id);

DROP POLICY IF EXISTS "blocked_users_insert_own" ON public.blocked_users;
CREATE POLICY "blocked_users_insert_own" ON public.blocked_users
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = blocker_id);

DROP POLICY IF EXISTS "blocked_users_delete_own" ON public.blocked_users;
CREATE POLICY "blocked_users_delete_own" ON public.blocked_users
  FOR DELETE USING ((SELECT auth.uid()) = blocker_id);

-- Covering index for the blocked_id FK — without it, deleting a profile
-- seq-scans blocked_users for the CASCADE.
CREATE INDEX IF NOT EXISTS blocked_users_blocked_idx
  ON public.blocked_users (blocked_id);

-- 2. reports — user-submitted reports against any moderatable surface.
--    target_id is intentionally NOT a foreign key: it points at events,
--    circles, profiles, or messages depending on target_type, and a report
--    must survive the reported content being deleted by its author.
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('event', 'circle', 'profile', 'message')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'scam', 'other')),
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Reporters can file reports as themselves and review what they filed.
-- No UPDATE/DELETE policies: a submitted report is immutable from the
-- client; only moderators (service role, RLS-exempt) act on it.
DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = reporter_id);

DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT USING ((SELECT auth.uid()) = reporter_id);

-- Moderation triage: "show me everything reported about X" groups by target.
CREATE INDEX IF NOT EXISTS reports_target_idx
  ON public.reports (target_type, target_id);

-- Covering index for the reporter_id FK (profile-delete CASCADE path).
CREATE INDEX IF NOT EXISTS reports_reporter_idx
  ON public.reports (reporter_id);
