# Lara's poster set as Sphaer showcase events

2026-08-18. 27 events inserted into production from Lara's 39-poster set, so the
Mural and the activity feed carry real artwork instead of empty tiles.

## Which posters, and why 27

```
39 files supplied
 -1  byte-identical duplicate  (…15_17_46 1.png and …15_17_46 1 (1).png, same md5)
 -10 already attached to live events (matched by perceptual hash, not filename:
     best dHash distance <= 7, next-best >= 17, so the mapping is unambiguous)
 -1  p17 'Voices of the Black Diasporia' - a screen capture with a play-button
     UI control baked into the corner, not a poster
----
 27 new events
```

## How the rows are shaped

- `creator_id` = the dedicated Sphaer profile `a5dfc2bd-f7c6-499b-8abf-55f51d142620`.
  Never a real person.
- `circle_id` = NULL on every row. `events_notify_circle_after_insert` fires
  `WHEN (NEW.circle_id IS NOT NULL)` and would push a notification to every follower
  of that circle. A NULL circle makes that impossible. Notification count was 21
  before and 21 after.
- `source` = NULL. These are Sphaer's own showcase content, so the
  'From the community' / 'Found around Berlin' filter files them under the former.
- `visibility` = 'anyone'.

The `on_event_created` trigger fires `WHEN (NEW.source IS NULL)` and self-registers
the creator into `event_registrations`. That is expected: registrations went 604 -> 631,
exactly +27, and it creates no notifications.

## Dates do not match the artwork

Most dates printed on the posters are in the past. An event with a past `starts_at`
shows up in neither the feed nor the Mural, so starts are spread across
2026-08-20 to 2026-10-12 instead - varied weekdays, evening-weighted, daytime for
markets and workshops. Printed times were kept where they made sense (flea market
11:00, ceramics 14:00, Eiswald 21:30). Accepted and known: the event date will not
match the date on the artwork.

## Posters

Uploaded to the existing `lara-2026/` prefix of the `event-posters` bucket under
clean slugs - never the original `Use AI Image Jun 12, 2026, 19_11_55 1.png` names,
whose spaces and commas are a lasting nuisance in URLs.

Each upload was verified by fetching its public URL and checking that the bytes
come back md5-identical to the local file, that the image decodes, that it is not
blank (the old bug returned HTTP 200 and painted nothing) and not below 300px.
27/27 passed. `npx tsx scripts/audit-posters.ts` then reported 120/120, 0 broken.

Gotcha for anyone scripting the CLI: `supabase storage cp` parses a Windows
absolute path as a URI scheme, so `C:/…` fails with
`LegacyStorageUnsupportedOperationError`. Pass a bare relative filename from the
source directory and use `--workdir` to point at the project.

## Known blemishes in the source artwork

These are AI-generated posters and several carry garbled text baked into the image.
Nothing here is fixable in the database; noting it so it is not rediscovered:

- p02 Illustrate - nonsense body copy, an opaque triangle over the artwork, and it
  is a crop out of a larger canvas. The weakest file of the 27.
- p22 Quantum / Mesh Interfaces - a framed poster-on-wall mockup with a mat and
  drop shadow, not a flat poster. Will read differently in the Mural.
- p25 Eiswald - printer crop marks and registration ticks are part of the file.
- p29 Berlin Open - the poster literally prints 'Fictional Tennis Tournament' and
  carries a BARENGIN.CO template credit.
- p30, p27, p28, p33, p38 - garbled or illegible filler text in side labels,
  marquees and footer blocks.

Venue names printed with obvious typos were corrected to the real Berlin places:
Tempenhofer -> Tempelhofer Feld, Kreezberg -> Kunsthaus Kreuzberg, BABLYON -> Babylon
Kino, ROOF ROP -> Spreelounge Rooftop, Luckennalder -> Luckenwalder Str. 3.

## Withdrawal

Removes exactly these 27 rows and nothing else. The self-registration rows go with
them via the `event_registrations` -> `events` foreign key.

```sql
delete from public.events where id in (
    '12cdbc24-14d2-4979-b154-8b147ab8e87c',
    'df71e61e-01c2-4917-8237-220dfa666f29',
    'bf90d942-6619-4abf-b465-a9f4e926c579',
    'b85943fb-7612-433f-a4fe-b7d91fad156f',
    '78b6b199-aef8-4156-8b45-f78177865d4d',
    'b2e78b04-4720-4d0b-864e-d4b2dfa6d28c',
    '416d786a-4a9a-4bd4-9770-9b5c45b93ddf',
    '592b4a96-7f02-4b64-bde1-eb6b662b9a4e',
    '566515a5-d7c5-4bc1-b9fe-5e77333553f4',
    'b4aae55b-9706-49a1-af64-e31544bf9b9e',
    '4b617a35-227c-4a64-b56a-1d1e56fd704b',
    '11ea9daf-812a-48dc-8d80-569da01f3c4a',
    '5ffa501c-6b71-4911-9c2e-9d05b62304fb',
    'd34f9cf1-bffc-445b-88f4-7ca097567c97',
    'edbd5bf3-d594-4871-a7a1-54f0e6aaa208',
    '935fe88a-abb3-466d-8699-484de68b569c',
    '767ea44b-c18e-4f8a-b098-3b7dc9b14af3',
    'cfc63290-153d-4110-b17e-758b9d5ee752',
    '142ed316-c33d-47e9-9d25-e7ed4063249c',
    '152855b4-f138-4d0e-9d76-57ab6f472678',
    '59ce527c-c30a-4fe4-a864-cce3ef33072a',
    '6bdbf634-3817-46b0-a2dc-b8c7a088d6f9',
    'e83701e9-bd27-45e9-a613-d06ef16a635a',
    '5b90f270-8cc5-411b-8b23-4af66084d034',
    'd7e03f56-4458-4825-ba02-8bb1bd4742f8',
    '3dcf0250-d6a6-4117-acf3-eeb62c7b7884',
    '61a34a2b-1898-4348-94aa-39911b0dbede'
);
```

The posters themselves, if they should also go:

```
npx supabase storage rm ss:///event-posters/lara-2026/<name>.png --linked --experimental
```

## Reproducing

`scripts/lara-poster-events.mjs` holds the event data and emits the insert.
It mints fresh UUIDs on every run, so the ids above - not a re-run - are the
authoritative record of what is in production.
