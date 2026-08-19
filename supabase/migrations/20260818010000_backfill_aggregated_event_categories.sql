-- Backfill categories onto the 96 aggregated events (2026-08-18).
--
-- Tina's aggregator imported 96 real Berlin listings on 2026-08-17 and every
-- single one landed with `categories = '{}'`. Measured on production today:
--
--     aggregated (source like 'tina:%') : 96 events, 96 with no categories
--     community  (source is null)       : 76 events,  1 with no categories
--
-- The feed filters by exact string (`query.overlaps('categories', …)` in
-- `src/services/events.service.ts`), so an empty array cannot be produced by
-- any chip. Every real venue listing in the app — all of Il Kino's programme,
-- all of Privatclub's — is unreachable the moment anyone taps a filter. They
-- render, they search, they sit on the map; they just cannot be filtered TO.
--
-- The aggregator has been fixed so future imports arrive categorised
-- (`src/tina/events/categorise.py` in the Tina repo, branch
-- `overnight/2026-08-18-event-categories`). This file is the one-time catch-up
-- for the rows that are already here.
--
-- ── The rule that shaped every assignment ───────────────────────────────────
-- A WRONG category is worse than none. An empty array makes an event hard to
-- find; a wrong one makes the feed lie — someone filters Clubbing and gets a
-- children's film. So a row only gets a category a human would defend out
-- loud, and one row below deliberately gets nothing.
--
-- ── Where the confidence actually comes from ────────────────────────────────
-- Two feeds, two completely different kinds of evidence, and the difference
-- matters when judging this:
--
--   Privatclub (51 rows) — the venue TELLS US, in German, in every listing.
--     Its descriptions are a rigid template: "Konzert am Freitag, 4. September
--     2026 um 20:00 Uhr im Privatclub Berlin", or "Party am Samstag …". That
--     is not inference, it is reading. 39 Konzert, 11 Party, 1 Songslam.
--
--   Il Kino (43 rows) — the listings say NOTHING. Every description is empty
--     and every title is a bare film name ("DAVID", "DIE ODYSSEE"). Their
--     Film category rests entirely on one asserted fact: `ilkino.de/shows/` is
--     a cinema's screenings feed, so every entry in it is a screening. That
--     assertion now lives in `config/berlin_event_feeds.yaml` in the Tina repo
--     and is reproduced here as the `source_url` test. If you disagree with
--     the assertion, 42 of the 95 assignments below go with it.
--
-- Arena and YAAM get NO venue-level assumption, and they are the reason the
-- rule exists. Both are music venues. Their two real events in this import are
-- a startup trade fair and a family brunch — a "music venue ⇒ Music" default
-- would have been wrong on 100% of what they actually produced.
--
-- ── What this does, row by row (dry-run against production, 2026-08-18) ─────
--
--     42  Il Kino          {Film}                     — 2 of them {Film,Festivals}
--     39  Privatclub       {Music}                    — "Konzert am …"
--     11  Privatclub       {Clubbing}                 — "Party am …"
--      1  Privatclub       {Music}                    — "Songslam am …"
--      1  Privatclub       {Music,Festivals}          — TANGO OR NONTANGO FESTIVAL
--      1  YAAM             {Food & Drinks,Family & Kids}
--      1  Arena Halle      {Talk,Workshops,Learning}  — deGUT
--      1  Il Kino          (nothing)                  — "Private Veranstaltung"
--     ---
--     95  rows updated, 1 deliberately left bare, 96 accounted for
--
-- THE ONE LEFT BARE is Il Kino's "Private Veranstaltung" — a closed booking,
-- not a screening. Nobody can attend it, so tagging it Film would put a
-- private hire in the Film chip. It is the only row where the listing
-- contradicts the feed's own declaration, and the listing wins.
--
-- THE ONE I AM LEAST SURE OF is deGUT (Arena Halle), a founders' trade fair.
-- {Talk,Workshops,Learning} comes from its description naming "inspirierende
-- Vorträge, praxisnahe Workshops und kostenfreie Seminare" — all three are
-- literally on the programme, so none of it is false, but they describe the
-- day's CONTENTS rather than its headline identity, and there is no
-- Business/Networking category to put it in. Worth a look; safe to clear.
--
-- ── German mattered ─────────────────────────────────────────────────────────
-- An English-only matcher would have categorised 11 of these 96 rows. Two
-- specific traps are handled and both come from real strings in this data:
--
--   * The German "Fest" is NOT matched — only "Festival". Il Kino was showing
--     a film called BITTERES FEST seven times; matching "Fest" would have
--     tagged seven cinema screenings as Festivals.
--   * "\yparty\y" is anchored, and the English word "dance" is not matched at
--     all. Privatclub runs a club night called "Dance Dance Revolution" three
--     times; an unanchored dance rule tagged all three Performing Arts before
--     this was checked against the real rows.
--
-- ── This does not fight 20260818000000_rename_event_categories.sql ──────────
-- That migration rewrites rows carrying a RETIRED name; it matches only where
-- `exists (select 1 from alias a where a.old = any (e.categories))`. Every row
-- here has an EMPTY array, so it matches none of them, and every value written
-- below is already in the new `EVENT_CATEGORIES` — so it will match none of
-- them afterwards either. The two are disjoint and order-independent: apply
-- them in either order and the result is identical.
--
-- Worth recording, because that file's header says otherwise: the five values
-- that were never in the constant (`Community`, `Technology`, `Nightlife`,
-- `Dance`, `Exhibition`) were NOT written by the aggregator. All 22 rows
-- carrying them have `source IS NULL` — they are community/seed rows. The
-- aggregator has never written a category at all, which is this bug.
--
-- ── Safety ──────────────────────────────────────────────────────────────────
-- * Touches ONLY `source like 'tina:%'`. A human-posted row has `source IS
--   NULL` and cannot be reached by this file. A guard at the end aborts the
--   transaction if any updated row is not aggregated.
-- * IDEMPOTENT. It only fills rows whose categories are empty, so a second run
--   changes nothing. It will also never overwrite a category a human later
--   sets on an aggregated row.
-- * Writes only values in `EVENT_CATEGORIES`; a guard asserts that too.
--
-- ⚠️ NOT APPLIED. Written 2026-08-18 by an unattended run that was explicitly
-- forbidden to touch production. `supabase db push` is banned in this repo;
-- apply this deliberately, by hand, after reading the mapping above.
--
-- WITHDRAWAL: `update events set categories = '{}' where source like 'tina:%';`
-- — safe in full, because no aggregated row had a category before this ran
-- (96 of 96 were empty) and nothing but this file gives them one.

