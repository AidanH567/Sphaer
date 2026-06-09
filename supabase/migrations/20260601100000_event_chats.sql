-- Event group chats: every event gets an implicit chat that registered
-- attendees + the creator can read and write. Mirrors the DM/circle pattern
-- already on the messages table.
--
-- See: design grilling for event chats — full live realtime via per-event
-- channels managed by MessagesContext on the client.

-- 1. Add event_id column and replace the CHECK constraint to allow exactly
--    one of (recipient_id, circle_id, event_id) being non-null.
ALTER TABLE messages
  ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE CASCADE;

ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_target_check CHECK (
    (recipient_id IS NOT NULL AND circle_id IS NULL AND event_id IS NULL) OR
    (recipient_id IS NULL AND circle_id IS NOT NULL AND event_id IS NULL) OR
    (recipient_id IS NULL AND circle_id IS NULL AND event_id IS NOT NULL)
  );

-- 2. Index for event chat lookups + ordering.
CREATE INDEX messages_event_created_idx
  ON messages(event_id, created_at DESC)
  WHERE event_id IS NOT NULL;

-- 3. Rebuild messages RLS with event-chat support. While we're here, tighten
--    the insert policy: previously anyone could insert into any circle (read
--    was already gated by membership; write wasn't). Now circle/event inserts
--    require membership too.
DROP POLICY IF EXISTS "messages_read" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;

CREATE POLICY "messages_read" ON messages
  FOR SELECT USING (
    (SELECT auth.uid()) = sender_id
    OR (SELECT auth.uid()) = recipient_id
    OR (
      circle_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM circle_members cm
        WHERE cm.circle_id = messages.circle_id AND cm.user_id = (SELECT auth.uid())
      )
    )
    OR (
      event_id IS NOT NULL AND (
        EXISTS (
          SELECT 1 FROM event_registrations r
          WHERE r.event_id = messages.event_id AND r.user_id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM events e
          WHERE e.id = messages.event_id AND e.creator_id = (SELECT auth.uid())
        )
      )
    )
  );

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = sender_id
    AND (
      -- DM: still permissive, anyone can DM anyone
      recipient_id IS NOT NULL
      OR (
        circle_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM circle_members cm
          WHERE cm.circle_id = messages.circle_id AND cm.user_id = (SELECT auth.uid())
        )
      )
      OR (
        event_id IS NOT NULL AND (
          EXISTS (
            SELECT 1 FROM event_registrations r
            WHERE r.event_id = messages.event_id AND r.user_id = (SELECT auth.uid())
          )
          OR EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = messages.event_id AND e.creator_id = (SELECT auth.uid())
          )
        )
      )
    )
  );

-- 4. Per-(user, event) last-read pointer. Unlike direct_message_reads there's
--    no "partner" concept — each member's read state is private and only
--    readable by themselves.
CREATE TABLE event_message_reads (
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  event_id     UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX event_message_reads_event_idx ON event_message_reads(event_id);

ALTER TABLE event_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_message_reads_select" ON event_message_reads
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "event_message_reads_insert_own" ON event_message_reads
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "event_message_reads_update_own" ON event_message_reads
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

-- 5. Realtime publication for event_message_reads + event_registrations.
--    event_registrations is added so MessagesContext can detect register/
--    unregister and reconcile its per-event channels.
ALTER PUBLICATION supabase_realtime ADD TABLE event_message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE event_registrations;

-- 6. Extend get_conversations to be polymorphic: returns both DMs and event
--    chats. Event chats appear even when empty (registered or creator, no
--    messages yet) so newly-joined events show up immediately.
DROP FUNCTION IF EXISTS get_conversations(UUID);

CREATE FUNCTION get_conversations(p_user_id UUID)
RETURNS TABLE (
  kind         TEXT,
  partner_id   UUID,
  partner      JSONB,
  last_message JSONB,
  unread_count BIGINT,
  sort_at      TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH dms AS (
    SELECT
      CASE WHEN sender_id = p_user_id THEN recipient_id ELSE sender_id END AS partner_id,
      id, sender_id, recipient_id, content, created_at
    FROM messages
    WHERE event_id IS NULL AND circle_id IS NULL
      AND (sender_id = p_user_id OR recipient_id = p_user_id)
  ),
  dm_last AS (
    SELECT DISTINCT ON (partner_id)
      partner_id, id, sender_id, recipient_id, content, created_at
    FROM dms
    ORDER BY partner_id, created_at DESC
  ),
  dm_unread AS (
    SELECT m.sender_id AS partner_id, COUNT(*)::BIGINT AS n
    FROM messages m
    LEFT JOIN direct_message_reads r
      ON r.user_id = p_user_id AND r.partner_id = m.sender_id
    WHERE m.recipient_id = p_user_id
      AND m.event_id IS NULL AND m.circle_id IS NULL
      AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
    GROUP BY m.sender_id
  ),
  -- Events the user is in: registered (covers creators via the
  -- register-creator-on-event-insert trigger) OR creator directly (defense
  -- in depth in case the trigger ever doesn't fire).
  user_events AS (
    SELECT DISTINCT e.*
    FROM events e
    WHERE EXISTS (
      SELECT 1 FROM event_registrations r
      WHERE r.event_id = e.id AND r.user_id = p_user_id
    ) OR e.creator_id = p_user_id
  ),
  event_last AS (
    SELECT DISTINCT ON (m.event_id)
      m.event_id, m.id, m.sender_id, m.content, m.created_at
    FROM messages m
    WHERE m.event_id IN (SELECT id FROM user_events)
    ORDER BY m.event_id, m.created_at DESC
  ),
  event_unread AS (
    SELECT m.event_id, COUNT(*)::BIGINT AS n
    FROM messages m
    LEFT JOIN event_message_reads r
      ON r.user_id = p_user_id AND r.event_id = m.event_id
    WHERE m.event_id IN (SELECT id FROM user_events)
      AND m.sender_id <> p_user_id
      AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
    GROUP BY m.event_id
  )
  SELECT
    'dm' AS kind,
    dl.partner_id,
    to_jsonb(p.*) AS partner,
    jsonb_build_object(
      'id', dl.id,
      'sender_id', dl.sender_id,
      'recipient_id', dl.recipient_id,
      'circle_id', NULL,
      'event_id', NULL,
      'content', dl.content,
      'created_at', dl.created_at
    ) AS last_message,
    COALESCE(du.n, 0)::BIGINT AS unread_count,
    dl.created_at AS sort_at
  FROM dm_last dl
  JOIN profiles p ON p.id = dl.partner_id
  LEFT JOIN dm_unread du ON du.partner_id = dl.partner_id

  UNION ALL

  SELECT
    'event' AS kind,
    ue.id AS partner_id,
    to_jsonb(ue.*) AS partner,
    CASE WHEN el.id IS NOT NULL THEN
      jsonb_build_object(
        'id', el.id,
        'sender_id', el.sender_id,
        'recipient_id', NULL,
        'circle_id', NULL,
        'event_id', el.event_id,
        'content', el.content,
        'created_at', el.created_at
      )
    ELSE NULL END AS last_message,
    COALESCE(eu.n, 0)::BIGINT AS unread_count,
    -- Empty event chats fall back to the event's created_at so they still
    -- sort sanely against DMs and non-empty event chats.
    COALESCE(el.created_at, ue.created_at) AS sort_at
  FROM user_events ue
  LEFT JOIN event_last el ON el.event_id = ue.id
  LEFT JOIN event_unread eu ON eu.event_id = ue.id

  ORDER BY sort_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION get_conversations(UUID) TO authenticated;
