-- ───────────────────────────────────────────────────────────────
-- Reports v2 — "not everything we want to add is a bug" (Aidan,
-- 2026-08-17). Two changes on top of 20260817000000_bug_reports.sql:
--
--   1. A `kind` (bug | feature | change) and the per-kind structured
--      answers behind it, so triage reads FIELDS, not one prose blob.
--   2. RLS for an IN-APP triage screen. The first migration deliberately
--      shipped no UPDATE policy and only select-own, because triage was
--      assumed to run with the service role. It doesn't any more:
--      `profiles.is_designer` — until now a flag that gated nothing —
--      becomes the ADMIN gate. Reporting stays open to every signed-in
--      user; that insert policy is untouched below.
--
-- ⚠️ DO NOT APPLY WITH `supabase db push`. Local and remote migration
-- history have completely diverged (22 local never applied, 17 remote with
-- no local file, ZERO in sync) — a push replays five months of schema onto
-- production. 20260817000000 is ALREADY LIVE on dgxmesiouwajazyhbhkn and
-- must not be re-edited. This file is applied by hand:
--     npx supabase db query --linked --file \
--       supabase/migrations/20260817120000_bug_reports_kind_and_triage.sql
-- Every statement is idempotent (IF NOT EXISTS / OR REPLACE / DROP IF
-- EXISTS), so a re-run or an interrupted paste is safe.
--
-- ───────────────────────────────────────────────────────────────
-- WHY DISCRETE COLUMNS *AND* A JSONB BLOB — the choice the brief asked
-- to be justified. The split is drawn on one line: does triage QUERY it,
-- or only DISPLAY it?
--
--   * `kind` and `severity` are discrete, CHECK-constrained columns.
--     Triage filters and sorts by them and the filter chips must not be
--     able to drift into free text ('Bug' vs 'bug' vs 'buggy'). A CHECK
--     constraint and a real index are only available to a real column,
--     and `kind` in particular is now part of every list query's WHERE.
--
--   * The per-kind prose answers (expected behaviour, repro steps,
--     proposed solution, who it's for, why) live in a `details` JSONB.
--     The QUESTION SET differs per kind and will keep changing as we
--     learn what makes a report actionable — five nullable columns of
--     which three are always NULL is a worse table, and adding a fourth
--     kind or a sixth question would then mean a migration + an app
--     release in lockstep on a production database we can only touch by
--     hand. These fields are read back and rendered; they are never
--     filtered, joined, or aggregated, so JSONB costs nothing here.
--
--   * The PRIMARY answer of each kind (what happened / what problem does
--     this solve / what should change) keeps going into the existing
--     NOT NULL `description`. That is deliberate back-compat: the 'new'
--     rows already live, Tina's Telegram inlet (inlet 1, service role)
--     writes `description` and nothing else, and every consumer is
--     guaranteed one canonical human-readable line whatever the kind.
-- ───────────────────────────────────────────────────────────────

-- ── 1. kind ──────────────────────────────────────────────────────────
-- DEFAULT 'bug' backfills every existing row as a bug, which is what
-- they are: the column did not exist when they were filed.
ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'bug';

ALTER TABLE public.bug_reports
  DROP CONSTRAINT IF EXISTS bug_reports_kind_check;
ALTER TABLE public.bug_reports
  ADD CONSTRAINT bug_reports_kind_check
  CHECK (kind IN ('bug', 'feature', 'change'));

-- ── 2. severity (bug-only, hence nullable) ───────────────────────────
-- NULL means "not stated" and is valid for every kind: a feature request
-- has no severity, and forcing a reporter to rate their own bug before
-- they may file it is friction on the one thing we want more of.
ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS severity TEXT;

ALTER TABLE public.bug_reports
  DROP CONSTRAINT IF EXISTS bug_reports_severity_check;
ALTER TABLE public.bug_reports
  ADD CONSTRAINT bug_reports_severity_check
  CHECK (severity IS NULL OR severity IN ('blocker', 'annoying', 'cosmetic'));

-- ── 3. details — the per-kind structured answers ─────────────────────
-- Shape by kind (keys omitted when the reporter left them blank):
--   bug     → { expected, steps }
--   feature → { solution, audience }
--   change  → { why }
-- An object, never an array or scalar — the CHECK keeps it that way so
-- the client can index into it without defensive typeof checks.
ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.bug_reports
  DROP CONSTRAINT IF EXISTS bug_reports_details_object_check;
ALTER TABLE public.bug_reports
  ADD CONSTRAINT bug_reports_details_object_check
  CHECK (jsonb_typeof(details) = 'object');

-- ── 4. triage_note — Aidan's working note on a report ────────────────
-- Distinct from `status_reason` (which is the REJECTION reason shown
-- back to the reporter) and from `fix_prompt` (the drafted build
-- prompt). This is the scratchpad: "dupe of the mural one", "needs a
-- design call first".
ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS triage_note TEXT;

-- Triage's default query is "newest first, optionally filtered by
-- status and kind" — index that shape.
CREATE INDEX IF NOT EXISTS bug_reports_kind_status_idx
  ON public.bug_reports (kind, status, created_at DESC);

-- ── 5. The admin gate ────────────────────────────────────────────────
-- A STABLE SECURITY DEFINER helper rather than an inline
-- `EXISTS (SELECT 1 FROM profiles …)` in each policy, for two reasons:
--   * it evaluates once per statement instead of once per row, and
--   * it does not depend on `profiles_read_all` staying `USING (true)`.
--     If profiles is ever locked down, an inline subquery would silently
--     start returning no rows and the triage screen would go blank with
--     no error — a policy that fails OPEN on a read is bad, but one that
--     fails silently CLOSED on the admin surface is a support ticket
--     nobody can diagnose.
-- It leaks nothing: it answers exactly one question about the CALLER.
CREATE OR REPLACE FUNCTION public.current_user_is_designer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT p.is_designer FROM public.profiles p WHERE p.id = (SELECT auth.uid())),
    FALSE
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_designer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_designer() TO authenticated, service_role;

