-- Per-(user, partner) last-read pointer for 1:1 DMs
CREATE TABLE direct_message_reads (
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  partner_id   UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, partner_id),
  CHECK (user_id <> partner_id)
);

ALTER TABLE direct_message_reads ENABLE ROW LEVEL SECURITY;

-- Wrap auth.uid() in (SELECT ...) so it's evaluated once per query, not per row.
CREATE POLICY "direct_message_reads_select" ON direct_message_reads
  FOR SELECT USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = partner_id);

CREATE POLICY "direct_message_reads_insert_own" ON direct_message_reads
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "direct_message_reads_update_own" ON direct_message_reads
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE direct_message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Covering index for partner_id FK + lookups by partner (getPartnerLastRead)
CREATE INDEX direct_message_reads_partner_idx
  ON direct_message_reads(partner_id);

CREATE INDEX messages_recipient_created_idx
  ON messages(recipient_id, created_at DESC)
  WHERE recipient_id IS NOT NULL;

CREATE INDEX messages_dm_pair_idx
  ON messages(sender_id, recipient_id, created_at DESC)
  WHERE recipient_id IS NOT NULL;

CREATE OR REPLACE FUNCTION get_conversations(p_user_id UUID)
RETURNS TABLE (
  partner_id   UUID,
  partner      JSONB,
  last_message JSONB,
  unread_count BIGINT
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
    WHERE circle_id IS NULL
      AND (sender_id = p_user_id OR recipient_id = p_user_id)
  ),
  last_per_partner AS (
    SELECT DISTINCT ON (partner_id)
      partner_id, id, sender_id, recipient_id, content, created_at
    FROM dms
    ORDER BY partner_id, created_at DESC
  ),
  unread AS (
    SELECT m.sender_id AS partner_id, COUNT(*)::BIGINT AS unread_count
    FROM messages m
    LEFT JOIN direct_message_reads r
      ON r.user_id = p_user_id AND r.partner_id = m.sender_id
    WHERE m.recipient_id = p_user_id
      AND m.circle_id IS NULL
      AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
    GROUP BY m.sender_id
  )
  SELECT
    lpp.partner_id,
    to_jsonb(p.*) AS partner,
    jsonb_build_object(
      'id', lpp.id,
      'sender_id', lpp.sender_id,
      'recipient_id', lpp.recipient_id,
      'circle_id', NULL,
      'content', lpp.content,
      'created_at', lpp.created_at
    ) AS last_message,
    COALESCE(u.unread_count, 0)::BIGINT AS unread_count
  FROM last_per_partner lpp
  JOIN profiles p ON p.id = lpp.partner_id
  LEFT JOIN unread u ON u.partner_id = lpp.partner_id
  ORDER BY lpp.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_conversations(UUID) TO authenticated;
