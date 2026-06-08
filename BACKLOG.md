# Sphaer — Backlog

Single source of truth for what to build next. The repo is worked on in
**checkpointed sessions**: one feature end-to-end per session, then human
review before the next. Future autonomous Claude sessions read the
`▶ UP NEXT` block, build it, update this file, hand back.

---

## How to use this file (for future sessions)

1. Start every session by reading `▶ UP NEXT` and skipping straight to the
   first item there. Do **not** re-grill decisions that are already locked
   in the item's spec.
2. While building, if you discover work that should be its own item, add it
   to the appropriate priority section below — *don't expand the scope of
   the current item*.
3. When the item ships:
   - Move it out of `▶ UP NEXT` into a new `## ✓ Shipped` section at the
     bottom (date + one-line summary + commit/PR link).
   - Promote the next two items from P0 into `▶ UP NEXT`, give them the
     full B-spec treatment (why / done-when / files / approach / open
     questions).
   - Commit `BACKLOG.md` changes in the same PR as the feature so the
     review captures both.
4. Items below `▶ UP NEXT` are **lightweight** — title + one-line why +
   done-when checklist. They get fleshed out only when promoted.
5. Priority sections (`P0`, `P1`, `P2`) are ordered — top item in each
   section ships first.

**Token budget guardrail (user request):** the human asked that we stop work
once daily Claude usage hits ~90%. We can't query usage directly. Be
conservative — prefer shipping one solid item to half-shipping two. If a
session feels like it's stretching past ~3 hours, stop and hand back.

---

## ▶ UP NEXT

### 1. Login → location-onboarding glitch

**Why.** Existing users who already completed location onboarding sometimes get
re-routed through `/location` after logging in. Looks broken at demo time and
makes returning users feel like the app forgot them.

**Approach.**
1. Trace the routing logic in `app/(auth)/login.tsx` line 57:
   `router.replace('/(tabs)/feed')`. The redirect to `/location` must be
   happening *inside* `(tabs)/_layout.tsx` or a profile gate based on a
   missing column.
2. Inspect `app/(tabs)/_layout.tsx` and any `useEffect` in screens that calls
   `router.replace('/location')`. Find the gate condition.
3. Hypothesis: the gate checks `profile.location === null` instead of an
   `onboarding_completed` boolean. OAuth signups skip onboarding entirely
   (signup.tsx lines 73-76), so for those users `location` is null and the
   gate fires. Confirm and fix.
4. Fix path A (cheap): add `onboarding_completed BOOLEAN DEFAULT FALSE` to
   `profiles`, set it to TRUE at the end of the existing onboarding flows.
   Gate checks that column.
5. Fix path B (cheaper): the location screen itself should bail early if
   `profile.location` is already set, regardless of how the user got there.
6. Test all four entry paths:
   - Email signup → onboarding → location → feed (should work today)
   - OAuth signup → location → feed (should work today)
   - Email returning login (currently broken intermittently — verify)
   - OAuth returning login (currently broken intermittently — verify)

**Done when.**
- [ ] Existing users who have completed onboarding NEVER see `/location`
      again after login (Google, Apple, email — all three)
- [ ] First-time signups still complete the onboarding flow as today
- [ ] A migration (if path A) or a guard (if path B) is committed
- [ ] Manual test plan covering the four entry paths documented in the PR

**Files likely touched.**
- `app/(tabs)/_layout.tsx` (gate logic)
- `app/location.tsx` (early-bail guard)
- `app/(auth)/login.tsx` (possibly)
- `supabase/migrations/<timestamp>_onboarding_completed.sql` (new — if path A)
- `BACKLOG.md` (move to Shipped)

**Open questions to answer at start of build session.**
- Path A vs B (DB column vs early-bail). Recommendation: A is more correct
  semantically, B is faster to ship. Maybe both — early-bail today, column
  in a follow-up.

**Out of scope.** Reset password, email verification re-enable, account
deletion — those are separate P1 launch-blocker items below.

---

### 2. Profile completion % + hide "Finish setting up profile"

