# Sphaer — Backlog

**Single source of truth for what to build next.** Rebuilt from scratch
**2026-08-18** because the previous revision was last written **2026-06-17**
(`7d40eda`) and 26 commits had landed since — its `▶ UP NEXT` was pointing a
future session at a June Figma decision and knew nothing about July or August.

> **Every status in this file was checked against the code on 2026-08-18**, not
> against another document. Where the code could not settle it, the item says
> **UNVERIFIED** and why. An honest "could not confirm" beats a confident guess —
> this file has been confidently wrong before.
>
> The old file's full prose (every shipped item written out at length) is not
> lost: `git show 7d40eda:BACKLOG.md`. Everything still *open* in it has been
> re-filed below.

---

## ▶ UP NEXT — as of 2026-08-18

Three items. All three are **decided** — do not re-grill them, build them.
Ordered: ship 1, then 2, then 3.

### 1. Every Share button in the app hands people a dead link (P0, S)

**Why.** `src/services/share.service.ts:25` sets `SHARE_BASE_URL =
'https://sphaer.app'`, and every share payload — event (`:29`), circle (`:34`),
profile (`:39`) — is a URL on that host. **`sphaer.app` 404s.** So the app's
entire sharing surface currently sends a broken link, and the whole point of
this week is *"something we can really share to people."* This is the cheapest
high-value fix on the list.

**Already decided** (grill, 2026-08-17): *custom scheme `sphaer://` NOW,
universal links built up in parallel.* The scheme half already works —
`app.json` sets `"scheme": "sphaer"` and `src/lib/linking.ts` already parses
`sphaer://circles/x`, `sphaer://event/x`, `sphaer://user/x` (`:8`, `:68`,
`:97`). Nothing new has to be invented; the share payload just isn't using it.

**Done when.**
- [ ] Share payloads carry a link that actually resolves for the recipient —
      `sphaer://…` for someone with the app, and honest copy for someone
      without it (do not silently hand out a 404).
- [ ] `shareEvent` / `shareCircle` / `shareProfile` all covered, plus the
      ticket screen's `handleInviteFriends`, which delegates to `shareEvent()`.
- [ ] A test asserts the payload contains no bare `https://sphaer.app/` URL
      while that domain is unserved.

**Files.** `src/services/share.service.ts`, `src/lib/linking.ts`,
`app/(tabs)/circles/[id].tsx:330`, `app/event/[id].tsx`, `app/ticket/[id].tsx`.

**Not in scope.** Standing up `sphaer.app`, the AASA file, `assetlinks.json`,
`associatedDomains` — that is the universal-links half and it is blocked on
Aidan (domain + Apple account). Filed under BLOCKED ON AIDAN.

---

### 2. Circle permission tiers + all-members-post (Lara #6) (P0, M)

**Why.** The last unbuilt point on Lara's list that is fully decided. Circles
today have exactly one boolean, `circles.is_public`
(`20240101000000_initial_schema.sql:27`), and **`app/(tabs)/create/circle.tsx:110`
hardcodes `is_public: true`** — so every circle ever created is public and the
column has never varied. There is no tier, no picker, no member-post policy.

**Decided 2026-08-17 (verbatim).** *Three tiers — public / semi-public /
private — and **all members can post events**. Admins moderate, they do not own
posting.* This matches the app's anti-gatekeeping thesis; CLAUDE.md's hard rule
that circle membership is never a prerequisite for creating an event stays
intact — this is about posting *into* a circle, not about creating at all.

**Done when.**
- [ ] A migration replaces/extends `is_public` with the three tiers, **authored
      but NOT pushed** — see STANDING HAZARDS, apply one file at a time.
- [ ] SELECT RLS per tier: public readable by all; semi-public discoverable but
      contents member-gated; private invisible to non-members.
- [ ] An event may be attached to a circle by any **member** of that circle —
      today the only insert policy is `events_insert_own`
      (`auth.uid() = creator_id`), with no `circle_members` check at all.
- [ ] Tier picker in Create Circle + Edit Circle.
- [ ] Existing circles keep working: every current row is public, so the
      migration must default to public.

**Files.** `supabase/migrations/2026081x_circle_tiers.sql` (new),
`app/(tabs)/create/circle.tsx`, `src/services/circles.service.ts:10` (the
`.eq('is_public', true)` browse filter), `app/(tabs)/circles/[id].tsx`.

