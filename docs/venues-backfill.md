# Venues backfill — the plan, and what it will actually produce

**Status: NOT RUN.** Every number below was measured read-only against
production on 2026-08-18. Nothing in this document has been executed, and
the migration it depends on
(`supabase/migrations/20260818000000_venues_and_favourites.sql`) is not
applied either. Apply the migration first, by hand, then run step 1, then
read the review section BEFORE step 2.

---

## The short version

Running the backfill on today's data produces **67 venues** from **159 of
the 172 events**. It is more accurate than the brief feared — the aggregator
turns out to write only four distinct location names, not a swamp of
variants — but it is also **less useful than 67 suggests**, because 22 of
those venues have no coordinates and so never appear on the map.

**45 venues will actually be visible.** That is the number to judge this by.

The normaliser merges exactly **one** pair of names on today's data, and
that pair is junk test data which the recommended query excludes anyway. In
other words: *automatic de-duplication contributes essentially nothing here.*
The real duplicates need a human, and they are listed below.

---

## Measured, on production, read-only

| | |
|---|---|
| Events total | 172 |
| — machine-imported (`source IS NOT NULL`) | 96 |
| — human-posted | 76 |
| Events with a usable `location_name` | 163 |
| Events with no `location_name` | 9 |
| Events soft-hidden (`visibility = 'invite_only'`) | 6 |
| Distinct raw `location_name` values | 71 |
| Distinct values after normalisation | 70 |
| **Venues created (recommended query)** | **67** |
| — with coordinates, i.e. actually on the map | **45** |
| — address-only or nothing, invisible on the map | **22** |
| **Events linked to a venue** | **159** |
| Events left with `venue_id IS NULL` | 13 |

### The imports are not the problem

The brief expected feed spelling variants to be the main source of mess. They
are not. All 96 imported rows resolve to just **four** venues:

| Venue | Events | Source |
|---|---|---|
| Privatclub Berlin | 51 | `tina:jsonld` |
| Il Kino | 43 | `tina:jsonld` |
| Arena Halle | 1 | `tina:ics` |
| YAAM | 1 | `tina:ics` |

Each has exactly one spelling and one address. The `"Privatclub Berlin"` vs
`"Privatclub"` collision the brief warned about **has not happened yet** —
the normaliser handles it (both slug to `privatclub`), but today it is
insurance, not a fix.

### What the normaliser actually merges

Stripping a leading/trailing "Berlin" rewrites **11 of the 71** names and
merges **zero** of them. The only merge on the whole dataset is:

```
"Test"  +  "TEst"   →   test
```

…which is junk, and which the recommended query drops anyway because both
rows are `invite_only`.

---

## The duplicates a human has to rule on

The normaliser deliberately will **not** merge these. Names that share a
first word are frequently different places, so guessing is worse than
leaving them apart — but four of these families look like genuine
duplicates. None of them can be resolved from the data alone; they are
Aidan's or Lara's call.

| Names | Coordinates? | Likely verdict |
|---|---|---|
| `Kraftwerk Berlin`, `Kraftwerk Halle`, `Kraftwerk Mitte` | none of the three | **probably one venue** (3 → 1) |
| `Babylon Berlin`, `Babylon Kino` | only the first | **probably one venue** (2 → 1) |
| `silent green`, `silent green Kulturquartier` | neither | **almost certainly one venue** (2 → 1) |
| `Arena Halle`, `Arena Neukoelln` | only the first | unclear — Arena Berlin is in Treptow, so these may be different |
| `Factory Berlin Mitte`, `Factory Berlin Görlitzer Park` | both | **genuinely different** — two branches, keep apart |
| `Studio 8 Berlin`, `Studio Eins`, `Studio Eslage`, `Studio Orbit`, `Studio Yard Berlin` | mixed | **genuinely different**, keep apart |
| `Berlin Painting Studio`, `Berlin Philharmonie` | mixed | **genuinely different** |
| `Haus der Statistik`, `Haus der Stillen Wolken` | neither | **genuinely different** |

If the four "probably one venue" calls go the merging way, 67 becomes about
**63**.

### Do NOT try to merge on proximity

I tested it. Every pair of distinct venues within 150 m of each other in the
real data is a genuinely different place:

| Pair | Apart |
|---|---|
| Astra Kulturhaus / Badehaus | 18 m |
| Birgit & Bier / Factory Berlin Görlitzer Park | 81 m |
| Kühlhaus Berlin / Station Berlin | 144 m |