**Why.** The "Finish setting up profile" CTA on the profile page persists
even after a user fills out every field. Looks broken at demo time, and
makes investors think users are stuck. Replacing it with a completion %
bar that hides at 100% turns a bug into a polish moment.

**Approach.**
1. Inspect the current "Finish setting up profile" component — likely lives
   in `src/components/profile/` or `app/(tabs)/profile/index.tsx`. Find where
   it's rendered and what data it uses.
2. Define `profile completion` as the percentage of these fields filled:
   `avatar_url, cover_url, bio, disciplines (≥1), location, about,
   experiences (≥1)`. ~7 dimensions → each worth ~14%. Adjust weighting if
   the design implies different importance.
3. Compute the percentage client-side in a memoised helper
   (`src/utils/profile-completion.ts`) that takes a `Profile` and returns
   `{ percentage, missing: string[] }`.
4. Wire the existing card to render:
   - Nothing at 100% (just unmount)
   - Progress bar + label "Profile {N}% complete — add {first 2 missing
     items as readable copy}" at <100%
5. Tap on the card → routes to Edit Profile (already exists), pre-scrolled
   to the first missing field if feasible.

**Done when.**
- [ ] `profile-completion.ts` helper exists with unit tests (or at least
      hand-tested examples in a comment block)
- [ ] Profile page card hides entirely at 100%
- [ ] At <100%, the card shows percentage + readable list of missing items
- [ ] Tap card → opens Edit Profile
- [ ] Demo-account profile (filled in via `seed-demo-data.ts`) shows >70%
      so the card doesn't dominate the demo profile

**Files likely touched.**
- `src/utils/profile-completion.ts` (new)
- `src/components/profile/<CompletionCard or similar>` (rename + behaviour)
- `app/(tabs)/profile/index.tsx` (gate the render)
- `BACKLOG.md` (move to Shipped)

**Open questions to answer at start of build session.**
- Which 7 fields exactly count toward completion? (Check Figma if it
  specifies; otherwise the list above is the recommendation.)
- Field weighting: equal (14% each) or weighted (avatar = 20%, bio = 15%,
  etc.)? Recommendation: equal weights for v1, weighted in a v2 pass.
- Does tapping the card route to Edit Profile or scroll within the profile
  page to a specific section? Default to Edit Profile route.

**Out of scope.** Edit Profile flow polish (separate P1 item below).
Notifications / nudges when profile is incomplete (could be a P2 add).

---

## P0 — Investor demo polish

Lightweight — one-line why + checklist. Promote to `▶ UP NEXT` with full
spec when scheduled.

### Whole-app Figma styling audit
Why: Investor demo will hit screens we never matched against Figma; visual drift makes the app feel half-finished.
Done when:
- [ ] Per-screen audit completed for: Feed list, Map, Mural, Event Detail, Profile, User Profile, Circle Detail, Inbox, Chat, Settings (each is a sub-session)
- [ ] Each audit produces a list of deltas → its own backlog item if non-trivial
- [ ] All `colors.*` and `spacing.*` references come from `theme.ts` (no hex inline)

### Empty state on other users' profile gallery
Why: Other-user profiles render nothing in the gallery tab if they have no images, which looks like a broken screen.
Done when:
- [ ] Empty gallery shows centered text "{display_name} hasn't uploaded any photos yet"
- [ ] Same pattern audited and applied to other empty-list locations (testimonials, past events, etc.)

### App-wide empty states audit
Why: Empty Feed / no-match search / zero notifications / etc. probably look like bugs today. Each one needs a copy + visual that says "this is intentional."
Done when:
- [ ] Walk every screen with a fresh account (no follows, no events, no messages) and screenshot every empty state
- [ ] Items emitted to backlog per missing empty state
- [ ] One reusable `<EmptyState icon title body cta?>` component in `src/components/ui/`

