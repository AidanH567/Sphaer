-- ───────────────────────────────────────────────────────────────
-- Populate `venues` from the events that already exist, link the events to
-- them, and fold the four duplicate families Aidan ruled on (2026-08-19).
--
-- This is the execution of docs/venues-backfill.md steps 1–3. The analysis
-- lives there; only the decisions and the measured shape are repeated here.
--
-- ⚠️ DO NOT APPLY WITH `supabase db push`. Local and remote migration history
-- have completely diverged. Applied by hand:
--     npx supabase db query --linked --file \
--       supabase/migrations/20260819120000_venues_backfill_and_merges.sql
--
-- Idempotent: step 1 is ON CONFLICT DO NOTHING, step 2 only touches rows whose
-- venue_id IS NULL, and the merges are no-ops once the folded slugs are gone.
--
-- ── AIDAN'S RULING, 2026-08-19 ──────────────────────────────────────────────
-- Four families are one venue each. The FIRST name in each survives:
--
--   Kraftwerk Berlin   ← Kraftwerk Halle, Kraftwerk Mitte
--   Babylon Berlin     ← Babylon Kino
--   silent green       ← silent green Kulturquartier
--   Arena Halle        ← Arena Neukoelln          ⚠️ least certain of the four
--
-- His words on the last one: "im pretty sure all of these are one except for
-- the last one." Arena Berlin is in Treptow and `Arena Neukoelln` may well be a
-- different place, so this merge is the one to revisit. It is also the easiest
-- to undo right now — see the note at the foot.
--
-- WHY NOW AND NOT LATER. `saved_venues` is empty (verified 0 rows immediately
-- before this ran). Once anyone hearts a venue, a merge has to move their
-- hearts across or the ON DELETE CASCADE throws them away silently. Free
-- today, lossy tomorrow.
--
-- WHY NOT AUTOMATIC. The normaliser merges case, whitespace, punctuation,
-- umlaut spelling and a trailing "Berlin" — and nothing else. On this data it
-- merges exactly one pair, which is junk test data excluded anyway. These four
-- cannot be derived: names sharing a first word are frequently different
-- places (Factory Berlin Mitte / Görlitzer Park are two real branches; the five
-- `Studio *` are five different rooms). Proximity was measured and rejected —
-- Astra Kulturhaus and Badehaus are 18 m apart and both real.
-- ───────────────────────────────────────────────────────────────

BEGIN;

-- ── Step 1: create the venues ───────────────────────────────────────────────
-- Excludes invite_only, matching the rule the feed already applies, which is
-- what keeps `Test` / `TEst` / `Park` out without a hand-written junk filter.
WITH slugged AS (
  SELECT id, location_name, address, lat, lng,
         public.venue_slug(location_name) AS slug
  FROM public.events
  WHERE public.venue_slug(location_name) IS NOT NULL
    AND (visibility IS NULL OR visibility = 'anyone')
),
-- The spelling used most often wins; ties go to the fuller name.
name_pick AS (
  SELECT DISTINCT ON (slug) slug, location_name AS name
  FROM (
    SELECT slug, location_name, count(*) AS uses
    FROM slugged GROUP BY slug, location_name
  ) t
  ORDER BY slug, uses DESC, length(location_name) DESC
),
-- Coordinates from ANY row that has them, preferring one that also carries an
-- address — independently of the name pick, so a venue whose commonest
-- spelling lacks coordinates still lands on the map.
geo_pick AS (
  SELECT DISTINCT ON (slug) slug, address, lat, lng
  FROM slugged
  WHERE lat IS NOT NULL AND lng IS NOT NULL
  ORDER BY slug, (address IS NULL)::int
),
-- For the venues with no coordinates at all: keep an address if one exists, so
-- they are correctable later rather than lost.
addr_pick AS (
  SELECT DISTINCT ON (slug) slug, address
  FROM slugged
  WHERE address IS NOT NULL
  ORDER BY slug
)
INSERT INTO public.venues (name, slug, address, lat, lng)
SELECT n.name, n.slug, COALESCE(g.address, a.address), g.lat, g.lng
FROM name_pick n
LEFT JOIN geo_pick  g ON g.slug = n.slug
LEFT JOIN addr_pick a ON a.slug = n.slug
ON CONFLICT (slug) DO NOTHING;

