-- ───────────────────────────────────────────────────────────────
-- Rolling-window rate limiting on hot write paths
--
-- Why: messages / follows (and reports, once that table lands) are the
-- cheapest spam vectors in the app — a hostile client can bypass any UI
-- throttle and hammer PostgREST directly. This adds a server-side,
-- per-user rolling-window limiter enforced by BEFORE INSERT triggers, so
-- it holds no matter what client hits the API.
--
-- Design notes:
--   * Best-effort, not exact: two concurrent inserts can both pass the
--     count check and land 1 row over the limit. Fine for abuse
--     throttling; we are not doing billing-grade accounting.
--   * The log row is written in the same transaction as the guarded
--     INSERT, so a write that later fails (RLS WITH CHECK, FK, CHECK
--     constraint) rolls its log row back too — quota is only consumed
--     by writes that commit.
--   * Identity is `auth.uid()`, not the row's user column. RLS already
--     pins sender_id / follower_id to auth.uid() on these tables, and
--     using auth.uid() lets us skip throttling entirely when it is NULL
--     (service-role jobs, seeds, migrations) — triggers still fire for
--     those callers even though RLS does not apply.
-- ───────────────────────────────────────────────────────────────

-- ── Log table ────────────────────────────────────────────────────────────
-- Append-only metering log; rows are never updated, so no PK needed.
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  user_id    UUID        NOT NULL,
  action     TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Serves the hot query: COUNT(*) WHERE user_id = ? AND action = ?
-- AND created_at > now() - window  →  single index range scan.
CREATE INDEX IF NOT EXISTS rate_limit_log_user_action_created_idx
  ON public.rate_limit_log (user_id, action, created_at);

-- RLS on, zero policies = deny-all for anon/authenticated. Only the
-- SECURITY DEFINER functions below touch this table: they run as the
-- function owner (postgres, who also owns the table), and a table's
-- owner bypasses RLS unless FORCE ROW LEVEL SECURITY is set — so the
-- definer inserts/deletes work without any policy.
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Belt and braces on top of the deny-all RLS: client roles get no
-- direct privileges at all (Supabase default-grants would otherwise
-- hand them table privileges that RLS then has to filter).
REVOKE ALL ON TABLE public.rate_limit_log FROM PUBLIC, anon, authenticated;

-- ── Cleanup ──────────────────────────────────────────────────────────────
-- Chosen approach: opportunistic pruning from inside check_rate_limit
-- (~1 in 1000 calls, see below) instead of pg_cron. Rationale: no
-- extension dependency (works identically on local CLI and hosted),
-- and cleanup frequency scales with write traffic — quiet table, no
-- wasted wakeups; busy table, frequent pruning. The function is kept
-- standalone + idempotent so it can ALSO be wired to pg_cron later
-- (e.g. SELECT cron.schedule('prune-rate-limit', '0 4 * * *',
-- $$SELECT public.prune_rate_limit_log()$$)) without changes.
CREATE OR REPLACE FUNCTION public.prune_rate_limit_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- 24 h retention: the widest window any caller uses is 1 hour, so
  -- anything older than a day can never influence a count again.
  DELETE FROM public.rate_limit_log
  WHERE created_at < NOW() - INTERVAL '24 hours';
$$;

-- ── Core check ───────────────────────────────────────────────────────────
-- Counts the caller's actions inside the rolling window; raises a
-- user-presentable 'rate_limit_exceeded: ...' error when over the limit,
-- otherwise records this action. Callable only from the definer trigger
-- functions below (EXECUTE is revoked from client roles — see note).
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user   UUID,
  p_action TEXT,
  p_limit  INT,
  p_window INTERVAL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count        INT;
  v_window_label TEXT;
BEGIN
  -- NULL = service-role / system path; nothing to meter.
  IF p_user IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_log
  WHERE user_id = p_user
    AND action = p_action
    AND created_at > NOW() - p_window;

  IF v_count >= p_limit THEN
    v_window_label := CASE
      WHEN p_window = INTERVAL '1 minute' THEN 'minute'
      WHEN p_window = INTERVAL '1 hour'   THEN 'hour'
      WHEN p_window = INTERVAL '1 day'    THEN 'day'
      ELSE p_window::TEXT
    END;
    -- Surfaced verbatim as `error.message` by PostgREST / supabase-js,
    -- so keep it human-readable. The stable 'rate_limit_exceeded:'
    -- prefix lets the client special-case it if it ever wants to.
    RAISE EXCEPTION
      'rate_limit_exceeded: you''re doing that a little too fast — the limit is % per %. Please wait a moment and try again.',
      p_limit, v_window_label
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.rate_limit_log (user_id, action)
  VALUES (p_user, p_action);

  -- Opportunistic cleanup: ~1 in 1000 writes pays a small DELETE on the
  -- way through (index-assisted, bounded by 24 h retention). See the
  -- rationale on prune_rate_limit_log above.
  IF random() < 0.001 THEN
    PERFORM public.prune_rate_limit_log();
  END IF;