Astra and Badehaus are both inside the RAW-Gelände; Kühlhaus and Station are
neighbouring buildings at Gleisdreieck. Berlin's venue density defeats
coordinate clustering — a 150 m radius would have merged three pairs of real,
distinct venues. **Name is the only safe key.**

---

## Step 1 — create the venues

Excludes `invite_only` events, matching the rule the feed already applies
(`getEvents` filters `visibility.is.null,visibility.eq.anyone`). That is what
keeps `Test` / `TEst` / `Park` out of the venue list without a hand-written
junk filter.

Picks the most-used spelling as the name, and takes coordinates from a row
that actually has them — independently, so a venue whose commonest spelling
lacks coordinates still gets placed on the map.

```sql
-- READ THE REVIEW SECTION ABOVE FIRST. Run inside a transaction.
BEGIN;

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
-- Coordinates come from any row that has them, preferring one that also
-- carries an address.
geo_pick AS (
  SELECT DISTINCT ON (slug) slug, address, lat, lng
  FROM slugged
  WHERE lat IS NOT NULL AND lng IS NOT NULL
  ORDER BY slug, (address IS NULL)::int
),
-- Fallback for the 22 venues with no coordinates at all: keep the address
-- if one exists, so they are still correctable later.
addr_pick AS (
  SELECT DISTINCT ON (slug) slug, address
  FROM slugged
  WHERE address IS NOT NULL
  ORDER BY slug
)
INSERT INTO public.venues (name, slug, address, lat, lng)
SELECT n.name,
       n.slug,
       COALESCE(g.address, a.address),
       g.lat,
       g.lng
FROM name_pick n
LEFT JOIN geo_pick  g ON g.slug = n.slug
LEFT JOIN addr_pick a ON a.slug = n.slug
ON CONFLICT (slug) DO NOTHING;

-- Expect: INSERT 0 67
SELECT count(*) AS venues,
       count(*) FILTER (WHERE lat IS NOT NULL) AS mappable
FROM public.venues;
-- Expect: 67 | 45

COMMIT;
```

`created_by` is left NULL deliberately — these venues were derived from data,
not typed by a person, and NULL is the honest record of that. Note the RLS
consequence: **a NULL-owner venue cannot be edited or deleted by any app
user**, only through the SQL editor or the service role. That is the right
default for machine-derived reference data, but it does mean venue editing in
the app will do nothing for these 67 until an owner or a curation policy is
decided. Flagged as a deliberate open question, not an oversight.

## Step 2 — link the events

```sql
BEGIN;

UPDATE public.events e
SET venue_id = v.id
FROM public.venues v
WHERE e.venue_id IS NULL
  AND public.venue_slug(e.location_name) = v.slug;

-- Expect: UPDATE 159 (plus up to 6 more if you did NOT exclude
-- invite_only in step 1 — the link step does not filter on visibility,
-- on purpose: a hidden event still belongs to its venue.)
SELECT count(*) FILTER (WHERE venue_id IS NOT NULL) AS linked,
       count(*) FILTER (WHERE venue_id IS NULL)     AS unlinked
FROM public.events;
-- Expect: 159 | 13

COMMIT;
```

The 13 unlinked rows are 9 events with no `location_name` at all and 4 whose
only name was junk/hidden. That is correct — an event in someone's flat has
no venue, and `venue_id IS NULL` is a permanently valid state.

## Step 3 — merging a duplicate, if you decide to

Do this **before launch**. `saved_venues` is empty until users start
hearting; once it is not, a merge has to move hearts too and can hit the
composite primary key. The pre-launch version is trivial:

```sql
BEGIN;

-- Example: fold "Kraftwerk Mitte" into "Kraftwerk".
UPDATE public.events
SET venue_id = (SELECT id FROM public.venues WHERE slug = 'kraftwerk')
WHERE venue_id = (SELECT id FROM public.venues WHERE slug = 'kraftwerk mitte');

DELETE FROM public.venues WHERE slug = 'kraftwerk mitte';

COMMIT;
```

If hearts already exist, insert them onto the surviving venue with
`ON CONFLICT DO NOTHING` before the delete — the `ON DELETE CASCADE` on
`saved_venues.venue_id` would otherwise throw those favourites away silently:

```sql
INSERT INTO public.saved_venues (user_id, venue_id, saved_at)
SELECT user_id, (SELECT id FROM public.venues WHERE slug = 'kraftwerk'), saved_at
FROM public.saved_venues
WHERE venue_id = (SELECT id FROM public.venues WHERE slug = 'kraftwerk mitte')
ON CONFLICT (user_id, venue_id) DO NOTHING;
```

## Step 4 — the 22 invisible venues