-- ── Step 2: link the events ─────────────────────────────────────────────────
-- No visibility filter here, on purpose: a hidden event still belongs to its
-- venue, it just did not get to name one.
UPDATE public.events e
SET venue_id = v.id
FROM public.venues v
WHERE e.venue_id IS NULL
  AND public.venue_slug(e.location_name) = v.slug;

-- ── Step 3: fold the four families ──────────────────────────────────────────
-- Slugs verified against production before writing this, not guessed —
-- `venue_slug` strips a trailing "Berlin", so `Kraftwerk Berlin` is the slug
-- `kraftwerk` and `Babylon Berlin` is `babylon`. Getting that backwards would
-- delete the survivor and keep the duplicate.
--
-- The coordinate lift below is a NO-OP on today's data (measured: of the five
-- folded rows, none carries coordinates the survivor lacks). It is here for
-- correctness of the operation, not because it does anything today — a merge
-- that could silently drop the only coordinates a venue had would be a bad
-- merge even if this particular run is safe.
CREATE TEMP TABLE venue_merges (survivor TEXT, absorbed TEXT) ON COMMIT DROP;
INSERT INTO venue_merges (survivor, absorbed) VALUES
  ('kraftwerk',    'kraftwerk halle'),
  ('kraftwerk',    'kraftwerk mitte'),
  ('babylon',      'babylon kino'),
  ('silent green', 'silent green kulturquartier'),
  ('arena halle',  'arena neukoelln');

-- Lift coordinates/address onto the survivor if it has none and the absorbed
-- row does.
UPDATE public.venues s
SET lat     = COALESCE(s.lat, a.lat),
    lng     = COALESCE(s.lng, a.lng),
    address = COALESCE(s.address, a.address)
FROM venue_merges m
JOIN public.venues a ON a.slug = m.absorbed
WHERE s.slug = m.survivor
  AND (s.lat IS NULL OR s.address IS NULL);

-- Move the events across.
UPDATE public.events e
SET venue_id = s.id
FROM venue_merges m
JOIN public.venues a ON a.slug = m.absorbed
JOIN public.venues s ON s.slug = m.survivor
WHERE e.venue_id = a.id;

-- Move any hearts across BEFORE the delete. `saved_venues.venue_id` is
-- ON DELETE CASCADE, so without this the favourites would be thrown away
-- silently. Empty today; correct whenever this is re-run.
INSERT INTO public.saved_venues (user_id, venue_id, saved_at)
SELECT sv.user_id, s.id, sv.saved_at
FROM public.saved_venues sv
JOIN venue_merges m ON TRUE
JOIN public.venues a ON a.slug = m.absorbed AND a.id = sv.venue_id
JOIN public.venues s ON s.slug = m.survivor
ON CONFLICT (user_id, venue_id) DO NOTHING;

DELETE FROM public.venues
WHERE slug IN (SELECT absorbed FROM venue_merges);

COMMIT;

-- ── What this should have produced ──────────────────────────────────────────
--   venues       67 created, 5 folded  → 62
--   mappable     45 (the rest have no coordinates in ANY spelling)
--   events       159 linked, 13 unlinked
--
-- The 13 unlinked are correct: 9 events have no location_name at all and 4 had
-- only junk/hidden names. An event in someone's flat has no venue.
--
-- ⚠️ TO UNDO THE ARENA MERGE (the uncertain one), while saved_venues is still
-- empty:
--   INSERT INTO public.venues (name, slug, address, lat, lng)
--     VALUES ('Arena Neukoelln', 'arena neukoelln', NULL, NULL, NULL);
--   UPDATE public.events SET venue_id =
--       (SELECT id FROM public.venues WHERE slug = 'arena neukoelln')
--    WHERE public.venue_slug(location_name) = 'arena neukoelln';