-- ---------------------------------------------------------------------------

begin;

-- A fingerprint of every row this file must NOT touch, taken before the write
-- and compared after it. The UPDATE's own `source like 'tina:%'` is what makes
-- that true; this is what PROVES it, and it is worth proving, because "an
-- import can never alter a human-posted event" is the safety property the
-- whole aggregated-events design rests on.
create temporary table _community_before on commit drop as
  select id, categories from events where source is null;

with
-- The listing says the venue is closed to the public. Not an event anybody can
-- attend, so it gets nothing — including nothing from the feed's declaration.
private_booking as (
  select id from events
   where source like 'tina:%'
     and (coalesce(title, '') || ' ' || coalesce(description, ''))
         ~* '(private veranstaltung|privatveranstaltung|geschlossene gesellschaft|private event)'
),

-- What the FEED declares, as opposed to what a listing says. Asserted by hand
-- for a feed that is structurally one kind of thing — a cinema's screenings
-- list — and for no other feed. `pos` 0 keeps it ahead of the text matches,
-- because it is the event's KIND and Sphaer's poster engine
-- (`familyShortlist()`) reads the first category in the array.
declared as (
  select e.id, 'Film'::text as category, 0 as pos
    from events e
   where e.source like 'tina:%'
     and e.source_url like 'https://ilkino.de/%'
),