They have a name and sometimes an address, but no coordinates, so they are
absent from the venues map. Nothing automated can fix this; it needs
geocoding, which this repo does not currently do server-side. Options, in
increasing effort: leave them (they are still correct rows, and the events
still show in the feed); geocode the ones with an address by hand; or wire a
geocoding call into the create-venue path so new venues never land without a
point.

---

## Honest assessment

**What works well.** The identity function is conservative and correct — it
merges case, whitespace, punctuation, umlaut spelling and a trailing
"Berlin", and nothing else. It will not silently fuse two real venues, which
is the failure mode that would be visible to users and hard to undo once
hearts point at the wrong place.

**What it does not do.** It does not solve de-duplication, because on this
data there is almost nothing to solve automatically — the mess is four
judgement calls, not seventy string variants. Anyone reading "67 venues from
172 events" as a de-duplication win is reading it wrong; the aggregator was
already clean, and the human-posted rows are mostly one-event-one-venue.

**The number that matters is 45.** Two thirds of the backfilled venues will
be on the map, one third will be invisible until someone geocodes them. If
the venues map mode looks sparse on first run, that is why — it is a data
gap, not a bug in the mode.

**Risk of running it.** Low and reversible. Step 1 only inserts; step 2 only
sets a column that is NULL everywhere today. To undo:
`UPDATE public.events SET venue_id = NULL; DELETE FROM public.venues;` — but
only while `saved_venues` is still empty, because deleting a venue cascades
its hearts away.

---

# APPLIED — 2026-08-19

Steps 1–3 ran against production as
`supabase/migrations/20260819120000_venues_backfill_and_merges.sql`.
Measured after, not predicted:

| | |
|---|---|
| venues | **62** (67 created, 5 folded) |
| mappable | **45** |
| no coordinates | **17** |
| events linked | **159** of 172 (13 correctly unlinked) |
| `saved_venues` | 0 — so the merges cost nobody a favourite |

## Aidan's ruling, and the one to revisit

The first name in each family survived: **Kraftwerk Berlin**, **Babylon
Berlin**, **silent green**, **Arena Halle**.

⚠️ **Arena is the uncertain one.** His words: *"im pretty sure all of these are
one except for the last one."* Arena Berlin is in Treptow and `Arena Neukoelln`
may be a different place. The undo is at the foot of the migration file and is
trivial while `saved_venues` stays empty — it stops being trivial the moment
anyone hearts a venue.

## ⚠️ The 17 venues that need a double-check

They have a name, sometimes an address, and no coordinates — so they exist,
their events show in the feed, and they **never appear on the venues map**.
Sorted by how many events they hold, so the top ones are worth the most.

| Venue | Events | Address to geocode from |
|---|---|---|
| Kraftwerk Berlin | 3 | — none |
| silent green | 2 | Gerichtstrasse 35, 13347 Berlin |
| Eislicht Kino | 1 | — none |
| Haus der Statistik | 1 | Karl-Marx-Allee 1, 10178 Berlin |
| Haus der Stillen Wolken | 1 | — none |
| Kino Neue Sicht | 1 | Luckenwalder Str. 3, 10963 Berlin |
| Kulturfabrik Westend | 1 | — none |
| Kunsthaus Kreuzberg | 1 | — none |
| Berlin Painting Studio | 1 | — none |
| Preussenpark | 1 | — none |
| Spreelounge Rooftop | 1 | — none |
| Studio Orbit | 1 | — none |
| Studio Yard Berlin | 1 | — none |
| Tattoo Pop-Up Showroom | 1 | — none |
| Tempelhofer Feld | 1 | — none |
| The Spree-Sphere Virtual Stage | 1 | — none |
| Toepferei Kreuzberg | 1 | Oranienstrasse 142, 10969 Berlin |

**Only 4 of the 17 carry an address**, so geocoding fixes a quarter of the
problem at best. The other 13 need a human to say where the place is — and two
of them (`The Spree-Sphere Virtual Stage`, and arguably `Preussenpark` and
`Tempelhofer Feld`) may not want a pin at all.

**The real fix is upstream:** the in-app create flow accepts a location name
without geocoding it, which is also why 27 community events have no coordinates.
Wiring geocoding into the create path stops the list growing; this table is the
backlog it already produced.

## Still open, deliberately

`created_by` is NULL on all 62 — they were derived from data, not typed by a
person, and NULL is the honest record. RLS consequence: **no app user can edit
or delete them**, only the service role. Correct default for machine-derived
reference data, but venue editing in the app will do nothing for these until an
owner or a curation policy is decided.