-- SELECT: designers see everything. Policies are OR'd, so
-- `bug_reports_select_own` from the first migration still governs
-- everyone else — a normal user reads their own reports and NOTHING
-- else, exactly as before. No policy is loosened here.
DROP POLICY IF EXISTS "bug_reports_select_designer" ON public.bug_reports;
CREATE POLICY "bug_reports_select_designer" ON public.bug_reports
  FOR SELECT USING (public.current_user_is_designer());

-- UPDATE: designers only. There is no update-own policy and there must
-- never be one — that is the rule that stops a reporter approving their
-- own report. A non-designer has no UPDATE path to this table at all.
--
-- ⚠️ A designer CAN triage a report they filed themselves. That is the
-- primary workflow, not a hole: Aidan is both the main reporter and the
-- only triager, and blocking self-triage would leave most of the queue
-- permanently unactionable. The protection that matters — "a USER cannot
-- approve their own report" — is delivered by there being no update path
-- for users at all.
DROP POLICY IF EXISTS "bug_reports_update_designer" ON public.bug_reports;
CREATE POLICY "bug_reports_update_designer" ON public.bug_reports
  FOR UPDATE
  USING (public.current_user_is_designer())
  WITH CHECK (public.current_user_is_designer());

-- Column-level privileges narrow that UPDATE to the triage fields.
-- RLS cannot express "may change status but not description"; grants
-- can. Without this, a designer account (or anything that got hold of
-- one) could silently rewrite the reporter's own words, or re-point
-- `reporter` at somebody else. service_role and the table owner are
-- unaffected — this revokes from `authenticated` only.
REVOKE UPDATE ON public.bug_reports FROM authenticated;
GRANT UPDATE (status, status_reason, triage_note, fix_prompt)
  ON public.bug_reports TO authenticated;

-- Screenshots: triage has to see the picture. Reporters keep
-- `bug_screenshots_read_own`; this adds designers. Still no client
-- UPDATE/DELETE on storage objects — a filed screenshot is immutable.
DROP POLICY IF EXISTS "bug_screenshots_read_designer" ON storage.objects;
CREATE POLICY "bug_screenshots_read_designer" ON storage.objects FOR SELECT USING (
  bucket_id = 'bug-screenshots'
  AND public.current_user_is_designer()
);

-- ───────────────────────────────────────────────────────────────
-- ⚠️ NOTHING IN THE TRIAGE SCREEN IS REACHABLE UNTIL A DESIGNER EXISTS.
-- `profiles.is_designer` is FALSE on all 41 accounts including Aidan's,
-- and the `protect_is_designer` trigger from the first migration blocks
-- any client-side change — deliberately. Run this ONCE, by hand, in the
-- Supabase SQL editor (no auth.uid() there, so the trigger allows it):
--
--   update public.profiles
--      set is_designer = true
--    where id = (select id from auth.users
--                 where email = 'herstikaidan@gmail.com');
--
-- Until then the triage row does not render and the route is a dead end
-- for everybody, which is the correct fail-closed behaviour.
-- ───────────────────────────────────────────────────────────────
