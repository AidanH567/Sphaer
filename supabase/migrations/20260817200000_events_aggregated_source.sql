-- Aggregated events: where a row came from, and how to take it back.
--
-- Tina's event aggregator (design: Obsidian/Tina/Planning/Event Aggregator
-- 2026-08-02.md) fans one query out across venue ICS/RSS/JSON-LD feeds, merges
-- and de-duplicates, and writes the result here. Sphaer's `events` table had no
-- way to tell an imported listing from one a human posted, and that is the
-- whole safety property the import rests on:
--
--   * an import must be RE-RUNNABLE — the same feed read twice updates one row
--     rather than creating a second copy;
--   * it must be CORRECTABLE — a venue moving a door time changes the row it
--     already owns;
--   * it must be WITHDRAWABLE WHOLESALE — `delete from events where source like
--     'tina:%'` removes every aggregated listing and cannot touch anything a
--     person wrote, because a human-posted row has source IS NULL.
--
-- Three columns, all nullable, all NULL for every one of the 56 rows that
-- exist today. Nothing about posting an event from the app changes.
--
-- ⚠️ NOT APPLIED. Written 2026-08-17 by an unattended run that was explicitly
-- forbidden to touch production. `supabase db push` is banned in this repo (22
-- local migrations unapplied, 17 remote with no local file); this needs to be
-- applied deliberately, by hand, by Aidan.

-- ---------------------------------------------------------------------------
-- 1. Provenance
-- ---------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS source      TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source_url  TEXT;

COMMENT ON COLUMN public.events.source IS
  'NULL = posted by a person in the app. ''tina:<feed source>'' (e.g. tina:ics, '
  'tina:rss, tina:jsonld) = imported by Tina''s event aggregator. Everything '
  'aggregated is prefixed ''tina:'' so an import can be withdrawn wholesale '
  'without a chance of catching a human-posted row.';

COMMENT ON COLUMN public.events.external_id IS
  'The id the ORIGINATING feed used for this listing — an iCalendar UID (plus '
  'RECURRENCE-ID for one instance of a series), an RSS guid, a JSON-LD @id. '
  'Stable across runs, which is what makes the import re-runnable. NULL for '
  'human-posted events.';

COMMENT ON COLUMN public.events.source_url IS
  'The public listing this row was read from — attribution, and the link back. '
  'Distinct from ticket_url, which is where you buy. NULL for human-posted.';

-- Identity for an imported row. Partial, so the 56 existing rows (and every
-- future human-posted one) are entirely unaffected — many rows may have
-- source IS NULL without colliding.
CREATE UNIQUE INDEX IF NOT EXISTS events_source_external_id_key
  ON public.events (source, external_id)
  WHERE source IS NOT NULL;

-- The wholesale-withdraw / reconcile path reads by source.
CREATE INDEX IF NOT EXISTS events_source_idx
  ON public.events (source)
  WHERE source IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. An imported event must not arrive pre-attended
-- ---------------------------------------------------------------------------
-- `on_event_created` registers the creator as attending their own event, which
-- is right for a human host and wrong for an importer: every aggregated listing
-- would show one attendee who is a bot, and Sphaer's feed is deliberately never
-- engagement-ranked. Adding a WHEN clause is the minimal change — behaviour for
-- every human-posted row (source IS NULL) is byte-for-byte what it is now.
DROP TRIGGER IF EXISTS on_event_created ON public.events;
CREATE TRIGGER on_event_created
  AFTER INSERT ON public.events
  FOR EACH ROW
  WHEN (NEW.source IS NULL)
  EXECUTE FUNCTION public.register_event_creator();

-- `events_notify_circle_after_insert` needs no change: it already fires only
-- WHEN (new.circle_id IS NOT NULL), and aggregated events arrive with no
-- circle by design. Stated here so the next reader does not have to re-derive
-- it before trusting that an import sends no notifications.

-- ---------------------------------------------------------------------------
-- 3. RLS is unchanged, on purpose
-- ---------------------------------------------------------------------------
-- events_insert_own still requires auth.uid() = creator_id, so no app user
-- gains the ability to forge an aggregated row. Tina writes with the service
-- role, which bypasses RLS — the same key and the same reasoning as the
-- bug_reports inlet.
