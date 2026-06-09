-- Wire up circle group chats. The `messages.circle_id` column + RLS already
-- exist; this migration adds the read-tracking table and folds circle chats
-- into the polymorphic get_conversations RPC.

-- 1. Per-(user, circle) last-read pointer (mirrors event_message_reads).
CREATE TABLE circle_message_reads (
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  circle_id    UUID REFERENCES circles(id) ON DELETE CASCADE NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, circle_id)
);

CREATE INDEX circle_message_reads_circle_idx ON circle_message_reads(circle_id);

ALTER TABLE circle_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "circle_message_reads_select" ON circle_message_reads
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "circle_message_reads_insert_own" ON circle_message_reads
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "circle_message_reads_update_own" ON circle_message_reads
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

-- 2. Realtime publication: circle_message_reads (for our own read state),
--    circle_members (so MessagesContext can detect join/leave and reconcile
--    its per-circle channels). messages is already published.
ALTER PUBLICATION supabase_realtime ADD TABLE circle_message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE circle_members;

-- 3. Replace get_conversations to also return circle chats. Now 3-way
--    polymorphic: kind in ('dm', 'event', 'circle').
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
  ),
  user_circles AS (
    -- Circles the user is a member of. Creator is auto-added by the
    -- add_circle_creator_as_admin trigger so members covers everyone.
    SELECT DISTINCT c.*
    FROM circles c
    WHERE EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = c.id AND cm.user_id = p_user_id
    )
  ),
  circle_last AS (
    SELECT DISTINCT ON (m.circle_id)
      m.circle_id, m.id, m.sender_id, m.content, m.created_at
    FROM messages m
    WHERE m.circle_id IN (SELECT id FROM user_circles)
    ORDER BY m.circle_id, m.created_at DESC
  ),
  circle_unread AS (
    SELECT m.circle_id, COUNT(*)::BIGINT AS n
    FROM messages m
    LEFT JOIN circle_message_reads r
      ON r.user_id = p_user_id AND r.circle_id = m.circle_id
    WHERE m.circle_id IN (SELECT id FROM user_circles)
      AND m.sender_id <> p_user_id
      AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
    GROUP BY m.circle_id
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
    COALESCE(el.created_at, ue.created_at) AS sort_at
  FROM user_events ue
  LEFT JOIN event_last el ON el.event_id = ue.id
  LEFT JOIN event_unread eu ON eu.event_id = ue.id

  UNION ALL

  SELECT
    'circle' AS kind,
    uc.id AS partner_id,
    to_jsonb(uc.*) AS partner,
    CASE WHEN cl.id IS NOT NULL THEN
      jsonb_build_object(
        'id', cl.id,
        'sender_id', cl.sender_id,
        'recipient_id', NULL,
        'circle_id', cl.circle_id,
        'event_id', NULL,
        'content', cl.content,
        'created_at', cl.created_at
      )
    ELSE NULL END AS last_message,
    COALESCE(cu.n, 0)::BIGINT AS unread_count,
    COALESCE(cl.created_at, uc.created_at) AS sort_at
  FROM user_circles uc
  LEFT JOIN circle_last cl ON cl.circle_id = uc.id
  LEFT JOIN circle_unread cu ON cu.circle_id = uc.id

  ORDER BY sort_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION get_conversations(UUID) TO authenticated;
