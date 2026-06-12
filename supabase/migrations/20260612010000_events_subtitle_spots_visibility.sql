-- Create Activity v3 (Figma frame 6277:10002) — new event fields.
--
--   subtitle    — the "Sub Title" field under Title (short tagline, multiline).
--   spots       — capacity ("Spots" numeric field). NULL = unlimited. CHECK
--                 only constrains non-NULL values (NULL passes CHECK in PG).
--   visibility  — "Who can see this?" radio card. 'anyone' (default) or
--                 'invite_only' ("Invite only · By link"). NOT NULL with a
--                 DEFAULT so every existing row backfills to 'anyone' and
--                 inserts that omit the key stay valid.
--   media_urls  — up to 4 extra "Media" images uploaded alongside the cover
--                 poster (same `event-posters` bucket, indexed paths
--                 `<userId>/<eventId>-media-<n>.<ext>`). Array of public URLs.
--
-- The client ships BEFORE this migration is applied: createEvent() sends
-- these keys only when set/non-default and retries without them when the
-- insert fails on a missing column (graceful degradation, see
-- src/services/events.service.ts). Safe to apply at any time afterwards.
--
-- After applying, regenerate types:
--   npx supabase gen types typescript --local > src/types/supabase.ts

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS spots integer
    CONSTRAINT events_spots_positive CHECK (spots > 0),
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'anyone'
    CONSTRAINT events_visibility_valid CHECK (visibility IN ('anyone', 'invite_only')),
  ADD COLUMN IF NOT EXISTS media_urls text[];
