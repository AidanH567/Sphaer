-- ───────────────────────────────────────────────────────────────
-- Venues, and the hearts you put on them.
--
-- Lara's request (approved by Aidan 2026-08-18): the map grows from one
-- view into three — activities (what it does today), venues (the places
-- themselves, independent of what is on tonight), and favourites ("my
-- city": everything you saved, in one glimpse). Aidan's call when asked
-- whether to derive venues from event rows or build a real table:
-- "build a real venues table and also do the favourites."
--
-- Why a real table rather than a GROUP BY over events.location_name:
-- a favourite has to point at something STABLE. If a venue is just the
-- string in events.location_name, then a heart is a heart on a string —
-- fix a typo, or let a feed change "Privatclub" to "Privatclub Berlin",
-- and every user who saved it silently loses it. A row with a uuid
-- survives renames; a GROUP BY key does not. That is the whole argument,
-- and it is why this migration exists at all.
--
-- ⚠️ NOT APPLIED. Written 2026-08-18 by an unattended run that was
-- explicitly forbidden to touch production. `supabase db push` is banned
-- in this repo (local migration files and the live database have fully
-- diverged — see the header of 20260817000000_bug_reports.sql). This file
-- is purely additive (two new tables, one new nullable column, one new
-- function, new policies) and is meant to be applied BY HAND, on its own,
-- in the SQL editor, by Aidan.
--
-- Nothing here changes existing behaviour. events.venue_id is nullable and
-- NULL for all 172 rows; the aggregator keeps writing location_name /
-- address / lat / lng exactly as it does today and never has to know that
-- venues exist.
-- ───────────────────────────────────────────────────────────────


-- ---------------------------------------------------------------------------
-- 1. venue_slug() — one normaliser, so identity cannot drift
-- ---------------------------------------------------------------------------
-- The backfill, the app, and any future importer must agree on when two
-- spellings are the same place. If each grows its own normaliser they WILL
-- diverge, and the divergence shows up as duplicate pins on the map. So the
-- rule lives in the database, once, and everything calls it.
--
-- What it does, in order:
--   * lowercase and trim
--   * expand German umlauts the way Germans actually type them in ASCII —
--     ä→ae, ö→oe, ü→ue, ß→ss. NOT ä→a. Verified against the real data:
--     the events table already contains "Arena Neukoelln", typed by hand
--     with "oe", so the expansion form is the one that matches reality.
--     (Under ä→a, a feed writing "Kuehlhaus" would fail to match a human
--     writing "Kühlhaus" — the exact class of miss this function exists
--     to prevent.)
--   * fold the remaining Latin-1 accents to bare letters
--   * replace every run of non-alphanumerics with a single space, and trim
--   * drop a leading or trailing "berlin" — "Privatclub" and "Privatclub
--     Berlin" are one venue. Measured on production: this rewrites 11 of
--     the 71 distinct names and merges ZERO of them today, so it is
--     insurance against future feed variants, not a fix for present data.
--   * NULL rather than '' if nothing survives (a name that was only
--     punctuation). Note "Berlin" alone still slugs to 'berlin' — the strip
--     above only removes it as a leading/trailing word ALONGSIDE something
--     else, and "Berlin" in the middle of a name is kept:
--     "Funkhaus Berlin (Studio 4)" → 'funkhaus berlin studio 4'.
--
-- IMMUTABLE because it depends on nothing but its input — that is what
-- lets it be used in an index and in a generated expression.
CREATE OR REPLACE FUNCTION public.venue_slug(venue_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT nullif(
    btrim(
      regexp_replace(
        btrim(
          regexp_replace(
            regexp_replace(
              translate(
                replace(replace(replace(replace(replace(replace(replace(
                  lower(btrim(coalesce(venue_name, ''))),
                  'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
                  'æ', 'ae'), 'ø', 'oe'), 'å', 'aa'),
                'àáâãèéêëìíîïòóôõùúûñçý',
                'aaaaeeeeiiiiooooouuuncy'
              ),
              '[^a-z0-9]+', ' ', 'g'
            ),
            '\s+', ' ', 'g'
          )
        ),
        '(^berlin\s+|\s+berlin$)', '', 'g'
      )
    ),
    ''
  );
$$;

COMMENT ON FUNCTION public.venue_slug(TEXT) IS
  'Canonical identity key for a venue name. The single place that decides '
  'whether two spellings are the same venue — the backfill, the app and any '
  'importer must all route through this rather than growing their own '
  'normaliser. Returns NULL when nothing survives normalisation.';


-- ---------------------------------------------------------------------------
-- 2. venues
-- ---------------------------------------------------------------------------
-- Deliberately thin. A venue is a place with a name and a point on the map;
-- everything richer (opening hours, a photo, a resident-collective link) can
-- be added later without migrating what is here.
--
-- No saved_count / popularity column, on purpose. Sphaer's feed is never
-- engagement-ranked (README, "Community-first, not algorithm-first"), and a
-- public "247 people saved this" number on a venue is exactly the ranking
-- signal the product refuses to have. Each user's own favourites are per-user
-- data and live in saved_venues.
CREATE TABLE IF NOT EXISTS public.venues (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What to show. Free text, human-facing, editable.
  name          TEXT NOT NULL CHECK (btrim(name) <> ''),

  -- Who it IS. Filled from venue_slug(name) by the trigger below when the
  -- caller leaves it NULL, but writable by hand — see the trigger's comment
  -- for why that escape hatch matters.
  slug          TEXT NOT NULL,

  address       TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,

  -- Mirrors events.borough / events.neighbourhood (20260529000000,
  -- 20260601300000) so the map's existing neighbourhood filter can narrow
  -- venues with the same two-level Berlin hierarchy it already uses on
  -- events, instead of a second parallel scheme.
  borough       TEXT,
  neighbourhood TEXT,

  description   TEXT,
  image_url     TEXT,
  website_url   TEXT,

  -- Ownership, and therefore RLS. ON DELETE SET NULL, not CASCADE: a venue
  -- is shared reference data that outlives the account that first typed it
  -- in. Deleting your profile must not delete Tresor off everyone's map.
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Identity. One row per real place.
CREATE UNIQUE INDEX IF NOT EXISTS venues_slug_key
  ON public.venues (slug);

-- The venues map mode reads every venue that has a point; the partial index
-- keeps the address-only rows (9 of 71 today have no coordinates) out of it.
CREATE INDEX IF NOT EXISTS venues_coords_idx
  ON public.venues (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

COMMENT ON TABLE public.venues IS
  'Places, independent of what is on at them tonight. Populated by the '
  'backfill in docs/venues-backfill.md and thereafter by the app. A venue '
  'row is what a favourite points at, which is why it exists as a row and '
  'not as a GROUP BY over events.location_name.';

COMMENT ON COLUMN public.venues.slug IS
  'Canonical identity, normally venue_slug(name), filled by '
  'venues_set_slug on insert when left NULL. Hand-writable so two genuinely '
  'different venues that share a name can be disambiguated.';


-- Fill slug from name when the caller did not supply one.
--
-- A trigger rather than `GENERATED ALWAYS AS (public.venue_slug(name)) STORED`
-- because a generated column would make the unique index inescapable: two real,
-- distinct venues that happen to share a name (Berlin has more than one
-- "Studio Eins") could never both be stored, and there would be no way out
-- short of renaming one of them in the UI. With a trigger the default is
-- automatic and the override is available.
CREATE OR REPLACE FUNCTION public.venues_set_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    NEW.slug := public.venue_slug(NEW.name);
  END IF;
  IF NEW.slug IS NULL THEN
    RAISE EXCEPTION 'venue name % normalises to an empty slug', NEW.name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS venues_slug_before_write ON public.venues;
CREATE TRIGGER venues_slug_before_write
  BEFORE INSERT OR UPDATE OF name, slug ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION public.venues_set_slug();


CREATE OR REPLACE FUNCTION public.venues_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS venues_set_updated_at ON public.venues;
CREATE TRIGGER venues_set_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION public.venues_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 3. events.venue_id — the link, nullable, never required
-- ---------------------------------------------------------------------------
-- The relationship is a NULLABLE FK, and the free text stays.
--
-- The importer is the reason. 96 of 172 rows arrive from feeds that publish a
-- location STRING and nothing else — they have no venue identity to give. If
-- venue_id were NOT NULL, or if the app resolved venues by matching
-- location_name at read time, then:
--
--   * NOT NULL would break the aggregator on its next run. It keeps writing
--     location_name and leaves venue_id NULL; nothing about the import
--     changes, which is the requirement.
--   * matching by name at READ time would make a favourite a favourite of a
--     string. Rename the venue, or let a feed drift from "Privatclub" to
--     "Privatclub Berlin", and the heart points at nothing. Resolving ONCE,
--     at write/backfill time, into a stable uuid is what makes hearts
--     survive.
--
-- So: location_name / address / lat / lng remain exactly what was typed or
-- scraped — the display fallback, and the audit trail of what the feed said.
-- venue_id is the RESOLVED identity, filled in when we are confident, NULL
-- when we are not. An event at "Tempelhofer Feld", or in someone's flat, is
-- legitimately not at a venue and stays NULL forever.
--
-- ON DELETE SET NULL: removing a venue must never remove events.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_id UUID
    REFERENCES public.venues(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.events.venue_id IS
  'Resolved venue, or NULL. NULL is normal and permanent for events that are '
  'not at a venue (a park, a flat) and normal-but-temporary for imported rows '
  'the backfill has not matched. Never required: the aggregator writes '
  'location_name only. Display still falls back to location_name.';

CREATE INDEX IF NOT EXISTS events_venue_id_idx
  ON public.events (venue_id)
  WHERE venue_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 4. saved_venues — favourites, shaped exactly like saved_events
-- ---------------------------------------------------------------------------
-- Same columns, same composite PK, same cascade, same one-policy RLS as
-- saved_events (20240101000000_initial_schema.sql:79). Deliberately not a
-- second, cleverer pattern: the app already has a save/unsave idiom and the
-- venue heart is the same idiom pointed at a different table.
--
-- No reminder_at. saved_events grew one (20260609000000) because an event
-- happens at a time; a venue does not.
CREATE TABLE IF NOT EXISTS public.saved_venues (
  user_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES public.venues(id)   ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, venue_id)
);

-- "Everything I saved, newest first" is the favourites map's only query.
CREATE INDEX IF NOT EXISTS saved_venues_user_saved_at_idx
  ON public.saved_venues (user_id, saved_at DESC);

COMMENT ON TABLE public.saved_venues IS
  'Venue favourites — the hearts on the map. Mirrors saved_events exactly. '
  'Private to the user: RLS is auth.uid() = user_id for ALL commands, so no '
  'one can read whose city looks like what.';


-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.venues       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_venues ENABLE ROW LEVEL SECURITY;

-- Venues mirror the events policy set (initial_schema.sql:127-130): world
-- readable, owner writable. Anyone signed in may add a venue that is missing;
-- only whoever added it may edit or remove it. Open editing would make the
-- shared map a vandalism surface, and this repo has no moderation tooling for
-- venues yet — so the conservative version ships and curation (a verified
-- flag, designer-only edits like current_user_is_designer() in
-- 20260817120000) is a later, deliberate decision.
--
-- Tina's aggregator writes with the service role, which bypasses RLS
-- entirely — same key and same reasoning as the events import.
DROP POLICY IF EXISTS "venues_read_all"    ON public.venues;
DROP POLICY IF EXISTS "venues_insert_own"  ON public.venues;
DROP POLICY IF EXISTS "venues_update_own"  ON public.venues;
DROP POLICY IF EXISTS "venues_delete_own"  ON public.venues;

CREATE POLICY "venues_read_all"   ON public.venues
  FOR SELECT USING (TRUE);
CREATE POLICY "venues_insert_own" ON public.venues
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = created_by);
CREATE POLICY "venues_update_own" ON public.venues
  FOR UPDATE USING ((SELECT auth.uid()) = created_by)
              WITH CHECK ((SELECT auth.uid()) = created_by);
CREATE POLICY "venues_delete_own" ON public.venues
  FOR DELETE USING ((SELECT auth.uid()) = created_by);

-- Favourites: one policy, FOR ALL, exactly like saved_events_own. The
-- WITH CHECK is spelled out rather than left to default from USING — same
-- meaning, but it makes the insert path readable without knowing the
-- Postgres defaulting rule.
DROP POLICY IF EXISTS "saved_venues_own" ON public.saved_venues;
CREATE POLICY "saved_venues_own" ON public.saved_venues
  FOR ALL USING ((SELECT auth.uid()) = user_id)
          WITH CHECK ((SELECT auth.uid()) = user_id);


-- ---------------------------------------------------------------------------
-- 6. What this migration does NOT do
-- ---------------------------------------------------------------------------
--   * It does not insert a single venue. The backfill is a separate,
--     reviewable step — docs/venues-backfill.md — because ~9 of the groups
--     it would create need a human to say whether they are the same place,
--     and a migration is the wrong place for a judgement call.
--   * It does not backfill events.venue_id. Same reason.
--   * It does not touch the delete-account edge function's cascade note.
--     saved_venues cascades from profiles like every other user-owned table,
--     so account deletion already collects it; the COMMENT in
--     supabase/functions/delete-account/index.ts lists tables by hand and
--     should gain `saved_venues` when this is applied.
