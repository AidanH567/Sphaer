-- ───────────────────────────────────────────────────────────────
-- Notification producers (the consumer screen already ships)
--
-- app/notifications.tsx + useNotifications.ts render and live-subscribe
-- to public.notifications, but nothing has ever WRITTEN rows. This adds
-- the trigger-driven producer half for three of the four types:
--
--   type            user_id (who is notified)   reference_id
--   'message'       DM recipient                sender's profile id
--   'follow'        the followed user           follower's profile id
--   'circle_event'  each circle follower        the new event's id
--
-- reference_id semantics are pinned by routeFor() in app/notifications.tsx:
--   'follow'        → /user/<reference_id>      (follower's profile)
--   'circle_event'  → /event/<reference_id>     (event detail)
--   'message'       → /messages/<reference_id>, and app/(tabs)/messages/
--                     [id].tsx reads that param as `partnerId` (the other
--                     user's profile id) — so reference_id MUST be the
--                     sender's id, NOT the message id.
--
-- 'event_reminder' is deliberately NOT produced here: per
-- 20260609000000_saved_events_reminder.sql it belongs to a scheduled
-- job that scans saved_events.reminder_at (P2, lands with push notifs).
--
-- All functions are SECURITY DEFINER: the notifications RLS policy
-- ("notifications_own" FOR ALL USING auth.uid() = user_id) means user A
-- can never insert a row for user B — correct for clients, fatal for
-- producers. Definer functions run as the table owner, which bypasses
-- RLS, so cross-user inserts work here and only here.
--
-- Interaction with 20260612030000 (rate limiting): rate limits are
-- BEFORE INSERT triggers on messages/follows; these producers are AFTER
-- INSERT on the same tables. Phases guarantee ordering: a rate-limited
-- insert aborts before any notification is written, and there is NO
-- rate-limit trigger on notifications itself, so the set-based
-- circle_event fan-out is never throttled.
-- ───────────────────────────────────────────────────────────────

-- ── Supporting indexes ───────────────────────────────────────────────────
-- notifications has only its PK today. The unread-dedupe lookups below
-- probe (user_id, type, reference_id, is_read=false) on every DM/follow,
-- and the consumer's badge counts unread per user — a partial index
-- covers both. The (user_id, created_at) index serves the screen's
-- "latest 50 for me" query.
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, type, reference_id)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

-- ── 1:1 message → 'message' notification ─────────────────────────────────
-- 1:1 rows only (recipient_id NOT NULL). Circle/event group messages do
-- NOT fan out in v1, for two reasons:
--   * volume — every group message × N members would dwarf all other
--     notification traffic (group chats already surface unread counts
--     via get_conversations);
--   * routing — routeFor('message') opens /messages/<reference_id>, a
--     DM conversation keyed by partner id. A circle/event message has
--     no valid value to put there; it would mis-route.
--
-- Dedupe: while the recipient already has an UNREAD 'message'
-- notification from this same sender, further messages don't add rows
-- (50 rapid texts ≠ 50 identical "You have a new message" entries).
-- Once it's read, the next message produces a fresh one. Drop the
-- NOT EXISTS clause if one-row-per-message is ever preferred.
CREATE OR REPLACE FUNCTION public.notify_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Guards duplicate the trigger's WHEN clause on purpose: the function
  -- stays correct even if the trigger is ever recreated without it.
  IF NEW.recipient_id IS NULL THEN
    RETURN NEW; -- circle/event chat: no fan-out in v1 (see header)
  END IF;
  IF NEW.recipient_id = NEW.sender_id THEN
    RETURN NEW; -- self-send: nothing to announce
  END IF;

  INSERT INTO public.notifications (user_id, type, reference_id, is_read)
  SELECT NEW.recipient_id, 'message', NEW.sender_id, FALSE
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = NEW.recipient_id
      AND n.type = 'message'
      AND n.reference_id = NEW.sender_id
      AND n.is_read = FALSE
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_notify_after_insert ON public.messages;
CREATE TRIGGER messages_notify_after_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  WHEN (NEW.recipient_id IS NOT NULL AND NEW.recipient_id IS DISTINCT FROM NEW.sender_id)
  EXECUTE FUNCTION public.notify_message_insert();

-- ── follow → 'follow' notification ───────────────────────────────────────
-- Notify the followed user; reference_id = follower, so tapping the row
-- opens the follower's profile (/user/<id>). Self-follows are blocked
-- by the follows CHECK constraint. Same unread-dedupe as messages so a
-- follow/unfollow churn loop can't stack identical rows (the rate
-- limiter caps the inserts; this caps the noise).
CREATE OR REPLACE FUNCTION public.notify_follow_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, reference_id, is_read)
  SELECT NEW.following_id, 'follow', NEW.follower_id, FALSE
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = NEW.following_id
      AND n.type = 'follow'
      AND n.reference_id = NEW.follower_id
      AND n.is_read = FALSE
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS follows_notify_after_insert ON public.follows;
CREATE TRIGGER follows_notify_after_insert
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_follow_insert();

-- ── circle event → 'circle_event' fan-out ────────────────────────────────
-- New event posted under a circle → one notification per follower of
-- that circle (circle_follows), excluding the event's creator. Single
-- set-based INSERT...SELECT — no per-row loop. reference_id = event id
-- (routeFor → /event/<id>). No dedupe needed: a fresh event id can't
-- collide with existing rows. Circle MEMBERS who don't follow the
-- circle are intentionally not included — followers are the opt-in
-- "tell me about new events" audience per the schema's intent; widening
-- to members ∪ followers is a product call for later.
CREATE OR REPLACE FUNCTION public.notify_circle_event_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.circle_id IS NULL THEN
    RETURN NEW; -- independent event: nobody to fan out to
  END IF;

  INSERT INTO public.notifications (user_id, type, reference_id, is_read)
  SELECT cf.user_id, 'circle_event', NEW.id, FALSE
  FROM public.circle_follows cf
  WHERE cf.circle_id = NEW.circle_id
    AND cf.user_id <> NEW.creator_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_notify_circle_after_insert ON public.events;
CREATE TRIGGER events_notify_circle_after_insert
  AFTER INSERT ON public.events
  FOR EACH ROW
  WHEN (NEW.circle_id IS NOT NULL)
  EXECUTE FUNCTION public.notify_circle_event_insert();

-- ── Realtime ─────────────────────────────────────────────────────────────
-- useNotifications.ts subscribes to postgres_changes INSERTs on
-- notifications, but no migration ever added the table to the
-- supabase_realtime publication (earlier migrations added messages,
-- *_message_reads, etc. — never notifications). Without this, the
-- producers above work but the badge only updates on refetch. Wrapped
-- so it stays idempotent if the table was already added via dashboard.
-- Realtime enforces RLS per subscriber, so each user only receives
-- their own rows ("notifications_own" policy).
DO $do$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'notification_producers: notifications already in supabase_realtime — skipped.';
  WHEN undefined_object THEN
    RAISE NOTICE 'notification_producers: supabase_realtime publication not found — add notifications to your realtime publication manually.';
END
$do$;

-- AUTHORED 2026-06-12, NOT APPLIED. Apply with `npx supabase db push`,
-- then regenerate src/types/supabase.ts.
