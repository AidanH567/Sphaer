-- Rename event categories to Lara's vocabulary (2026-08-18).
--
-- `src/constants/categories.ts` went from 14 categories to 36 in the same
-- branch as this file. Nine of the old fourteen do not survive the change:
-- six were renamed, two were retired into a near neighbour, and two (Service,
-- Jobs) were dropped at Lara's request.
--
-- ── Why this file has to exist ───────────────────────────────────────────────
-- `events.categories` is `text[]` with no CHECK constraint (verified against
-- production 2026-08-18: the only CHECKs on `events` are `events_spots_positive`
-- and `events_visibility_valid`). So nothing breaks without this migration —
-- old values keep sitting in their rows and every event keeps rendering, since
-- no screen gates display on the category being a known one.
--
-- What breaks is REACHABILITY. The feed filter matches by exact string
-- (`query.overlaps('categories', filters.categories)` in
-- `src/services/events.service.ts`), and the filter row can only offer strings
-- that are in `EVENT_CATEGORIES`. An event whose only categories are retired
-- names can therefore no longer be produced by any combination of chips. It is
-- still in the feed, still searchable, still on the map, still openable by
-- link — but it is invisible to the filter.
--
-- Measured on production, 2026-08-18, 172 events:
--
--     97  carry no categories at all       — already unreachable by any filter,
--                                            unchanged by this work
--     75  carry at least one category
--      1  unreachable BEFORE this branch   — tagged only with aggregator values
--                                            that were never in the constant
--     17  unreachable AFTER the code change, if this file is never applied
--      0  unreachable once this is applied
--
-- So the code change alone takes filter-orphaned events from 1 to 17, and this
-- file takes it to 0.
--
-- ── The mapping ─────────────────────────────────────────────────────────────
-- Mirrors `LEGACY_CATEGORY_ALIASES` in `src/constants/categories.ts`;
-- `src/constants/__tests__/categories.test.ts` fails if the two drift apart.
--
--   Renamed by Lara's sheet
--     Workshop         → Workshops
--     Social Movements → Social movements     (capital M → lowercase; exact-
--                                              match filtering makes this a
--                                              real rename, not cosmetics)
--     Coach            → Coaching
--     Wellness         → Wellbeing
--     Meet             → Meet Ups
--     Education        → Learning
--
--   Retired into a near neighbour
--     Therapy          → Wellbeing
--     Concert          → Music
--
--   Never in the constant at all — written by Tina's aggregator, so these
--   rows have been unfilterable since the day they landed. The new vocabulary
--   happens to have a good home for each, so they are fixed here too.
--     Community        → Neighbourhood
--     Technology       → Tech
--     Nightlife        → Clubbing
--     Dance            → Performing Arts
--     Exhibition       → Exhibitions
--
--   Dropped, no successor (Lara asked for both to go)
--     Service          → (removed from the array)
--     Job              → (removed from the array)
--
-- Dry-run against production on 2026-08-18 (the SELECT half of this statement,
-- never the UPDATE) says what applying it will do:
--
--     63  rows rewritten
--      0  rows emptied            — nothing carries Service or Job as its ONLY
--                                   category, so dropping them strands nobody
--      0  rows still carrying Service or Job
--      0  rows left orphaned      — every rewritten row matches a chip
--      0  values left that are not in `EVENT_CATEGORIES`
--
-- ── Two properties this deliberately preserves ──────────────────────────────
--  1. ORDER. `familyShortlist()` in `src/utils/poster-families/index.ts` picks
--     a poster composition from the FIRST recognised category, so sorting the
--     array would silently redesign posters. The rewrite keeps each value at
--     the position of its earliest source element.
--  2. NO DUPLICATES. An event tagged ['Music','Concert'] must not come out as
--     ['Music','Music'] — 14 rows in production are exactly that pair. The
--     de-duplication keeps the first occurrence.
--
-- Posters do not change when this runs: the retired keys in
-- `poster-families` and `cover-families` were each given the shortlist of the
-- name they map to, and `poster-families.test.ts` asserts that invariant.
--
-- `circles.tags` is NOT touched. Production circles carry only Film, Music,
-- Art, Literature, Dance, 'Art & Design' and 'Technology & Making' — none of
-- them a retired EVENT_CATEGORIES name. The last three were never filterable
-- and still are not; the rest keep working, and Literature actually becomes
-- filterable for the first time because it is in the new list. Nothing to fix
-- here, and the two '& '-joined tags are a separate drift to raise with Lara
-- rather than to guess at.
--
-- ⚠️ NOT APPLIED. Written 2026-08-18 by an unattended run that was explicitly
-- forbidden to touch production. `supabase db push` is banned in this repo;
-- apply this deliberately, by hand, after reading the mapping above.
--
-- Reversible in principle but not in practice: Concert/Therapy fold into
-- Music/Wellbeing and Service/Job are deleted outright, so the pre-migration
-- values cannot be recovered from the post-migration array. Take a backup of
-- `select id, categories from events where categories is not null` first if
-- that matters.

-- ---------------------------------------------------------------------------

begin;

with alias(old, new) as (
  values
    ('Workshop',         'Workshops'),
    ('Social Movements', 'Social movements'),
    ('Coach',            'Coaching'),
    ('Wellness',         'Wellbeing'),
    ('Meet',             'Meet Ups'),
    ('Education',        'Learning'),
    ('Therapy',          'Wellbeing'),
    ('Concert',          'Music'),
    ('Community',        'Neighbourhood'),
    ('Technology',       'Tech'),
    ('Nightlife',        'Clubbing'),
    ('Dance',            'Performing Arts'),
    ('Exhibition',       'Exhibitions'),
    ('Service',          null::text),
    ('Job',              null::text)
),
remapped as (
  select
    e.id,
    coalesce(
      (
        -- Group by the mapped value, keep its earliest position, re-emit in
        -- that order: de-duplicates without disturbing which category comes
        -- first (which is the one the poster engine reads).
        select array_agg(d.val order by d.first_pos)
          from (
            select t.val, min(t.pos) as first_pos
              from (
                -- NOT `coalesce(a.new, u.cat)`: an alias row whose `new` is
                -- NULL means "drop this value", and coalesce cannot tell that
                -- apart from "no alias row matched", so Service and Job would
                -- survive. Test the JOIN itself instead.
                select u.pos,
                       case when a.old is not null then a.new else u.cat end as val
                  from unnest(e.categories) with ordinality as u(cat, pos)
                  left join alias a on a.old = u.cat
              ) t
             where t.val is not null
             group by t.val
          ) d
      ),
      '{}'::text[]
    ) as new_categories
  from events e
  where e.categories is not null
    and exists (select 1 from alias a where a.old = any (e.categories))
)
update events e
   set categories = r.new_categories
  from remapped r
 where r.id = e.id
   and e.categories is distinct from r.new_categories;

-- Guard: nothing may be left carrying a retired name. Fails the transaction
-- loudly rather than reporting success over a partial rewrite.
do $$
declare
  stragglers int;
begin
  select count(*) into stragglers
    from events
   where categories && array[
     'Workshop','Social Movements','Coach','Wellness','Meet','Education',
     'Therapy','Concert','Community','Technology','Nightlife','Dance',
     'Exhibition','Service','Job'
   ]::text[];

  if stragglers > 0 then
    raise exception 'category rename incomplete: % events still carry a retired name', stragglers;
  end if;
end $$;

commit;