-- What the LISTING says about itself. `pos` mirrors the rule order in
-- `src/tina/events/categorise.py` (kind before modifier); the Python table is
-- the authoritative one and is much larger — this is only the subset that
-- fires on these 96 rows, plus its immediate siblings.
rules(pattern, category, pos) as (
  values
    -- kind
    ('film|kino|screening',            'Film',            10),
    ('konzert|songslam',               'Music',           20),
    ('\yparty\y|clubnacht|\yrave\y',   'Clubbing',        30),
    ('theater|tanztheater|ballett',    'Performing Arts', 40),
    ('ausstellung|vernissage',         'Exhibitions',     50),
    ('\ylesung|poetry slam',           'Literature',      60),
    (E'vortrag|vorträge',              'Talk',            70),
    ('workshop',                       'Workshops',       71),
    ('seminar|\ykurs',                 'Learning',        72),
    ('brunch|weinprobe|street food',   'Food & Drinks',   80),
    -- modifiers, deliberately after the kind. NOTE: 'festival' and never the
    -- German 'Fest' — see the header.
    ('festival',                       'Festivals',       90),
    ('queer|lgbtq',                    'Queer life',      94),
    ('family|familie|kinder',          'Family & Kids',   95)
),
matched as (
  select e.id, r.category, r.pos
    from events e
    join rules r
      on (coalesce(e.title, '') || ' ' || coalesce(e.description, '')) ~* r.pattern
   where e.source like 'tina:%'
),

-- Union the two sources of truth, drop the private bookings, keep each
-- category once at its earliest position, and rebuild the array in that order.
computed as (
  select u.id,
         array_agg(u.category order by u.first_pos, u.category) as categories
    from (
      select id, category, min(pos) as first_pos
        from (
          select id, category, pos from declared
          union all
          select id, category, pos from matched
        ) all_hits
       where id not in (select id from private_booking)
       group by id, category
    ) u
   group by u.id
)

update events e
   set categories = c.categories
  from computed c
 where c.id = e.id
   -- Belt and braces: the UPDATE cannot leave the aggregated rows even without
   -- this, but the whole safety story of the import is that `tina:%` can never
   -- catch a human-posted row, so it is stated where it is enforced.
   and e.source like 'tina:%'
   -- Idempotent, and never clobbers a category somebody set by hand.
   and cardinality(coalesce(e.categories, '{}'::text[])) = 0
   and cardinality(c.categories) > 0;

-- Guards. Each aborts the transaction rather than reporting success over a
-- partial or wrong write.
do $$
declare
  touched  int;
  unknowns int;
begin
  -- 1. Not one human-posted event may have moved. Compared against the
  --    snapshot taken before the write, so this catches a botched join rather
  --    than merely restating the WHERE clause.
  select count(*) into touched
    from events e
    join _community_before b on b.id = e.id
   where e.categories is distinct from b.categories;

  if touched > 0 then
    raise exception
      'backfill altered % community events; it must only ever touch '
      'source like ''tina:%%''', touched;
  end if;

  -- 2. Every aggregated row must now hold only values the filter row can
  --    offer. A value outside EVENT_CATEGORIES is unselectable, which is the
  --    exact bug this file exists to fix.
  select count(*) into unknowns
    from (
      select unnest(categories) as cat
        from events
       where source like 'tina:%'
    ) t
   where cat not in (
     'Art','Film','Music','Wellbeing','Performing Arts','Craft',
     'Design, Illustration, Animation','Photography','Festivals','Street Art',
     'Fashion','Exhibitions','Academic','Tech','Tattoo','Gaming','Jam Session',
     'Spiritual','Talk','Workshops','Social movements','Coaching','Learning',
     'Meet Ups','Food & Drinks','Markets','Pop-ups','Literature','Language',
     'Sports','Outdoors','Volunteering','Neighbourhood','Family & Kids',
     'Clubbing','Queer life'
   );

  if unknowns > 0 then
    raise exception
      'backfill wrote % category values outside EVENT_CATEGORIES', unknowns;
  end if;
end $$;

commit;