END;
$$;

-- Critical: functions default to EXECUTE for PUBLIC. If a client could
-- call check_rate_limit directly via RPC it could forge log rows for an
-- arbitrary p_user and rate-limit-DoS another account. Definer trigger
-- functions below still work — inside them the privilege check runs as
-- the owner. prune stays callable by service_role for future cron /
-- edge-function wiring.
REVOKE ALL ON FUNCTION public.check_rate_limit(UUID, TEXT, INT, INTERVAL) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_rate_limit_log() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_rate_limit_log() TO service_role;

-- ── Per-table trigger functions ──────────────────────────────────────────
-- (RETURNS trigger functions cannot be invoked over RPC, so no revoke
-- needed on these.)

-- messages: 30 per minute. Covers DMs + circle chats + event chats
-- combined (one counter per sender) — generous enough for fast typers
-- in a busy group chat, far below scripted-spam volume.
CREATE OR REPLACE FUNCTION public.rate_limit_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service-role / seed path: never throttled
  END IF;
  PERFORM public.check_rate_limit(auth.uid(), 'message_insert', 30, INTERVAL '1 minute');
  RETURN NEW;
END;
$$;

-- follows: 60 per hour. A human curating their network never hits
-- this; a follow-spam bot (or a follow/unfollow churn loop trying to
-- farm notifications) does.
CREATE OR REPLACE FUNCTION public.rate_limit_follows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM public.check_rate_limit(auth.uid(), 'follow_insert', 60, INTERVAL '1 hour');
  RETURN NEW;
END;
$$;

-- reports: 10 per hour. Reporting is a rare, deliberate act; the abuse
-- vector is mass-flagging someone else's content. Function is created
-- unconditionally (it only reads auth.uid(), no reports columns), the
-- trigger conditionally below.
CREATE OR REPLACE FUNCTION public.rate_limit_reports()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM public.check_rate_limit(auth.uid(), 'report_insert', 10, INTERVAL '1 hour');
  RETURN NEW;
END;
$$;

-- ── Triggers ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS messages_rate_limit_before_insert ON public.messages;
CREATE TRIGGER messages_rate_limit_before_insert
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.rate_limit_messages();

DROP TRIGGER IF EXISTS follows_rate_limit_before_insert ON public.follows;
CREATE TRIGGER follows_rate_limit_before_insert
  BEFORE INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.rate_limit_follows();

-- reports lands in sibling migration 20260612020000 (sorts before this
-- file, so in a combined `db push` the table exists by the time this
-- runs). If the reports migration ships in a LATER push instead, this
-- block no-ops with a NOTICE — re-run it (or add the trigger in that
-- migration) at that point.
DO $do$
BEGIN
  IF to_regclass('public.reports') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS reports_rate_limit_before_insert ON public.reports';
    EXECUTE 'CREATE TRIGGER reports_rate_limit_before_insert
               BEFORE INSERT ON public.reports
               FOR EACH ROW
               EXECUTE FUNCTION public.rate_limit_reports()';
  ELSE
    RAISE NOTICE 'rate_limiting: public.reports does not exist yet — skipped its trigger. Re-run the DO block in 20260612030000 after the reports table lands.';
  END IF;
END
$do$;

-- Deliberately NO rate-limit trigger on public.notifications: its rows
-- are produced by SECURITY DEFINER triggers (see 20260612040000), and
-- a circle_event fan-out legitimately inserts one row per follower in
-- a single statement. Throttling that table would break system fan-out,
-- not stop any user-driven abuse (clients can't insert arbitrary
-- notifications anyway — RLS pins user_id to auth.uid()).

-- AUTHORED 2026-06-12, NOT APPLIED. Apply with `npx supabase db push`,
-- then regenerate src/types/supabase.ts.