### Compress Figma-seed posters (perf follow-up to shipped item)
Why: The 15 imported Figma posters total 32MB on Storage (median ~2MB, largest 8MB). On cold-cache Mural mount, dimension prefetch is slow because `Image.getSize` downloads the full image. WebP at quality 80 would shrink this ~10×.
Done when:
- [ ] `sharp` (or `jimp` if sharp's native build is messy) installed as dev dep
- [ ] `scripts/import-figma-posters.ts` extended to convert each PNG to WebP before upload (output: `event-posters/figma-seed/<evt-id>.webp`)
- [ ] `mockEvents.ts` URLs updated to `.webp`
- [ ] Re-seed
- [ ] Mural cold-mount feels snappy (subjective — measure first-paint timing if needed)

### Add evt-startup poster (one missing seed)
Why: `evt-startup` ("Founders Meetup: Build in Public") still uses a picsum.photos placeholder because the Figma file only had 15 distinct posters. The 16th Figma asset was a 256×256 low-res placeholder.
Done when:
- [ ] Designer adds a 16th poster to the Figma file (or picks an existing rectangle/frame node as a substitute)
- [ ] Imported via `scripts/import-figma-posters.ts` (add to POSTER_MAPPINGS)
- [ ] `evt-startup.poster_url` updated in mockEvents.ts
- [ ] Re-seed

### Loading skeletons audit
Why: Several screens still show a raw `ActivityIndicator` mid-screen. The mural's shimmer skeleton looks better; spread the pattern.
Done when:
- [ ] Feed list cards have a skeleton
- [ ] Profile loading shows a skeleton (avatar + name + grid placeholders)
- [ ] Circles cards have a skeleton
- [ ] Event detail page has a skeleton hero + body

---

## P0 — Real bugs

(Login → location glitch is in `▶ UP NEXT`.)

### Audit other auth edge cases after the glitch fix
Why: Once the location-onboarding gate is rewritten we should sanity-check every related path.
Done when:
- [ ] Signup → email confirmation → first login (when email confirm is re-enabled)
- [ ] Password reset (when shipped)
- [ ] Session expiry → next app open → login
- [ ] OAuth cancel mid-flow

### MOCK_EVENTS retired (already in existing Profile v2 #19 — keep there)

---

## P1 — Core flows

### Messaging v1 (Realtime + read receipts) — DETAILED SPEC PRESERVED BELOW

The full Messaging v1 spec lives in the appendix at the bottom of this file
(was originally the `▶ UP NEXT` before investor polish became priority).
Decisions locked, ready to build when promoted back to UP NEXT.

### Events Near Me (location-based filter)
Why: User explicitly requested. A "Near me" pill on Feed/Map filters events within ~5km of current location.
Done when:
- [ ] `expo-location` permission flow on first tap of the pill
- [ ] Filter chip added to Feed and Map (reuses `feedFilters` AppContext)
- [ ] Service query: `events` within `ST_DWithin(lat,lng, user_lat, user_lng, 5000)` — or client-side haversine if PostGIS extension not enabled
- [ ] Empty state if zero events nearby ("No events within 5km — try expanding")
- [ ] Defaults to OFF (user has to tap to enable)

### Search across events
Why: Currently the Feed search bar filters client-side over the already-loaded set. Doesn't scale and misses events outside the loaded window.
Done when:
- [ ] Server-side `ilike` `.or()` query on title, description, location_name, categories
- [ ] Debounced (~300ms) so typing doesn't hammer Supabase
- [ ] Same client-side fallback when the search query is empty (lists newest events as today)
- [ ] Promoted from existing Activities v2 #11 to active when shipped

### Profile editing flow polish
Why: Profile fields are editable but the flow is rough — modal feels half-designed, no inline validation, save button placement.
Done when:
- [ ] Edit Profile screen matches Figma exactly (compare in the styling audit)
- [ ] Inline validation per field (display_name length, bio max chars, etc.)
- [ ] "Save" is disabled when nothing's changed; enabled + primary when something is

### Instagram-style unread message styling
Why: User explicitly requested. Read messages look identical to unread ones. Instagram bolds the unread sender name + preview, makes them white; reads them in gray.
Done when:
- [ ] `ConversationRow` reads its `unread` count and applies bold/white when > 0
- [ ] Same row reverts to medium weight + tertiary text color when unread = 0
- [ ] Unread count pill on the right edge of the row (replaces or augments the timestamp)
- [ ] Visual match against Instagram's exact look — reference an Instagram screenshot in the PR
- [ ] Blocked-by: Messaging v1 ship — requires `read_at` to be wired

---

## P1 — Launch blockers (App Store requirements)

### Account deletion
Why: App Store rejects apps that allow signup but no in-app account deletion.
Done when:
- [ ] Settings screen has a "Delete account" row with red text + double confirm
- [ ] On confirm: cascade delete events, profile, follows, saved_events, registrations, messages where sender_id or recipient_id = userId
- [ ] Auth user record deleted via service-role call (Supabase admin API)
- [ ] User signed out, redirected to landing
- [ ] PR includes the SQL for cascade and a test plan

### Password reset / forgot password
Why: Login screen says "forgot password?" linking nowhere. App Store reviewers will hit this.
Done when:
- [ ] "Forgot password" link on login screen routes to `/(auth)/reset-password`
- [ ] Screen collects email, calls Supabase `resetPasswordForEmail()`
- [ ] Email template in Supabase configured with a deep link back to the app
- [ ] Deep link route `/(auth)/update-password?token=...` lets user set new password

### Error boundaries on every screen
Why: A single crashed screen currently shows a white screen of death — no recovery, no error report.
Done when:
- [ ] Generic `<ErrorBoundary>` component renders a "Something went wrong" view with a "Try again" button
- [ ] Wrapped around every top-level screen in `app/`
- [ ] Crash payload logged to console for now (Sentry is a separate P2)

### Migrate from RN's `Image` to `expo-image`
Why: We hit a real bug today where RN Web's Image hides cached images on remount (the placeholder z-index issue from the mural launch). expo-image's web fallback handles this correctly + has better caching on native.
Done when:
- [ ] `expo-image` installed
- [ ] All `import { Image } from 'react-native'` replaced with `import { Image } from 'expo-image'`
- [ ] All `resizeMode="cover"` replaced with `contentFit="cover"` (API differs)
- [ ] Smoke test on iOS + web that posters still render correctly
- [ ] Remove the now-unnecessary wrapper bg color workaround in `MuralPoster.tsx`

### Apple Sign In (if Google Sign In is shipped)
Why: App Store rule — if you offer third-party sign-in (Google, Facebook), you must also offer Sign in with Apple. Otherwise reject.
Done when:
- [ ] Apple sign-in button on landing + login screens
- [ ] `expo-apple-authentication` integrated
- [ ] Supabase Auth Apple provider configured
- [ ] Same OAuth-skip-onboarding flow as Google

### Email confirmation re-enabled (already in existing Profile v2 #9)

---

## P2 — Soon (next quarter-ish)

### Push notifications via Expo Notifications
Why: Currently notifications only render in-app. Real engagement needs push.
Done when:
- [ ] `expo-notifications` setup + permission flow
- [ ] User push token stored in `profiles.expo_push_token`
- [ ] Edge function or trigger sends a push on new message, new follower, event reminder, new event from followed circle
- [ ] In-app preferences for which notification types to receive

### "Tonight" / "This weekend" / "Free" filter pills on Feed
Why: Most common filters users want. Reduces friction vs. opening category picker.
Done when:
- [ ] Three new pills next to category pills on Feed/Map/Mural header
- [ ] Each computes a date range or `is_free` filter client-side
- [ ] Mutex with each other (Tonight excludes weekend, etc.) — or stackable, design call
- [ ] Empty state when no events match

### Share event externally (deep links)
Why: Users want to share events to other apps; investors want to see organic viral growth.
Done when:
- [ ] Each event detail has a Share button → opens iOS/Android share sheet
- [ ] Shared link opens a web preview at `sphaer.app/event/<id>` with OG tags + "Open in app" button
- [ ] Universal links / app links wired so the deep link opens the native app if installed
- [ ] Same for circles and profiles (lower priority)

### Save/bookmark events synced
Why: Currently saved-events state is local (`AsyncStorage`). Reinstall = lost saves.
Done when:
- [ ] Existing `saved_events` table is the source of truth (it already exists)
- [ ] Save/unsave writes through to the table immediately
- [ ] Saved list view at `/(tabs)/profile/saved` (or similar)
- [ ] Optimistic UI matches existing pattern in `feed/index.tsx` toggleSave

### Pull-to-refresh on Mural
Why: Feed has it via FlatList's RefreshControl; Mural doesn't. Investors will try.
Done when:
- [ ] Vertical overscroll from top of Mural triggers refetch + dimension recompute
- [ ] Subtle indicator matches the rest of the app

---

## Backlog (later — months out)

- **Circle group chat** — v2 of Messaging spec. Schema already supports `circle_id` on messages.
- **Map clustering** — when zoomed out, group pins to avoid visual mess. `react-native-maps` supports this with a cluster wrapper.
- **Calendar export of saved events** — generate .ics file or deep-link to native calendar with event details prefilled.
- **Dark mode** — `theme.ts` is already token-based, so this is mostly a swap of color values + `useColorScheme()` hook.
- **Blocking / reporting users** — mute/block flow + report-to-mods. App Store may push back if absent given the social nature.
- **Analytics (PostHog / Mixpanel)** — track funnel: signup → first event view → first save → first message. Pick one.
- **Crash reporting (Sentry / Bugsnag)** — wire to error boundaries from the P1 item.
- **Accessibility audit** — VoiceOver labels on every interactive element, dynamic type support, color contrast spot-checks. Aim for WCAG AA before launch.
- **AI-generated event posters** — user mentioned this is coming. Designers can generate a poster from an event title/description. Hook `expo-image-manipulator` for client crop, openAI or Replicate for the gen, store dims at gen time (resolves the deferred `poster_width`/`poster_height` columns from the Mural session).
- **Onboarding tutorial** — first-time users see a 3-screen swipeable "what is Sphaer" intro before signup CTA. Helps investor demos especially.
- **Splash screen polish** — current splash is the Expo default. Custom Sphaer artwork matching the landing screen.
- **Profile image gallery editing** — long-press to delete, drag-to-reorder. Currently photos are append-only.

---

## ✓ Shipped

*Add shipped items here as they land: title, date, one-line summary, PR/commit link.*

- **2026-06-08 — Mural polish pass: 1.3× initial zoom + minimap + smooth filter relayout + 10 SVG-generated posters.** Initial mount now opens at scale 1.3× so the canvas clearly overflows in every direction — reads as "more wall to explore" instead of the previous "you can see everything." New `MuralMinimap` component at bottom-right shows the wall's outline with poster cells and a viewport rectangle that tracks pan/zoom; opacity fades 0.7→1.0 on active gesture (mirrors iOS scrollbar); tap anywhere on it to teleport viewport. Filter changes that resize the canvas now fade-dip opacity 1→0.25→1 over ~360ms so the snap reads as a transition. New `scripts/generate-svg-posters.ts` produces typography-driven posters (bigType / gradient / geometric / twoColor styles) via sharp; 10 new posters this batch — Rough Trade Night, Floh Kreuzberg, Who Owns the City, Void & Volume, Tresor 4-Floor, Riso Workshop, Das Programm, Berlin Zine Fair, Funkhaus Late, Cafe Lichtblick Open Mic. **39 events total** in the DB now.
- **2026-06-08 — Mural densification: +13 posters from Figma secondary pool, ~28 events total.** Pulled `imgRectangle4..14` + `imgFrame4`/`imgFrame7` from the original Figma export — these were a secondary pool of 13 high-res posters the first import pass skipped (it only looked at the `imgPoster*` slot). Visual confirmation: all 5 of the user's reference posters (Pictoplasma, Blues & Rhythm Festival, Type Craft Workshop, Berlin Collection Launch / Studio 8, Das Plakat MK&G) were *already in the Figma file* — no AI gen needed. Added new MOCK_EVENT entries for each (Toundra @ Bi Nuu, SXTN tour, Foreign Diplomats @ Badehaus, DSO Berlin / Santtu-Matias Rouvali, Margiana exhibition, The Bitter End, "thought about leaving" reading night, modular synth open lab, etc), each with embedded poster dimensions. Re-seed pushed 29 events to Supabase. Mural canvas grew from 585×789 to 740×840 — visible benefit: more posters per row, wall now feels meaningfully bigger to pan around. Branch: `funny-kare-983d2c`. AI gen item retired since the Figma pool covered it.
- **2026-06-08 — Mural sizing pass: Figma-correct dense layout + instant cold mount.** Band height dropped from `screenHeight/2` (~400px) to a fixed 140px (matches the Figma comp showing ~5 bands of ~93px-wide posters per iPhone viewport). `MIN_BAND_COUNT=3` keeps the wall from collapsing on small data sets. Cold mount now skips `Image.getSize()` entirely for figma-seed posters thanks to embedded `poster_width`/`poster_height` on each MockEvent — first paint is instant instead of waiting 10–15s for 32MB to download. Two CSS-stacking-context bugs fixed along the way: removed `backgroundColor` from both the canvas and each poster wrapper because RN Web's `<Image>` renders its picture at `z-index: -1`, which any parent `backgroundColor` painted over. Branch: `funny-kare-983d2c`. Follow-up: more posters via AI gen (now UP NEXT #1) — wall feels right but still small.
- **2026-06-08 — Figma poster import (15 designer-curated posters).** `scripts/import-figma-posters.ts` extracts posters from Figma file `HIVq6Vaymj01dZ37AvwCUF` via the Figma MCP, uploads to Supabase Storage at `event-posters/figma-seed/<evt-id>.png`, and `src/data/mockEvents.ts` updated for 15 of 16 events (`evt-startup` retains picsum until a 16th designer poster lands — tracked in P0). Verified: 15 rows in `events` table with figma-seed URLs; Mural visibly renders "Fire of Love" / "Typography Experiment" / etc. Branch: `funny-kare-983d2c`. Follow-up: WebP compression for the ~32MB total → see P0 "Compress Figma-seed posters."
- **2026-06-08 — Mural feature (2D pan-pinch poster wall).** Brick layout, pinch-zoom with focal point, web wheel-handler for trackpad pan/pinch, Feed/Map/Mural filter parity. Branch: `funny-kare-983d2c`.

---

# Appendix — Detailed specs (preserved from earlier sessions)

## Messaging v1 (decisions locked, ready to build when promoted)

Architectural calls already made (don't re-grill these next session, just build):

| Decision | Locked answer |
|---|---|
| Scope | **1:1 DMs first.** Circle group chat follows in a separate session. |
| Realtime | **Supabase Realtime subscription** on the `messages` table. Polling rejected. |
| Read state | **Full read receipts** (iMessage-style: "Read 2m ago" visible to sender). Unread count badge on inbox + Messages tab. |
| Mock data | Existing `src/data/mockMessages.ts` retired during build — replaced by real Supabase reads. |
| Entry points | Profile "Get in touch" button (currently shows Alert) → routes to `/messages/[id]` with that user. Plus a "+" on inbox to start a new chat (later). |

### Schema work needed (one migration)
`messages` table exists with `(id, sender_id, recipient_id, circle_id, content, created_at)`. For 1:1 read receipts add:
```sql
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS messages_recipient_unread_idx
  ON public.messages (recipient_id, read_at);
```
RLS for messages already exists (participants-only read, sender-only insert) — `read_at` UPDATE needs a new policy:
```sql
CREATE POLICY "messages_read_recipient_update" ON public.messages
  FOR UPDATE USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);
```

### Files that already exist (placeholder — to be replaced)
- `app/(tabs)/messages/index.tsx` — inbox with hand-curated mock list
- `app/(tabs)/messages/[id].tsx` — placeholder chat screen ("Chat coming soon")
- `src/components/messages/ConversationRow.tsx` — list row (visual, reusable)
- `src/data/mockMessages.ts` — mock conversations

### Files to build
- `src/services/messages.service.ts` — already exists for some helpers; add `getInbox(userId)`, `getThread(userId, otherUserId)`, `sendMessage`, `markAsRead(messageIds)`
- `src/hooks/useMessages.ts` — already exists; rewrite to subscribe to Realtime
- `src/components/messages/MessageBubble.tsx` — NEW. Tail-pointing bubble (Figma-matching)
- `src/components/messages/ChatComposer.tsx` — NEW. Text input + send button at the bottom of the chat screen, KeyboardAvoidingView

### Build order (one session each)
1. Migration + service helpers + types
2. Inbox real data + Realtime subscription for new-message badges
3. Chat detail screen with bubble list + composer + Realtime + mark-as-read
4. Wire profile "Get in touch" to route to chat. Add unread badge to Messages tab in BottomNav

### Out of scope for v1
- Circle group chat (follows in v2 — schema already supports `circle_id`)
- Search within messages
- Media attachments
- Voice notes / reactions
- Push notifications (separate feature)

---

## Profile v2 — Deferred items

These were considered during the profile/auth real-data build (May 2026) and
explicitly cut from v1 scope to keep that ship-able.

### 1. Verified badge

- Green checkmark next to display name on the profile hero.
- Visible in Figma, scaffolded in mock data (`MockProfile.verified`).
- **Cut reason:** no decision yet on who grants verification (admin-only? auto?).
- **When we come back:** add `verified BOOLEAN DEFAULT FALSE` to `profiles`, render
  the badge in `ProfileView` when true, set it manually via the Supabase
  dashboard for trusted creators.

### 2. "Available for work" toggle

- Bottom bar with green pill ("Available for work · Prenzlauerberg") + "Get in
  touch" CTA at the bottom of the profile.
- **What shipped in v1:** the bar renders as a placeholder for every user (no
  toggle), neighborhood is editable, "Get in touch" shows a "Coming soon" alert.
- **What's deferred:** the actual toggle column + filter logic.
- **When we come back:**
  - Add `is_available_for_work BOOLEAN DEFAULT FALSE` to `profiles`.
  - Add a toggle row in `ProfileForm` (Edit Profile).
  - Only render the bottom bar when the toggle is true.
  - Add a "Browse available creators" filter chip somewhere in feed/circles.

### 3. "Get in touch" → real DM bootstrap

- Right now the button shows `Alert.alert('Coming soon', 'DMs are not wired up yet.')`.
- **Cut reason:** DMs themselves are still mock-data only (`/messages/[id]` is a
  placeholder screen). Hooking the button up requires building the DM thread
  layer first.
- **When we come back:** after `messages` table reads/writes are wired with
  Supabase Realtime, the button does
  `router.push('/messages/new?recipient=' + profile.id)` or similar.

### 4. Likes + comments on gallery photos

- The `profile_images` table shape is already correct for this (one row per
  image, stable IDs).
- **What shipped in v1:** gallery grid only, no like/comment UI.
- **When we come back:** add `profile_image_likes (user_id, image_id)` and
  `profile_image_comments (id, image_id, author_id, content, created_at)`
  tables, photo detail page, heart icon on thumbnails, comments list +
  composer, notifications on like/comment.

### 5. Photo detail page (with captions)

- The `caption` column is in the `profile_images` schema but no UI surfaces it.
- **When we come back:** tap a gallery thumbnail → opens a photo detail page
  → owner can edit caption inline, others can like/comment (see #4).

### 6. Testimonials

- Profile page shows "No testimonials yet" empty state.
- **Cut reason:** other-user-writes-on-your-profile is its own moderation /
  approval flow.
- **When we come back:** add `testimonials (id, profile_id, author_id, content,
  is_approved, created_at)` table with owner-approval workflow before display.

### 7. Migrate other users' public profiles (`/user/[id]`) to Supabase

- Personal profile (`/(tabs)/profile`) is real-data backed.
- Other users' profiles still read from `mockProfiles.ts` via
  `getMockProfileById()`.
- **When we come back:** swap the `useEffect` in `app/user/[id].tsx` to call
  `getProfile(id)` from the service, fall back to a 404 state if not found.

### 8. Public profile handles (username / @lea_weber)

- The `username` column exists and is `UNIQUE`, but signup no longer collects it.
- **Cut reason:** chose simpler "display_name only" model for signup (Q2 in
  grilling). Profile URLs use UUIDs for now.
- **When we come back:** add a "Claim your @handle" prompt in Edit Profile,
  reserve URLs like `sphaer.app/user/lea_weber` once a user claims one.
  Useful prerequisite for @mentions in messages.

### 9. Email confirmation

- Turned off in the Supabase dashboard for now so signup → onboarding works in
  one shot.
- **When we come back (before public launch):** turn confirmation back on, add
  `/(auth)/verify-email.tsx` interstitial that polls `getSession()` or listens
  to `onAuthStateChange`, only routes to onboarding once a session appears.

### 10. Avatar cropping UI

- v1 uses `expo-image-picker`'s built-in `allowsEditing: true` (basic 1:1 crop).
- **When we come back:** a proper cropping experience with pinch-to-zoom,
  rotation, etc. — probably via `react-native-image-crop-picker` or a custom
  reanimated implementation.

---

## Activities v2 — Deferred items

Cut from scope during the May 2026 activity/circle real-data build to keep that
shippable for the investor demo.

### 11. Server-side full-text search

- v1 search is client-side filter over fetched rows (see grilling Q6c).
- **Cut reason:** the seeded data set is small (~25 events, ~32 circles).
  Client filter is instant.
- **When we come back:** when feeds exceed a few hundred rows, switch to
  `.or()` queries with `ilike` across multiple columns. For really large
  scale, add a Postgres `tsvector` column on `events.title || description`
  with a GIN index.

### 12. "Attended" status / check-in flow

- The `event_registrations` table has no status enum (hard-delete on cancel,
  see grilling Q3b) — there's no way to mark someone as "they showed up."
- **When we come back:** add `attended_at TIMESTAMPTZ` column. A QR-code
  check-in flow or organizer-driven "mark attendee" toggle sets it.

### 13. Private circles

- `circles.is_public` exists but every circle created today is forced to true.
- **When we come back:** expose a toggle in Create Circle. RLS for private
  circles needs a "members only" SELECT policy that's not yet written.

### 14. Activity edit & delete UI

- `events.service.ts` has `updateEvent()` and `deleteEvent()` but no UI surfaces them.
- **When we come back:** Edit button on the activity detail page (visible only to creator).

### 15. Profile count drill-down

- Tapping "Activities · 12" on the profile page does nothing.
- **When we come back:** route to a list view (created + registered events for that user).

### 16. Circle cover image upload

- Create Circle form only collects an avatar. `circles.cover_url` stays null
  except for seeded mocks.
- **When we come back:** add a second image picker to Create Circle and to
  Edit Circle. `uploadCircleImage()` already supports `kind: 'cover'`.

### 17. Lat/lng auto-resolution from address

- Address is collected but `lat`/`lng` are null. Map view can't pin user-
  created activities until these are filled in.
- **When we come back:** Google Places Autocomplete + geocoding. New env var
  `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` already exists.

### 18. Notifications on new activities from followed circles

- `notifications` table exists with type='circle_event', no producer wired.
- **When we come back:** Postgres trigger on event INSERT that fans out
  notification rows to all followers of the event's circle.

### 19. Mock data fully removed

- `src/data/mockEvents.ts` and `src/data/mockCircles.ts` are still imported
  by the seed script.
- **When we come back:** once the seeded data has been replaced by real user
  content (post-launch), delete the mock files + the seed script.

### 20. Activity edit from Create flow + draft saving

- Closing Create Activity halfway loses everything.
- **When we come back:** persist drafts in AsyncStorage so the user can
  resume; or add a "Save as draft" button + `events.status = 'draft'`.

---

*Add new deferred work above this line. Keep each entry short: why it was cut,
what the future shape looks like.*