**Watch out.** `visibility: 'anyone' | 'invite_only'` already exists but it is
on **events**, not circles (`src/services/events.service.ts:164`,
`app/(tabs)/create/index.tsx:45,724`). Don't conflate the two; do decide how
they interact (a private circle's public event?) and record the answer here.

---

### 3. Apple Sign In (P0 store blocker — write it now, test it later) (M)

**Why.** The app ships Google sign-in, which makes Sign in with Apple
effectively mandatory at review. **Verified absent 2026-08-18:** no
`expo-apple-authentication` in `package.json`, no implementation anywhere.
Worse, `app/legal/privacy.tsx:18` already tells users they can sign in with
"Google / Apple" — the privacy policy promises a feature that does not exist,
and a reviewer reading the policy against the app can flag that on its own.

**Approach.**
1. `npx expo install expo-apple-authentication`; config-plugin entry in
   `app.config.js`.
2. `signInWithApple()` in `src/services/auth.service.ts`, mirroring
   `signInWithGoogle()` — Apple's native sheet, then
   `supabase.auth.signInWithIdToken({ provider: 'apple', token })`.
3. `AppleButton` in `src/components/auth/AuthControls.tsx`; render on
   `app/(auth)/index.tsx`, `login.tsx`, `signup.tsx`.
4. Same skip-onboarding routing as Google → `/(tabs)/feed`.
5. Non-iOS: render for consistency, no-op with an honest alert.

**Done when.**
- [ ] Button on landing / login / signup; flow returns a session and routes past
      onboarding.
- [ ] Written and typechecked. **Testing is blocked** — it needs the Apple
      Developer account, a Service ID, a Team ID, a Key ID and a signing key,
      plus the Supabase dashboard Apple provider. Write it, mark it
      write-complete, hand the test to Aidan.

---

## How to use this file (for future sessions)

The checkpointed-session contract is unchanged — it has been working and Aidan
works this way. What changed on 2026-08-18 is the shape of the sections below
it, and one hard new rule at the end.

1. **Start by reading `▶ UP NEXT`** and build the first item. Do not re-grill
   decisions already locked in the item's spec.
2. **Never build anything under `🟡 UNDECIDED`.** Those items are missing a call
   only Aidan can make. Silently building one wastes the work — the profile
   rework got built and rejected on sight the same day (`920ed0f` → `5446eb5`)
   for exactly this reason. Bring the question, don't guess the answer.
3. `🟢 DECIDED BUT UNBUILT` is the takeable pool. If `▶ UP NEXT` is empty,
   promote from there — P0 first — and give it the full spec treatment
   (why / done-when / files / not-in-scope).
4. While building, if you find work that should be its own item, **file it in
   the right section** — don't expand the current item's scope.
5. When an item ships: move it to `✅ SHIPPED` with the date, a one-line
   summary and the commit hash; promote the next item into `▶ UP NEXT`; commit
   this file **in the same session** as the feature.
6. **Status claims must be verified against code**, not against this file or the
   Obsidian notes. If you can't confirm it, put it under `❓ UNVERIFIED` and say
   what would settle it. This file was two months wrong once already.
7. **You do not push.** Sphaer is `push: false` — a shared repo (Aidan + Lara as
   co-creator, Rabon on design). Prepare branches locally; Aidan pushes.
   *(Note: `CLAUDE.md`'s git section still says "Direct merge to `main`" and its
   README section says "Never commit directly to `main`". Both predate
   `push: false`. Branch and stop.)*

**Token budget guardrail (Aidan's request).** Stop work around ~90% of the daily
Claude usage. Prefer one solid shipped item to two half-shipped ones. Past ~3
hours, stop and hand back.

---

## Status snapshot — measured 2026-08-18

| | |
|---|---|
| Branch | `prep/2026-08-17-buildable` — **20 commits ahead of `origin/main`, unpushed** |
| `main` | `57d9618` (2026-06-19), in sync with GitHub |
| `npx jest --ci` | **505 passed / 505 total, 33 suites**, exit 0 |
| `npx tsc --noEmit` | exit 0, zero errors |
| `npm run lint` | exit 0, zero problems — but see below |
| Migrations on disk | **24 files**; 3 dated `20260817` |
| Repo docs | `CLAUDE.md`, `BACKLOG.md`, `RABON-GLITCHES.md`. **No `HANDOFF.md`, no `DECISIONS.md`** — despite other notes referencing them. Visual evidence lives in `docs/mural-qa/`, `docs/poster-qa/`, `docs/profile-qa/`. |

**Lint's "zero problems" is narrower than it sounds.** `eslint.config.js`
ignores `dist/*`, `.tmp/*`, `.expo/*`, `.claude/*`, `supabase/*` and
`src/types/supabase.ts`. That is a deliberate, correct scope — `.claude/*` held
26 problems in an abandoned worktree nobody ships — but "clean" means `app/` and
`src/` are clean, not the whole tree.

---

## ⛔ STANDING HAZARDS — read before touching the database

**1. NEVER run `supabase db push`.** The local migration files and the live
database have completely diverged: **22 local files never applied remotely, 17
remote migrations with no local file, zero in sync** — against a production
database with real user accounts. A push would replay five months of schema
history onto a database that already has that schema.

**Apply migrations one file at a time:**
```bash
npx supabase db query --linked --file supabase/migrations/<one_file>.sql
```
Reconciliation, when it happens, starts from `supabase db pull` — never a push.

**2. ⚠️ `CLAUDE.md` still tells you to run the banned command.** It lists
`npx supabase db push` twice — once in Commands (line ~15) and once as step 4 of
Getting Started (line ~503) — with no warning anywhere. A session that reads
CLAUDE.md first, as it is instructed to, will be told to run the single most
dangerous command in this repo. **The ban currently exists only inside the three
August migration file headers.** Fixing CLAUDE.md is filed as a P0 below.

**3. `src/types/supabase.ts` is two months stale.** Last touched 2026-06-17,
hand-edited, and it knows about **14 tables** — not `bug_reports`, not
`blocked_users`, not `rate_limit_log`, all of which are live. Services touching
those tables carry documented casts. Regenerating is filed as a P1 below, and it
must happen *after* the schema drift is understood, not before.

---

## 🔴 BLOCKED ON AIDAN — no agent can do these

One line each, phone-actionable. Nothing in here is a code problem.

| # | What to do | Why it's blocking |
|---|---|---|
| A1 | **Start Apple Developer enrolment ($99/yr)** — identity verification runs 24–48h, so start it before anything else. | Gates Sign in with Apple, signing certs, App Store Connect, TestFlight. The longest clock on the project. |
| A2 | **Run `eas init`** in the repo once. | `app.config.js:41` deliberately leaves `extra.eas.projectId` unset with a comment explaining why — inventing one produces a config that looks complete and fails at the build server. EAS cannot build without it. |
| A3 | **Put a real Google Maps key in `.env.local`** — the value there is literally `placeholder_maps_key`. | The map is one of the three headline feed modes and it cannot work until a real key exists. `app.config.js` will now correctly interpolate it; the key itself is the only missing piece. |
| A4 | **Replace the blank seeded posters in Supabase Storage.** Run `npx tsx scripts/audit-posters.ts` to get the exact filenames — it measures visible pixels against production. | These files return HTTP 200, decode fine and paint nothing, so they reach the Mural as holes. Count is recorded as **7 in `scripts/audit-posters.ts`'s header and 8 in `docs/poster-qa/README.md`** — the repo contradicts itself; the script settles it. |
| A5 | **Apply `supabase/migrations/20260817200000_events_aggregated_source.sql`** with `npx supabase db query --linked --file <path>`. | Its header says **NOT APPLIED**. It is the schema half of the event scraper (Lara #2) and it is already written — see the DECIDED BUT UNBUILT entry. One command unblocks the whole feature. |
| A6 | **Verify the `delete-account` edge function is deployed** (needs an authorised Supabase session). | Apple hard-requires in-app account deletion. The UI and `supabase/functions/delete-account` both exist in the repo; if the function isn't deployed, tapping Delete Account errors — a guaranteed rejection. |
| A7 | **Flip two Supabase dashboard toggles**: enable leaked-password protection; allowlist the password-reset redirect URLs. | Reset emails dead-end without the allowlist. |
| A8 | **Restrict the Google Maps API key** in Google Cloud Console to bundle IDs `com.sphaer.app` (iOS + Android). | The key is bundled into the APK/IPA — unavoidable on Expo. Unrestricted, anyone can spend your quota. |
| A9 | **Serve `sphaer.app`** (it 404s) — a privacy-policy URL and a not-installed fallback page at minimum. | Both stores require a *public* privacy URL; the in-app pages don't satisfy it. Also the precondition for universal links. |
| A10 | **Supply the Test Martina Plantijn font files** into `assets/fonts/` (the directory does not exist). | Every serif heading falls back to Georgia, and generated posters set their titles in the system face. See the code half in P1. |
| A11 | **Give Rabon's answers** — Master Flow node id (icons), developer-page component (inbox type), and calls on R6 / R7 / R9. | Four design items are stalled with nothing an agent can act on. See UNDECIDED. |
| A12 | **Push `prep/2026-08-17-buildable`** (20 commits, still local). | `push: false`. Every push is yours. |
| A13 | **Pin the Mural supply plan (Lara #1 + #10)** with Lara — poster swapping cadence, circle images, how the wall stays fed. | The one point on Lara's list that has never had specifics. Code cannot proceed without them. |

---

## 🟢 DECIDED BUT UNBUILT — takeable work

Nothing here needs a new decision. Anything not in `▶ UP NEXT` is fair game.

### P0

#### Fix `CLAUDE.md`'s `db push` instructions — 10 minutes, highest damage prevented
Two lines in `CLAUDE.md` (~15 and ~503) still instruct `npx supabase db push`,
which is banned. Replace both with the `db query --linked --file` form and add
the divergence warning to the top of the file. **Not done in this rebuild
because the 2026-08-18 documentation task was scoped to `BACKLOG.md` only.**
Scope: XS. Do it first, in its own commit.

#### Event scraper (Lara #2) — the schema half is written, nobody knew
`supabase/migrations/20260817200000_events_aggregated_source.sql` exists on this
branch and is **not applied**. It adds three nullable columns to `events` —
`source`, `external_id`, `source_url` — with the safety property spelled out in
its own header: an import must be **re-runnable** (same feed twice updates one
row), **correctable** (a venue moving a door time changes the row it owns), and
**withdrawable wholesale** (`delete from events where source like 'tina:%'`
removes every aggregated listing and cannot touch a human-posted row, because
human rows have `source IS NULL`).

Both the Week Plan and the Publish Plan record this point as *"not started"*.
That is wrong — the hard part is written. Remaining:
- [ ] Aidan applies the migration (A5).
- [ ] Tina's aggregator writes ICS/RSS/JSON-LD rows in with `source = 'tina:*'`.
      **Not in this repo** — the decision was Tina aggregates externally and
      writes to Sphaer's Supabase. Verified: no ingestion/scraper/RSS/ICS code
      exists anywhere in `src`, `app`, `supabase/functions` or `scripts`, which
      is correct.
- [ ] Sphaer-side: decide whether imported events are visually marked, and
      whether `source_url` is surfaced on event detail. *(This sub-question is
      undecided — see UNDECIDED.)*
Scope: S in this repo, M in Tina's.

#### `__DEV__` auth bypass and its three spread accommodations
`app/(tabs)/_layout.tsx:35` still reads `if (!session && !__DEV__)`, and `:20`
disables deep-link recovery in dev. **This does not ship an open app** — Metro
folds `__DEV__` to `false` in production and preview builds, so the submitted
binary is safe. It matters for two narrower reasons: `eas.json`'s `development`
profile sets `developmentClient: true`, producing a binary where `__DEV__` *is*
true — hand that to a TestFlight tester and they get the app with no login wall.
And `app/(tabs)/profile/index.tsx` carries three accommodations for a signed-out
state production never reaches, one of which renders mock profile data from
`src/data/mockProfiles.ts`. Rip all of it out.
Scope: S–M.

#### The profile screen is the one data screen with no error surface
`app/(tabs)/profile/index.tsx` swallows both of its loads. The counts + gallery
fetch ends `.catch(() => { if (active) setGallery([]) })` (~:193) and the sheet
fetch ends `.catch(() => …setFollowers([]))` (~:148). A network failure renders
a profile with zero followers, zero circles, zero activity — indistinguishable
from a genuinely empty account. `ErrorState` already exists and is wired into
every other data screen.
Scope: S.

### P1

#### Regenerate `src/types/supabase.ts`
Stale since 2026-06-17; 14 tables, missing `bug_reports`, `blocked_users`,
`rate_limit_log`. `npx supabase gen types typescript --linked`. Then drop the
documented casts in `moderation.service.ts` / `events.service.ts` and the two
parallel COUNT queries in `getProfile()` (the denormalised
`followers_count` / `following_count` columns exist). Sequence this **after**
the migration drift is understood — generated types will reflect the live DB,
which is not what the local migration files describe.
Scope: S, but do it deliberately.

#### Load the display font (the code half of A10)
`app/_layout.tsx:75–91` has the entire `useFonts` block **commented out**,
waiting on the files. Uncommenting it is trivial; the files (A10) are the
blocker. Worth pairing: this is why generated poster titles set in the system
face rather than Martina Plantijn, and why every serif heading falls back to
Georgia.
Scope: XS once the files land.

#### New-conversation picker — the inbox `+` is still a dead stub
`app/(tabs)/messages/index.tsx:226` — a prominent dark primary CTA whose
`onPress` is `console.log('[Messages] new conversation')`. There is no
`/messages/new` route (`app/(tabs)/messages/` holds only `[id].tsx`, `circle/`,
`event/`, `index.tsx`). You can only DM by visiting a profile first. Filed since
2026-06-15 and again in the 07-13 recon and the 08-02 publish plan; the recon's
detailed build spec still stands.
Scope: M.

#### The "Favourites" filter chip always returns nothing
`app/(tabs)/messages/index.tsx:196` — `return []; // not implemented yet`.
It renders, it taps, it shows an empty inbox. Either implement favouriting or
remove the chip before anyone tests the app.
Scope: S either way.

#### Third-party avatar placeholders in the inbox
`app/(tabs)/messages/index.tsx:115,136,156` fall back to `picsum.photos` and
`i.pravatar.cc`. Live external image calls from a shipping app, and a privacy-
questionnaire complication at review. Replace with a local placeholder.
Scope: S.

#### Profile cover image — promised, schema-backed, still unbuilt
`profiles.cover_url` exists, the README promises "profile photo + cover image",
and `src/utils/profile-completion.ts:17` says in a comment that there's no
editor for it. No upload UI, no render. Circles have this; profiles don't.
Needs a 16:9 picker in `ProfileForm` + `uploadProfileCover` (mirror
`uploadCircleCover`) + a banner on own profile and `/user/[id]`.
Scope: M.

#### Manual pinning in circle group chats (the other half of Lara #5)
The pinned-events section shipped (`30cb98b`) and works, but **nothing is
pinnable by hand** — `src/components/messaging/PinnedEventsSection.tsx:32-33`
states it outright: *"pinned" means "an upcoming event of this circle"*, derived
from `events.circle_id`. There is no pin column or table in any migration.
Derived-upcoming is a defensible v1 and Lara's point ("so events don't get lost
in conversation") is substantially served — but if an organiser ever wants to
pin a specific thing, that is unbuilt and needs schema.
Scope: M. Confirm with Lara that derived-only is enough before building.

#### Circle group chat has no leave / report / moderation from inside
`app/(tabs)/messages/circle/[id].tsx` has no overflow menu at all — verified,
zero matches for leave/report/overflow. You can't leave the circle or report it
or report a sender from the conversation. DM threads got this in June.
Scope: S–M.

#### `Alert.alert` is a silent no-op on react-native-web — **22 files**
Found via the June signup bug: a 422 was alerted, so web users saw a dead
button. The auth credential screens were fixed (`d88e277`, inline
`FormErrorText`). **22 files still use `Alert.alert` for failure feedback** —
onboarding, verify-email, create-flow upload errors, profile mutations. Native
is unaffected. P1 rather than P2 now that a Vercel web build is the sharing
surface people actually see.
Scope: M.

#### Crash monitoring
`ErrorBoundary` logs to console only — production crashes are invisible. No
Sentry, no PostHog, nothing in `package.json`. Wire Sentry into `ErrorBoundary`
+ the global handler. *(Analytics vendor is a separate, undecided question.)*
Scope: M.

#### No un-save from the Saved list
`unsaveEvent()` exists and is called from the feed
(`app/(tabs)/feed/index.tsx:322`) and event detail (`app/event/[id].tsx:132`) —
but not from the Saved category in the Activities sheet.
`EntityListSheet`'s long-press is wired for the *user* variant only (`:186`).
Scope: S.

#### Disciplines never appear on the profile
Collected in onboarding and `ProfileForm`, and now rendered in artist search
rows (`src/components/feed/ArtistResultRow.tsx`) and `EntityListSheet` — but
**not in `ProfileView.tsx`**, the one place a user would look. Partly fixed
since this was first filed; the profile itself is still the gap.
Scope: S.

#### The inbox meatball is a dead stub advertising itself to screen readers
`app/(tabs)/messages/index.tsx:216` — `console.log('[Messages] options')` behind
`accessibilityLabel="Open options"`. Build a real menu (mark-all-read, message
settings) or remove it.
Scope: S.

#### R4 — inbox private⇄circle switch — **already done, re-filed as closed**
`RABON-GLITCHES.md` still lists R4 as 🔴 Open. The code has it: the inbox filter
row is `All / Unread / Favourites / Direct / Activities / Circles`
(`app/(tabs)/messages/index.tsx:40-56`, filtering at `:185-206`). Rabon's ask —
a switch between private and group chats — is satisfied. RABON-GLITCHES.md was
not updated by this rebuild (scope was `BACKLOG.md` only); someone should mark
it there too.

### P2

- **Saved-event reminders — producer + UI.** The `saved_events.reminder_at`
  column and its partial index shipped in June as forward-compat scaffolding;
  nothing reads it. Needs an optional timepicker on save (default 2h before) and
  a scheduled sweep (`pg_cron` or edge function) enqueuing `event_reminder`
  notifications.
- **Push notifications — the client half.** Producer triggers exist
  (`20260612040000_notification_producers.sql`, three of four types). Missing:
  `expo-notifications` (not in `package.json`), a `profiles.expo_push_token`
  column, the permission flow, the delivery edge function, and an in-app
  preferences screen. `event_reminder` is deliberately deferred to the job above.
- **Memo audit remainder.** Profile subtree (`ProfileCompletionCard`,
  `SettingsSection`); circle cards memoising handlers via `useCallback`.
- **Private circles (deferred item #13).** Superseded by UP NEXT #2 — the tier
  work is the general form of this. Keep the note: RLS for private circles needs
  a members-only SELECT policy that has never been written.
- **"Attended" / check-in (deferred item #12).** `event_registrations` has no
  status enum and hard-deletes on cancel. Would need `attended_at TIMESTAMPTZ`
  plus QR check-in or an organiser toggle.
- **Server-side full-text search (deferred item #11).** Client filtering is
  instant today. At a few hundred rows, move to `.or()` + `ilike`; at real
  scale, a `tsvector` GIN index on `events.title || description`.
- **Draft saving in Create Activity (deferred item #20).** Closing the form
  halfway loses everything. AsyncStorage draft, or `events.status = 'draft'`.
- **Onboarding consolidation 5 → 3 screens.** Fold `/location` into the
  onboarding form's final step.
- **Map clustering.** Group pins when zoomed out.
- **Profile gallery editing.** Append-only today; no delete or reorder in view
  mode.
- **Mock data removal (deferred item #19).** `src/data/mockEvents.ts` and
  `mockCircles.ts` are still imported by the seed script; `mockProfiles.ts` is
  still reachable via the `__DEV__` profile path (see P0). Delete once seeded
  data is replaced by real content.
- **`mockMessages.ts`** is an unused dev fixture — delete when convenient.

---

## 🎨 POSTER STUDIO — decided 2026-08-18, phased

**⚠️ This SUPERSEDES the 2026-08-17 scope line** that said one template, no
editor, "cut if it grows". Aidan reopened it deliberately and chose the full
destination: *"we can do option 3 first... however i want to expand this out to
be a fantastic inbuilt editor. i think it is a selling point for the app."*

**The build order is FORCED, not chosen.** AI variations of a user's own design
cannot operate on a bitmap — "make this more bold" applied to a PNG is a new
poster, not an edit. They need the poster to be a structured document. Sphaer
already has one: `PosterLayout` resolves every rect, baseline and font size and
is serialisable, and `assertLayoutIsPaintable` validates it before it can be
drawn. So: families -> persist the layout -> editor over the document -> AI
transforms of the document. Skipping to an editor that edits pixels forecloses
the AI half permanently.

**The references are already in the repo and had never been used.**
`scripts/seed-assets/posters/` holds TEN hand-authored posters demonstrating ten
different compositional systems. The generator drew on none of them; it solved
exactly one geometry. That, not colour and not repetition-in-the-abstract, is
why the output reads as templated.

### Phase 1 — IN BUILD (branch `feat/poster-families`)
- [ ] Three family solvers from the seed posters (Swiss two-block, rotated
      spine, full-bleed + inset panel), current composition kept as a fourth
- [ ] Per-family no-photo treatment — the four descending bars at
      `poster-template.ts:374` read as a loading skeleton and die here
- [ ] Selection by event category first, then hash; deterministic as now
- [ ] Palette collision fixed; palettes constrained per family
- [ ] Shuffle on the create screen
- [ ] Contact sheet of 12+ real posters in `docs/poster-qa/`, checked at
      thumbnail size — **a green suite is not evidence for this item**

### Phase 2 — the document model, then the editor
- [ ] **Persist `PosterLayout` with the event.** This is the real deliverable;
      the UI is the easy half and everything later depends on this one.
- [ ] Slot editor: text, image swap + crop, palette, family. Bounded controls
      over a solved layout — NOT a free canvas.
- [ ] Undo, and revert-to-generated.

### Phase 3 — AI as collaborator (first running cost)
- [ ] Variations of the user's OWN layout, three at a time, guard-validated
- [ ] Polish pass over an assembled poster (hierarchy, spacing, type ramp)
- [ ] Rate limiting + moderation decided BEFORE launch — reporting is open to
      any signed-in user, so generation would be too

### Phase 4 — the studio
- [ ] Free canvas, arbitrary elements, shapes, layer order
- [ ] User-saved templates; possibly community templates

**Cost named and accepted:** a new product surface in the week whose goal was
getting the app into people's hands. Phases 2–4 are weeks-to-months. A1 (Apple)
and A4 (blank posters) still outrank all of it — the families feed the same wall
that currently has holes in it.

**Revisit:** after the first wall of three families is looked at. If three do
not make the mural stop reading as generated, more families are not the fix and
the editor would be built on the wrong diagnosis.

Full design: the Poster Studio document, 2026-08-18.

---

## 🟡 UNDECIDED — needs Aidan's call. DO NOT BUILD.

Each of these is missing an answer only he can give. Building one on a guess is
how the profile rework got built and rejected inside the same day.

#### Feed filter affordance (Figma `4045:8204`) — open since June
The Figma feed puts a 45px rotated sliders/filter icon at the right end of the
Feed/Map/Mural toggle row, presumably opening a filter sheet. We ship a
Near me / Tonight / This weekend / Free chip row beneath the header instead.
**Adopt the sheet, keep the chips, or both?** Rabon's R10 asks for the same
thing from a different angle, and R10's other half — "tap the search bar,
categories appear" — is *already built* (`SearchFilterBar` only shows the
category row when `searchActive || hasSearchText || hasSelectedCategories`).
*This was the previous file's `▶ UP NEXT #1`. It is a question, not a task, and
it should never have been sitting where a session would try to build it.*
Figma access that works: fileKey `HIVq6Vaymj01dZ37AvwCUF` (`Sphaer_Prototype_RA`,
Pro-owned), explicit nodeIds only — never the Starter-capped copy
`iuCO8ENAhfYIJly1JGAeU1` or the giant board node `6239:6597`.

#### R9 — feed card: minimal or expanded? **Direct conflict with shipped code.**
Rabon: *"keep the activity title and A-sized poster… date, time and price"* —
anything more makes it noisy. But `src/components/feed/EventCard.tsx` currently
renders subtitle (`:74`), a 2-line description (`:79`) and "X going" (`:92`),
shipped as `#9 Feed card expanded` (`c84013b`). One of these has to give.

#### R7 — event-detail header has 8 icons; Rabon wants 2.
Verified in `app/event/[id].tsx`: edit (`:300`), trash (`:310`), people (`:320`),
ticket (`:330`), chat (`:340`), calendar (`:349`), share (`:357`), overflow
(`:380`). Rabon: keep Share + Save, move the rest to the profile or collapse
into `⋯`. Needs a call on which actions move where.

#### R6 — Message vs Following button mismatch on the event artist row.
Rabon questions whether the Message button belongs there at all. It was added
deliberately in June ("Message the host from an event"). Resize or remove?

#### R1 — Rabon redesigned the create flow in Figma.
An FYI, not a bug. Needs him to say *what* changed before any re-sync.

#### R3 (icons) / R5 / R12 — blocked on Figma references
R3's spacing half shipped; the icon swap needs the **Master Flow** node id.
R5 needs the **developer page** reference component for inbox fonts/spacing.
R12's title→subtitle gap was snapped to 4px; "incorrect" has no exact target.

#### R2 — DM composer "not centered"
Investigated: the composer *is* horizontally symmetric in code (padding 16,
input `flex: 1`, 8px gap, 36px button) and the web shell has no max-width frame.
Best guess is a **vertical** quirk — on web a multiline `TextInput` renders as a
`<textarea>` whose placeholder top-aligns. Needs from Rabon: left/right or
top/bottom, plus a fresh screenshot. Don't guess-fix the wrong axis.

#### R8 — adopt a 4-point grid everywhere
Large and cross-cutting: audit every gap/padding to multiples of 4. Worth doing
as its own scoped task, but confirm it's wanted before a repo-wide sweep.

#### Lara's Figma items still needing the team
- **#1 create-activity crashes / loses progress** — no static cause found; the
  ErrorBoundary catches a render throw and resets the form. Needs the exact
  error text or repro steps.
- **#3 back button dead after sign-up** — onboarding → location is one-way by
  design (`router.replace`, `gestureEnabled:false`). Needs a call: allow
  back-to-edit during onboarding, or rely on Edit Profile afterwards?
- **#4 "needs a comma"** — screen unclear; needs the screenshot. One-char fix.
- **#10 onboarding copy** — team still deciding; needs final wording.
- **#11 three vague notes** — "overlay here", "does this dropdown work + change
  the icon", "change things for pitching". Needs which screen / what.

#### Are imported (scraper) events visually marked?
Once `source`/`source_url` land, does the feed distinguish a venue-imported
listing from a human-posted one, and does event detail link out to the origin?
Product call. Also: the **RA ToS is still unread** and Sphaer is heading for
store review — the ICS/RSS position is settled, RA is not.

#### Booking / ticketing — the business question
Decided for MVP: **free to use, no money moves, RSVP + capacity only.** The
percentage cut is explicitly deferred to its own session. Don't build Stripe.
Schema already has `events.is_free`, `price`, `ticket_url`;
`registrations.service.ts` is RSVP-only.

#### i18n / German localisation
Berlin-first app, all copy hardcoded English (de-DE number formats already in
use). Needs a v1 language stance. If bilingual, ~40+ strings to extract via
`expo-localization` + `i18n-js`. Scope: L.

#### Analytics vendor
PostHog / none, per the no-tracking ethos. Crash reporting (above) is decided;
product analytics is not.

#### Storage bucket posture
All three public buckets are public-read. Posters and avatars are arguably fine;
decide whether profile-gallery should be signed-URL private before scale.

#### Soft-delete policy
Events / circles / messages are all hard-deleted; account deletion cascades
everything away. For future moderation and dispute resolution, decide now
whether `deleted_at` columns go in.

#### Contrast: `colors.neutral.meta` `#767779` measures 4.48:1 on white
Fails WCAG AA by 0.02. Verified still `#767779` at
`src/constants/theme.ts:29`. It's a Figma token, so darkening to ~`#727274`
deviates from the design source of truth. Passes AA-large at 3:1, and most uses
are large or decorative. Designer's call.

#### Circle detail — "From the community" posts (Figma `6274:7785`)
The frame shows post cards with Share / Save / "Get in touch". **No posts table
exists** — verified, no `circle_posts` anywhere. Needs a schema decision, or an
explicit drop from v1.

#### Dark mode
`theme.ts` is token-based so this is mostly a colour swap plus a refactor of
every screen to read via a `useColors()` hook. Not scheduled; confirm it's
wanted at all.

---

## ❓ UNVERIFIED — could not be settled from the code

Listed so nobody mistakes them for known facts. Each says what would settle it.

1. **Whether the two August bug-report migrations are actually applied to
   production.** Their headers say they were applied by hand and are live, and
   the feature demonstrably shipped — but that is the file's own claim, not an
   observation. *Settles it:* `npx supabase migration list --linked`, or a
   read-only query against `bug_reports`.
2. **Whether the June "9 pending migrations" are really all applied.** The old
   BACKLOG says all 9 went in on 2026-06-15 via the Supabase MCP. The August
   migration headers say 22 local files were never applied and 17 remote
   migrations have no local file. **These two claims are in tension** and I
   cannot reconcile them offline. Every June item marked "INERT until migration
   applied" — moderation/report-block, circle delete + member-kick RLS, event
   subtitle/spots/visibility, rate limiting, storage MIME caps,
   `profiles.verified` — inherits this uncertainty. *Settles it:* a migration
   list against the linked project.
3. **The blank-poster count: 7 or 8 of 50.** `scripts/audit-posters.ts`'s header
   says seven ("14% of the wall was literally invisible" — 14% of 50 = 7);
   `docs/poster-qa/README.md` says eight. The posters are not in the repo (they
   live in Storage; `scripts/seed-assets/posters/` holds 10 real PNGs, none
   blank). *Settles it:* `npx tsx scripts/audit-posters.ts`.
4. **"0 of 9 circle events are upcoming."** A live-data fact from the 08-17
   notes. Not checkable offline, and it matters — it is why the pinned-events
   section may look empty in a demo.
5. **Whether `delete-account` is deployed.** The function exists in the repo
   (`supabase/functions/delete-account`). Deployment needs an authorised
   session. See A6 — this is a guaranteed rejection if wrong.
6. **The poster generator has never run on a real iOS or Android device.**
   Stated plainly by its own author in `40f0af1`: the native capture path is
   reasoned from the Android/iOS source in `node_modules` and covered by tests,
   *not observed*. Web capture in real Chromium was verified and measured
   (`docs/poster-qa/`). A device run is the first thing to do in TestFlight.
7. **Google Maps key restrictions (A8) and the Supabase dashboard toggles (A7)**
   are console-side; nothing in the repo can confirm them.
8. **Whether the Vercel web deploy is current.** `scripts/deploy-web.sh` and the
   SPA-rewrite fix (`d38cdd0`) exist; the deployed state was not checked.

---

## ✅ SHIPPED

### 2026-08-17 → 18 — the Lara-week batch (all re-verified in code 2026-08-18)

Twenty commits on `prep/2026-08-17-buildable`, **unpushed**.

- **App buildable again** — `66565fe`. `app.json` → `app.config.js` (spreads
  `app.json`, so the diff stays small) with `runtimeVersion: appVersion`; env
  interpolation now actually works; `.env` added to `.gitignore`;
  `eslint.config.js` scoped so a stale worktree stops failing lint.
  `extra.eas.projectId` is deliberately left unset — see A2.
- **In-app reporting, open to any signed-in user (Lara #4 + #3)** —
  `e43e273` table + `bug-screenshots` bucket · `990bae8` screen ·
  `cfbeae9` + `011844b` type-aware form + triage · `836c803` → `caaf6cc` →
  `e3328cc` opening it up. `app/bug-report.tsx`; kinds and their field specs in
  `src/constants/report-kinds.ts` — **bug / feature / change, exactly one
  required field per kind**, which is what satisfies Lara's #3 "feedback
  template": uniformity enforced at entry rather than agreed by convention.
  Reached from the profile settings section (`BugReportRow`).
  ⚠️ **The lesson from that three-commit chain: the permission lived in FOUR
  places** — table RLS, storage RLS, the settings entry row, and the screen's
  own re-check. Opening three of them shipped a screen that rendered "Nothing
  here." to its own author.
- **In-app triage screen** — `app/bug-triage.tsx`, gated on
  `profiles.is_designer`. The real boundary is RLS
  (`current_user_is_designer()`, `bug_reports_select_designer` /
  `_update_designer`), not the client check. A `protect_is_designer` trigger
  blocks clients from granting themselves the flag, and column-level GRANTs mean
  a designer can only write status / reason / note / fix_prompt —
  **nobody can edit a reporter's words.**
- **Mural rendering fix (Lara #1, the render half)** — `3d8b7cb`.
  `src/hooks/useMuralLayout.ts` + `MuralCanvas` / `MuralPoster`: per-row
  justification to exact wall width (`TARGET_ROW_HEIGHT = 200`, aspect clamped
  0.5–1.9), poster recycling so sparse sets don't letterbox, and a placeholder
  tint instead of white holes. Driven in a real browser at 390×844 against live
  data and measured — evidence + repro in `docs/mural-qa/`.
- **Berlin neighbourhood dropdown** — `c4cb8fd`. `NeighborhoodSelectInput` —
  searchable, free text rejected — used by `ProfileForm`, which onboarding also
  renders, so both surfaces are covered by one component. The list is a curated
  **26 entries** in `src/constants/berlinNeighborhoods.ts` (plus 12 boroughs),
  not the ~96 official Ortsteile; that was the documented builder's choice.
- **Pinned events + mini-calendar above circle group chats (Lara #5)** —
  `30cb98b`. `PinnedEventsSection` / `MiniCalendarStrip` / `PinnedEventRow` +
  `useCirclePinnedEvents`, rendered in `app/(tabs)/messages/circle/[id].tsx`.
  **UI only — there is no pin column.** "Pinned" is derived from
  `events.circle_id`. Manual pinning is filed as P1 above.
- **Profile rework (Lara #7)** — `920ed0f` built a tab strip, **Aidan rejected
  it on sight**, `5446eb5` restored the original screen with the categories
  moved inside the Activities sheet. `saved` and `tickets` are gone from the
  `OpenSheet` union; Tickets is a **badge** on the row, not a tab
  (`ActivitiesSheet.tsx:125` — *"the badge is the whole reason there is no
  Tickets tab"*). Before/after evidence in `docs/profile-qa/`; the acceptance
  test is `v2-own-profile.png` vs `before-profile.png` being the same page.
- **"My circles" on the circles screen (Lara #8)** — `8b38622`.
  `MyCirclesSection` + `useMyCircles`, above the browse rows, refetched on join.
- **Poster generator (Aidan's addition, feeds Lara #10)** — `52076bb` wip +
  `40f0af1` + `937a2b7`. **One template, auto-filled** from the event's own
  title/date/time/venue, offered under the cover-image tile when nothing is
  attached; a picked photo always wins. `poster-template.ts` solves the layout
  and draws nothing; two renderers consume it —
  `GeneratedPosterCanvas` (react-native-svg, on device) and `sharp` in
  `scripts/qa-generate-poster.ts` — and a test asserts they cannot drift.
  Uploads to `events.poster_url`, which is exactly what the Mural renders.
  **The guard is the point:** nothing uploads without clearing a structural
  check and a byte check on the exact bytes going over the wire, because
  production already contains the failure it prevents.
  ⚠️ Never run on a real device — see UNVERIFIED #6.
- **Web deploy** — `d38cdd0`, SPA rewrite kept outside `dist/` so it survives a
  rebuild; one permanent URL instead of rotating tailnet links.
- **Test fix** — `5aff2dc`. `PinnedEventsSection` assumed two events five hours
  apart land on the same calendar day, so the suite failed every day after
  ~19:00. Now 505/505.

### Earlier — condensed archive

Full prose for everything below: `git show 7d40eda:BACKLOG.md`. Kept here as a
short index so nothing looks unfiled. All dates 2026.

**06-19** — Rabon audit, self-contained fixes: R3 toggle spacing 30px → 16px,
R11 search placeholder 17 → 15, R12 title→subtitle gap 2px → 4px (`57d9618`).
**06-18** — demo data: 10 curated posters (`dacb6af`), 10 rich poster-driven
events (`bfb65fa`), ghost galleries + circle linking (`1dea96c`), event media
gallery (`a8b2db1`), public-only feed (`c84013b`).
**06-17** — Lara's Figma audit pass: `100dvh` app shell (web scrollbar), growing
multiline `Input`, "Get Booked" → "Book", duplicate street removed, "Sub Title"
→ "Subtitle", address-autocomplete comma strip, Message-the-host from an event,
Instagram/LinkedIn social links, expanded feed card. Two items resolved as
*no change needed*: there is **no follow gate on messaging** (checked RLS,
triggers, client and `blockedIds`), and the circle avatar/cover both stay.
**06-15** — all 9 gated migrations applied (see UNVERIFIED #2); pull-to-refresh
on inbox / notifications / profile.
**06-12** — the big batch: real app icons + `eas.json` + env validation + store
metadata (`33bdd56`); report & block moderation (`51abfd7`/`121fc81`); real
Follow, cancel registration, creator attendee list (`8546173`); circle edit,
delete, member kick (`5a7ad34`); cold-start deep links (`4c1cc3a`); feed CTA,
Realtime foreground resume, 15s fetch timeout, console-noise sweep, DST recompute
(`c68ba48`); user search (`a8e0c2c`); create-activity full structural
replication; eslint 0/0 + doctor 19/19 (`24eb300`); web-app signup-error fix
(`d88e277`).
**06-11** — Figma structural follow-ups: greeting header (`5097fa3`), Welcome
interstitial (`632e064`), chat header bars, circle Organizer section, circle
cover upload (`44e53c6`), event edit/delete (`c4406a4`), ErrorState everywhere
(`f53344c`), accessibility sweep across 52 files, JSONB cast guards.
**06-10** — Figma styling audit complete, all 14 frames; test suite bootstrapped.
**06-09** — in-app Privacy + Terms routes; iOS permission descriptions;
notifications list screen; `ErrorState` primitive; skeletons; intro carousel;
long-press unfollow; upload MIME/size validation; enums; PostgREST sanitisation;
inline create-form validation; dead "Coming soon" UI removed.

---

## 📎 Appendix — preserved specs

Kept because they are still the reference for unbuilt work. Nothing here is
scheduled; items promoted out of it are already filed above.

### Profile v2 — still deferred
2. **"Available for work" toggle** — `is_available_for_work` column + a bar on
   `/user/[id]` for opt-in users. The own-profile version was removed in June
   (it asked you to message yourself).
3. **"Get in touch" → real DM bootstrap.**
4. **Likes on gallery photos** — new `profile_image_likes` table.
5. **Photo detail page with captions + comments** — new
   `profile_image_comments` table; notifications fan out to the gallery owner.
6. **Testimonials.**
8. **Public profile handles** (`@lea_weber`) — `username` exists in the schema.
9. **Email confirmation re-enabled.**
10. **Avatar cropping UI** — no `expo-image-manipulator` in the project today.

### Activities v2 — still deferred
11 (search), 12 (attended/check-in), 13 (private circles), 18 (circle-event
notifications — producer trigger exists, see P2 push), 19 (mock data removal),
20 (draft saving). All filed under P2 above with current evidence.

### Messaging v1
Shipped. The only unbuilt idea from that spec is an *embedded* chat tab inside
the circle page instead of navigation — not planned.

---

*File a new item in the section that matches its state — SHIPPED, BLOCKED ON
AIDAN, DECIDED BUT UNBUILT, UNDECIDED, or UNVERIFIED. If you don't know which,
it's UNVERIFIED.*
