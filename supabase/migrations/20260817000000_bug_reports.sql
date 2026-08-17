-- ───────────────────────────────────────────────────────────────
-- Designer bug reports — one pipe, three inlets (design doc
-- "Sphaer Bug System — 2026-08-17"). This migration lands inlet
-- infrastructure only: the `bug_reports` table, the server-set
-- `profiles.is_designer` flag, and a private `bug-screenshots`
-- Storage bucket. The triage view / auto-drafted fix prompts are
-- the NEXT phase — `status` + `fix_prompt` exist now so that phase
-- needs no further migration.
--
-- AUTHORED ONLY — review, then apply with `npx supabase db push`.
-- The client ships ahead of this migration and degrades gracefully:
-- bugReport.service.ts detects the missing table/column/bucket and
-- hides the entry point (is_designer reads as false), while writes
-- surface a typed BugReportUnavailableError.
--
-- Writers:
--   * designers in-app (authenticated role, RLS below)
--   * Tina via Supabase REST with the service role key (RLS-exempt)
-- Status changes come ONLY from triage with the service role — no
-- client UPDATE/DELETE policies exist, deliberately.
-- ───────────────────────────────────────────────────────────────

-- 1. profiles.is_designer — server-set flag. Designers (Aidan, Lara,
--    Rabon) are flagged in the DB by hand / service role; the client is
--    NEVER trusted to set it. profiles has an update-own RLS policy, so
--    without the trigger below any user could self-flag — the trigger
--    rejects changes from requests that carry an authenticated uid
--    (end-user traffic) while leaving service-role and dashboard SQL
--    (no auth.uid()) free to flip it.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_designer BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.prevent_client_is_designer_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_designer IS DISTINCT FROM OLD.is_designer
     AND (SELECT auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'is_designer is server-set and cannot be changed from the client';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_is_designer ON public.profiles;
CREATE TRIGGER protect_is_designer
  BEFORE UPDATE OF is_designer ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_is_designer_change();

-- 2. bug_reports — the single source of truth for all three inlets.
--    Pipeline: new → awaiting_ok → approved → fixed (rejected keeps
--    its reason in status_reason). fix_prompt is drafted by the next
--    phase; both columns exist now so triage ships without a migration.
--    reporter is NULLABLE on purpose: inlet 1 is Tina writing through the
--    service role from Telegram, where there is no app user — NULL means
--    "filed by Tina/Aidan from outside the app". Client inserts can never
--    be NULL: the RLS WITH CHECK requires auth.uid() = reporter, and
--    auth.uid() = NULL is never true.
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  screen TEXT,
  app_version TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'awaiting_ok', 'approved', 'rejected', 'fixed')),
  status_reason TEXT,
  fix_prompt TEXT,
  screenshot_path TEXT,          -- path inside the bug-screenshots bucket
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Fail closed:
--   INSERT — only as yourself, only if your profile is flagged
--            is_designer, and only in the initial 'new' status (a
--            client must not be able to file a pre-approved report).
--   SELECT — reporters see their own reports.
--   UPDATE/DELETE — no policies at all; the triage tooling uses the
--            service role, which bypasses RLS.
-- ANY SIGNED-IN USER MAY REPORT A BUG.
--
-- Changed before this migration was ever applied (2026-08-17, Aidan): "why
-- don't we make it that anyone can report a bug or suggest a change right now?
-- We are just testing." Correct for now -- while the userbase is Aidan, Lara
-- and Rabon, a per-account flag buys nothing and costs a manual SQL step per
-- person, which is friction on the exact people whose feedback we want.
--
-- The `profiles.is_designer` column is KEPT even though nothing gates on it
-- any more. Re-tightening later is then one policy, not a schema change --
-- add back `AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND
-- p.is_designer)` below. Worth doing before real users arrive, because an
-- open insert with no rate limit is a spam surface once the app is public.
--
-- Still enforced: you can only file AS yourself, and only at status 'new' --
-- so nobody can forge another user's report or self-approve one.
DROP POLICY IF EXISTS "bug_reports_insert_designer" ON public.bug_reports;
DROP POLICY IF EXISTS "bug_reports_insert_any_user" ON public.bug_reports;
CREATE POLICY "bug_reports_insert_any_user" ON public.bug_reports
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = reporter
    AND status = 'new'
  );

DROP POLICY IF EXISTS "bug_reports_select_own" ON public.bug_reports;
CREATE POLICY "bug_reports_select_own" ON public.bug_reports
  FOR SELECT USING ((SELECT auth.uid()) = reporter);

-- Covering index for the reporter FK (profile-delete CASCADE path).
CREATE INDEX IF NOT EXISTS bug_reports_reporter_idx
  ON public.bug_reports (reporter);

-- Triage reads by pipeline stage, newest first.
CREATE INDEX IF NOT EXISTS bug_reports_status_idx
  ON public.bug_reports (status, created_at DESC);

-- Keep updated_at honest on every (service-role) status change.
CREATE OR REPLACE FUNCTION public.bug_reports_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bug_reports_set_updated_at ON public.bug_reports;
CREATE TRIGGER bug_reports_set_updated_at
  BEFORE UPDATE ON public.bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.bug_reports_touch_updated_at();

-- 3. Storage: bug-screenshots bucket. PRIVATE (public = FALSE) —
--    screenshots of a logged-in session can contain DMs / personal
--    data; triage reads them with the service role, reporters via
--    the owner-folder SELECT policy below. MIME allowlist + 10 MB
--    cap mirror 20260612050000_storage_image_mime_limits.sql exactly
--    (including the non-standard 'image/jpg' some RN pickers emit).
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'bug-screenshots',
  'bug-screenshots',
  FALSE,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/gif'
  ],
  10485760  -- 10 MB, matches MAX_UPLOAD_BYTES client-side
)
ON CONFLICT (id) DO UPDATE
  SET allowed_mime_types = EXCLUDED.allowed_mime_types,
      file_size_limit    = EXCLUDED.file_size_limit,
      public             = EXCLUDED.public;

-- Path scheme: <user_id>/<filename> (same convention as every other
-- bucket). Only flagged designers may write, only into their own
-- folder; reporters can read back their own screenshots. No client
-- UPDATE/DELETE — a filed screenshot is immutable, like the report.
DROP POLICY IF EXISTS "bug_screenshots_insert" ON storage.objects;
CREATE POLICY "bug_screenshots_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'bug-screenshots'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_designer
  )
);

DROP POLICY IF EXISTS "bug_screenshots_read_own" ON storage.objects;
CREATE POLICY "bug_screenshots_read_own" ON storage.objects FOR SELECT USING (
  bucket_id = 'bug-screenshots'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- AUTHORED 2026-08-17, NOT APPLIED. Aidan applies with
-- `npx supabase db push`, then regenerates src/types/supabase.ts
-- (which replaces the hand-written src/types/bug-reports.ts shims),
-- then flags the three designer accounts:
--   UPDATE public.profiles SET is_designer = TRUE
--   WHERE id IN ('<aidan-uuid>', '<lara-uuid>', '<rabon-uuid>');
