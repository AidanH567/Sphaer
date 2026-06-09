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

### 1. Whole-app Figma styling audit (BLOCKED on Figma MCP rate limit; user may need to bump the seat or paste node IDs by hand)

**Why.** Investor demo will hit screens we never matched against Figma; a
piece of visual drift on any of them — wrong padding, hex inline instead of
a theme token, a font that doesn't match the display family — makes the
whole app feel half-finished even if the underlying logic is sound. This
item is a *meta* one: it kicks off per-screen sub-audits.

**Approach.**
1. Pick the 10 in-scope screens (one sub-session each, in this order):
   Feed list, Map, Mural, Event Detail, Profile, User Profile, Circle
   Detail, Inbox, Chat, Settings.
2. For each screen:
   - Open the matching Figma frame side-by-side with the running screen.
   - Walk top-to-bottom comparing spacing, font, color, radius, shadow,
     icon size, alignment.
   - Note every delta in a checklist. Trivial deltas (off-by-2 padding,
     wrong token reference) fix inline during the same sub-session.
     Non-trivial deltas (component restructure, missing feature) emit
     their own backlog item.
3. Lint pass: grep the screen's file(s) for hex literals (`#[0-9A-Fa-f]{3,8}`)
   and any spacing/font numbers that should be coming from `theme.ts`.
   Swap each to its token. Compare against `tailwind.config.js` to keep
   NativeWind and theme.ts in lockstep.
4. Each sub-session ships as its own commit referencing the screen.

**Done when.**
- [ ] Per-screen audit completed for: Feed list, Map, Mural, Event Detail,
      Profile, User Profile, Circle Detail, Inbox, Chat, Settings (each
      is its own sub-session and its own ship entry)
- [ ] Each audit produced either inline fixes or a new backlog item per
      non-trivial delta
- [ ] All `colors.*` and `spacing.*` references on those screens come from
      `theme.ts` (no hex inline, no magic numbers)

**Files likely touched.**
- All `app/(tabs)/*` and `app/event/[id].tsx`, `app/user/[id].tsx`
- `src/components/*` for shared components used on those screens
- `src/constants/theme.ts` if new tokens are needed
- `tailwind.config.js` to wire new tokens
- `BACKLOG.md` (move each sub-audit to Shipped, promote next two)

**Open questions.**
- Figma source-of-truth link — current spec doesn't carry one; check with
  the user before starting which Figma file/branch to audit against.
- Should the audit cover the modal sheets (CircleJoinSheet, etc.) or only
  the full screens? Default: full screens first, sheets as a follow-up.
- Is each sub-audit billable as its own session under the chain-features
  rule, or is the whole audit one ship? Treat each sub-audit as its own
  ship for the BACKLOG bookkeeping, but stay in the same session unless
  the user redirects.

**Out of scope.** Map-marker styling (the map has its own design layer),
typography font-file changes (the custom Martina Plantijn font is a separate
fonts-loading item).

---

### 2. Per-screen Figma sub-audit (start with Feed list)

**Why.** Once the Figma MCP rate limit resets (or the user upgrades the seat /
provides a node-id directly), the styling audit becomes 10 separate ship
items per the parent meta-spec. Feed list is the natural first since most
investor-demo eyeball-time lands there.

**Approach.**
1. Get the Figma frame URL for the Feed list (full screen — search bar,
   Feed/Map/Mural toggle, category chips, event card list). User to provide.
2. Pull design context via `get_design_context` MCP — Supabase-side
   `tailwind.config.js` + `theme.ts` should be the React-side source of
   truth.
3. Per-element compare: spacing, font size, font weight, color, radius,
   shadow. Note deltas.
4. Fix trivial deltas inline (off-by-2 padding, hex → token swap). File
   non-trivial ones to backlog.
5. Lint pass on `app/(tabs)/feed/index.tsx`, `src/components/feed/FeedHeader.tsx`,
   `src/components/feed/EventCard.tsx` for hex literals (`#[0-9A-Fa-f]{3,8}`)
   and magic numbers.

**Done when.**
- [ ] Feed list visually matches Figma at 375pt viewport (the demo width)
- [ ] No inline hex on the touched files; all colors through `colors.*` tokens
- [ ] Non-trivial deltas filed as separate backlog items
- [ ] Shipped entry references the specific Figma node IDs audited

**Files likely touched.**
- `app/(tabs)/feed/index.tsx`
- `src/components/feed/FeedHeader.tsx`
- `src/components/feed/EventCard.tsx`
- `src/components/feed/SearchFilterBar.tsx`
- `src/constants/theme.ts` (if new tokens needed)
- `BACKLOG.md` (move to Shipped, promote next two)

**Open questions.**
- Which Figma frame is the canonical Feed list? User to provide URL.
- Master flow page `2012:1670` covers many screens — we need a specific
  child node, not the whole flow board.

**Out of scope.** Map, Mural, Profile, etc. — those are separate sub-items.

---

## P0 — Investor demo polish

Lightweight — one-line why + checklist. Promote to `▶ UP NEXT` with full
spec when scheduled.

---

## P0 — Real bugs

### MOCK_EVENTS retired (already in existing Profile v2 #19 — keep there)

---

## P1 — Core flows

### Profile editing flow polish — Figma visual match (remaining slice)
Why: Inline validation + dirty-state Save shipped today. The "match Figma exactly" piece still needs the MCP rate limit to lift.
Done when:
- [ ] Edit Profile screen matches Figma exactly (paired with the Whole-app styling audit)

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

- **2026-06-08 — P1 Core flows: 5 items shipped in one pass.** State discovery first — the BACKLOG significantly understated progress, so the actual remaining slice across the section was much smaller than 5 fresh items. **Messaging v1 closed out**: codebase already had migrations (`20260601*`), `messages.service`, `useMessages` with Realtime subscriptions, chat detail screen with `formatSeenTime`-driven read receipts, and the Instagram-style BottomNav unread badge — the only residual was the misleading "Coming soon — DMs are not wired up yet" Alert on the own-profile placeholder bar, which is actually a Profile v2 #2 "Available for work" toggle concern; updated the alert copy to point at that instead. The real DM entry on `/user/[id].tsx` (`onMessagePress` → `router.push('/messages/${id}')`) was already correctly wired. **Instagram unread row styling** (newly unblocked): `ConversationRow` now switches name to bold + ink and preview to semibold + ink when `unreadCount > 0`; reverts to medium + meta-grey when zero. The existing count pill stays put on the right. **Search expansion + debounce**: extended `events.service.ts`'s title-only `ilike` to a PostgREST `.or()` across `title` + `description` + `location_name` + `address`, plus a new `useDebounce` hook wired through the feed at 300ms so typing doesn't fire one Supabase round-trip per keystroke. Verified the `.or()` syntax against the live DB ("public" search returns Founders Meetup + Studio 8 Berlin). **Profile editing flow polish**: added per-field validation (bio ≤80, about ≤600, website regex), wired `error` props through to the Tagline / About / Website Inputs, added a JSON-stringify `isDirty` guard that disables Save until the form has actually changed, and clear-field-error-on-edit so sticky errors don't fight the user. **Events Near Me**: added `nearMe?: boolean` to EventFilters + `userCoords` to AppContext; new `src/utils/geo.ts` with haversine + `NEAR_ME_RADIUS_KM = 5`; chip on the feed between header and list with three visual states (off / on / busy); first tap requests `expo-location` permission, caches coords, sets filter; client-side haversine in `visibleEvents` filters events with valid lat/lng (no-lat events pass through silently rather than disappearing); empty-state copy switches to "Nothing within 5 km — try expanding" when the filter is on. Chip renders correctly in preview; runtime permission grant is OS-mediated. Visual Figma match on Edit Profile carved off as a separate item pending the Whole-app styling audit. Branch: `funny-kare-983d2c`.
- **2026-06-08 — Feed list non-visual lint pass: 6 magic numbers → theme tokens.** Figma MCP still rate-limited (View seat on Professional plan), so I split the visual half of the Per-screen Feed sub-audit off as its own follow-up and shipped the structural half — the lint pass that doesn't strictly require Figma access. Audited the 4 Feed surface files (`app/(tabs)/feed/index.tsx`, `src/components/feed/FeedHeader.tsx`, `EventCard.tsx`, `SearchFilterBar.tsx`) for hex literals and magic font/radius numbers. `feed/index.tsx` and `FeedHeader.tsx` came back clean — all colour/spacing/font-size references already go through `colors.*` / `spacing.*` / `typography.*`. `EventCard.tsx`: `borderRadius: 8` → `radius.sm`, `fontSize: 20` → `typography.fontSize.lg`. `SearchFilterBar.tsx`: `fontSize: 17` ×2 → `typography.fontSize.md`, `fontSize: 15` → `typography.fontSize.base`, `fontWeight: '400'` → `typography.fontWeight.regular`. Each swap is byte-equivalent (the token literal values match the inline ones) so no visual change is possible. Remaining inline values are intentional Figma-specific gaps that don't map to existing tokens: `fontSize: 14` ×2 (between `sm: 13` and `base: 15`), `borderRadius: 18` and `borderRadius: 28` (no exact match in the radius scale), and the universal `shadowColor: '#000'` pattern (kept inline because the brand `colors.black` is `#0D0D0D`, not pure black). Visual comparison against Figma waits on the MCP rate limit reset — that piece stays in UP NEXT. Typecheck clean. Branch: `funny-kare-983d2c`.
- **2026-06-08 — Error boundaries on every top-level route.** New `src/components/ui/ErrorBoundary.tsx` exposes two surfaces: an `ErrorBoundary` class component for explicit subtree wrapping, plus a `makeRouteErrorBoundary(name)` factory that plugs straight into expo-router's per-route `export const ErrorBoundary = ...` mechanism. The same `DefaultFallback` view backs both — centred alert icon, "Something went wrong" headline, body copy, dev-only error.message under the body, chocolate "Try again" button that resets the boundary state. A short Node script swept 21 routes (`(auth)` × 4, `(tabs)` × 11, plus event/user/profile-edit/ticket/location detail screens) and added `import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary'; export const ErrorBoundary = makeRouteErrorBoundary('<slug>');` to each. Slugs are short and grep-friendly (`feed-list`, `event-detail`, `messages-circle`, etc.) so a future Sentry/Bugsnag wiring can group by them. First-pass script bug: my insertion heuristic put the new import on a blank line in the middle of multi-line imports, breaking syntax — fixed by a second-pass script that strips every occurrence and re-inserts after the last completed `from '…'` line. Verified the fallback by injecting a temporary `if (window.location.search.includes('crash=1')) throw …` into the feed screen and loading `/feed?crash=1`: fallback rendered exactly as designed, error detail visible in __DEV__, the bottom nav stayed functional (the rest of the app keeps working when one screen crashes), and the console got the tagged `[ErrorBoundary:feed-list]` payload. Temporary throw reverted before commit. Sentry/Bugsnag wiring stays a P2 follow-up. Branch: `funny-kare-983d2c`.
- **2026-06-08 — RN `Image` → `expo-image` sweep across 21 files.** Installed `expo-image@~55.0.11` via `npx expo install`. A short Node script peeled `Image` out of every `import { ... } from 'react-native'` line and added `import { Image } from 'expo-image'` alongside it, then renamed every `resizeMode="cover"` (7 JSX sites) to `contentFit="cover"`. Files touched: feed map, all three message threads, both circle screens, both create screens, event detail, conversation row, both circle cards, bottom nav, mural poster, avatar, circle activity card, chat bubble, event card, profile activity card, entity list sheet, circle join sheet, profile form, profile view, circle preview modal. `MuralPoster` comments updated to reflect that expo-image renders a real `<img>` on web (no more RN-Web `background-image: z-index -1` trick), so the wrapper-bg-color workaround note is gone — wrapper stays transparent for visual continuity but the constraint is lifted. `useMuralDimensions.ts` keeps the `Image.getSize()` static call from `react-native` deliberately: it's a metadata API, not a render path, and migrating it would require switching to expo-image's `loadAsync` which adds API surface without the rendering benefit. Typecheck clean. Feed list verified visually in preview (Open Mic / Funkhaus Late / Berlin Zine Fair posters all render correctly via expo-image). Mural dev-mode appearance unchanged from before the migration (same canvas-pan/zoom that puts posters outside the dev-mode visible strip). Branch: `funny-kare-983d2c`.
- **2026-06-08 — Email signup → onboarding form no longer intercepted by the (auth) redirect.** Bug filed during this morning's auth-edge-case audit: `signup.tsx` does `router.replace('/(auth)/onboarding')` after a successful `signUp()`, but on the same render cycle `(auth)/_layout` saw the new session and bounced the user to `/location` — the onboarding stack unmounted before paint and every new email signup landed in the app with only `display_name` set. Fixed via Option B from the spec: `(auth)/_layout.tsx` now reads `useSegments()`, detects when the active child route is `onboarding`, and falls through to the Stack instead of redirecting. Returning-user behaviour preserved — `profile.onboarding_completed=true` still goes to `/(tabs)/feed`, anyone else not on `/onboarding` still goes to `/location`. Verified in preview: navigating to `/onboarding` with no session now mounts the route (onboarding.tsx returns `null` because `!user`, but the empty render confirms the layout no longer intercepts — previously the URL would have bounced to `/location` instead). Trace walked through all four entry paths (email signup, OAuth signup, email returning login, OAuth returning login) — all land correctly. Branch: `funny-kare-983d2c`.
- **2026-06-08 — evt-startup poster ships: BUILD IN PUBLIC, deep teal + terminal-green accent.** Last picsum.photos placeholder on the figma-seed pool is gone. Added a new `startup` design to `scripts/generate-svg-posters.ts` using the existing `bigType` generator — deep teal bg (`#0F2A2E`), warm cream fg (`#F3EFE5`), terminal-green accent stripe (`#7AE07A`). Headline "BUILD IN PUBLIC" splits across two lines (BUILD / IN PUBLIC), subtitle "Founders meetup — 5-min demos, honest questions", meta "SAT 30 MAY · 18:00 · FACTORY GÖRLI". Re-ran the generator (50 KB PNG, 16 KB WebP) and uploaded to `event-posters/figma-seed/evt-startup.webp`. Swapped `evt-startup.poster_url` in `mockEvents.ts` from `picsum.photos/seed/sphaer-startup/800/900` to the new Supabase URL, added matching `poster_width: 800` / `poster_height: 1133` for the Mural prefetch path. Re-seeded; DB row confirms the new URL. Standalone render verified (BUILD/IN PUBLIC headline, accent stripe, meta line all crisp at 800×1133). All 39 figma-seed events now ship authored or generated posters. Note: event detail hero crops the middle of portrait posters — this is shared with every other event and is its own backlog item if it ever becomes a problem. Branch: `funny-kare-983d2c`.
- **2026-06-08 — Compress Figma-seed posters to WebP: 41.23 MB → 2.32 MB (94.4% saved).** Added `sharp@0.34.5` as devDep. Extended `scripts/import-figma-posters.ts` to pipe each downloaded PNG through `sharp(...).webp({ quality: 80 })` before upload — output path now `event-posters/figma-seed/<evt-id>.webp` with `Content-Type: image/webp`. Per-poster size log shows ratios between 24% and 79% of source; total drop is the headline number. Also extended `scripts/generate-svg-posters.ts` (the SVG-typography pipeline) to encode straight to WebP — was uploading PNG and would have been left out of the savings otherwise. Local `.png` cache + on-disk `.png` copy retained for debug visibility. Swapped all 38 figma-seed `.png` URLs in `mockEvents.ts` to `.webp` via a sed-style global replace. Re-seeded — DB now shows 38 events with `.webp` poster_url (the 39th is `evt-startup` still on a picsum placeholder, tracked as new UP NEXT #2). Verified on Feed list view: OPEN/Funkhaus Late/Berlin Zine Fair posters all render at full quality. One transient ORB-block on the first cold fetch of newly-uploaded SVG posters resolved on next reload (Cloudflare cache propagation). Old `.png` storage objects retained — cleanup is a future follow-up. Branch: `funny-kare-983d2c`.
- **2026-06-08 — Loading skeletons audit: SkeletonBlock primitive + Feed/Profile/Circles/Event/User skeletons.** Replaced the raw centred `ActivityIndicator` on five mid-screen loading paths with shimmer-pulsing skeletons that mirror the populated layout, so the swap to real data lands without a visual jump. New `src/components/ui/SkeletonBlock.tsx` is the single shimmer primitive — width/height/radius/delay props, opacity-pulse from 0.55 → 1 over 900ms (same cadence as Mural's existing SkeletonWall, deliberately matched so the app's loading feel is consistent everywhere). Four screen-level skeletons under `src/components/ui/skeletons/`: `EventCardSkeleton` (358×231 card with text-block placeholders + 163-wide poster block), `CircleCardSkeleton` (176×313 vertical card with circular image + title + counts), `ProfileSkeleton` (avatar + name + stats row + action button + section block + 3-up image grid), `EventDetailSkeleton` (320-tall hero + title + meta + organiser row + body paragraph). Wired in at: `app/(tabs)/feed/index.tsx` (4 EventCardSkeletons), `app/(tabs)/circles/index.tsx` (2 sections × 3 CircleCardSkeletons inside a horizontal ScrollView matching the populated structure), `app/(tabs)/profile/index.tsx` (ProfileSkeleton replaces both authLoading and extrasLoading spinners), `app/event/[id].tsx` (EventDetailSkeleton), `app/user/[id].tsx` (ProfileSkeleton). Each call site staggers the pulse via the `index`/`delay` prop so a grid of skeletons feels alive rather than flashing in lockstep. Visually verified the EventCardSkeleton via a temporary forced-true injection in the feed — title rows, meta lines, and poster block all render with correct sizes and the pulse is visible. In-flight button spinners (Follow toggle, save button) are preserved per spec. Imports of `ActivityIndicator` cleaned up from four files. Branch: `funny-kare-983d2c`.
- **2026-06-08 — App-wide empty states audit: Feed, Messages inbox, Circles browse all use `<EmptyState>`.** Walked every tab via a code inventory (preview can't simulate a fresh account in dev mode), classified each list-rendering screen, and replaced three plain-text empty branches with the screen-level EmptyState variant. **Feed** (`app/(tabs)/feed/index.tsx`) — "No activities yet" string → calendar-outline icon + "Nothing on right now" title + a body line explaining when the feed will fill, and a separate search-aware variant ("No matches for \"X\"") when a search query is active. **Messages inbox** (`app/(tabs)/messages/index.tsx`) — single "No conversations to show" line → tab-aware copy via a new `emptyCopyForFilter()` helper: All / Unread / Favourites / Direct / Activities / Circles each get their own icon + headline + body (e.g. Unread: "You're all caught up — Nothing unread, new messages will show up here"). **Circles browse** (`app/(tabs)/circles/index.tsx`) — already had an icon + line, refactored to use EmptyState for visual consistency. Orphan `empty`/`emptyText` styles removed from all three. Inventory subagent classified the remaining sites: Map / Mural / chat threads / circles detail / EntityListSheet — each already adequately handled (map has natural empty render, mural is mock-data-backed, chat threads are placeholder screens, circle detail uses inline italic hints, EntityListSheet renders centered text via its `emptyMessage` prop). Verified the Messages "All" tab empty state visually in the preview (chat bubble icon in soft circle + bold headline + centered body). Branch: `funny-kare-983d2c`.
- **2026-06-08 — Empty state on other users' profile gallery + sections; reusable `<EmptyState>` lands.** New `src/components/ui/EmptyState.tsx` with two implicit variants — inline (italic body, no icon, optional onPress) for section-level empties, and screen (icon + title + body + CTA + spaced) for the upcoming app-wide audit. Wired into `ProfileView` at four sites: Images section now always renders with "{displayName} hasn't uploaded any photos yet." (centred) when an other-user profile has no gallery rows; Experience section now shows a placeholder for both own-profile ("Add roles, residencies, and projects from Edit Profile.") and other-profile ("{displayName} hasn't added any experience yet."); Testimonials migrated from inline italic to EmptyState with name-personalised copy for other-user profiles; Activity section's empty placeholder is gated on `activitiesCount === 0` so we don't lie ("Anke Peters hasn't shared any activities yet" while stats say Activities: 1 — we just don't fetch the timeline list on /user/[id]). Orphan `emptyHint` style removed from ProfileView. Verified on Anke Peters (`db34aadd-9c59-44cc-af50-693c81de8f69`) — has experience, no images, no testimonials — all three empties render correctly. Branch: `funny-kare-983d2c`.
- **2026-06-08 — Auth edge-case audit: SIGNED_IN race fixed, /location belt-and-braces, email-signup-onboarding bug filed.** Audited the 4 entry paths plus session-expiry and OAuth-cancel after the `onboarding_completed` migration shipped. Found two issues. (1) `AuthContext.onAuthStateChange` re-fetched the profile on every event without flipping `isLoading` back to true — so after a fresh `SIGNED_IN`, the `(auth)` layout's gate ran for a frame against a stale `profile?.onboarding_completed=undefined` and routed returning users to `/location` before the new profile arrived. Fixed by discriminating on event type: `SIGNED_IN` flips loading; `TOKEN_REFRESHED` / `USER_UPDATED` / `INITIAL_SESSION` leave it alone (profile didn't change); `SIGNED_OUT` clears. (2) `app/location.tsx`'s early-bail only honoured the legacy AsyncStorage flag, so a reinstall user with `onboarding_completed=true` in the DB but no local flag would have been stuck on the prompt. Now bails if either signal is set, and migrates the legacy flag → DB column at the same time. Session expiry was already correct (supabase-js `autoRefreshToken: true` + the onAuthStateChange listener handles SIGNED_OUT cleanly). OAuth-cancel was already correct (`'cancelled'` substring check silences the alert; the browser modal makes multi-tap impossible). New backlog bug filed: email-signup-skips-onboarding-form (`(auth)/_layout`'s redirect overrides `router.replace('/onboarding')` before the form ever mounts). Branch: `funny-kare-983d2c`.
- **2026-06-08 — Profile completion % card replaces persistent "Finish setting up your profile" banner.** New `src/utils/profile-completion.ts` helper scores six fields (avatar_url, bio, about, location, disciplines, experiences) at equal weight and returns `{ percentage, missing }`. `cover_url` was dropped from the list because ProfileForm has no editor for it (counting it would cap real users below 100% with no fix path). New `src/components/profile/ProfileCompletionCard.tsx` renders the sparkles icon + "Profile N% complete" title + readable missing-fields subtitle ("Add a profile photo and a tagline") + a thin progress bar; returns `null` at 100% so the card unmounts entirely once the user is done. Replaced `ProfileIncompleteBanner` in `app/(tabs)/profile/index.tsx` and deleted the old file. Demo ghost profiles (`scripts/seed-demo-data.ts`) hit 100% (all six fields filled) so the demo profile shows no card. Visually verified at 33% completion via a temporary dev-fallback injection — title, subtitle, progress bar, and chevron all render as designed. Branch: `funny-kare-983d2c`.
- **2026-06-08 — Login → location-onboarding glitch fixed: server-side `onboarding_completed` flag.** Returning users were sometimes re-routed through `/location` after login because the old gate relied on an AsyncStorage flag that's local to a single install — reinstall, second device, or web-after-native silently wiped it. New migration `20260608000000_onboarding_completed.sql` adds `profiles.onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE` and backfills `TRUE` for any profile that already has a `neighborhood` or non-empty `location` (18 of 21 live rows). `app/(auth)/_layout.tsx` now gates on the new column — onboarded users go straight to `/(tabs)/feed`, first-timers still get `/location`. `app/location.tsx`'s `finishAndGoToFeed` writes the flag (and neighborhood) to the DB profile via `updateProfile()` and pushes the updated profile into AuthContext, so the next login skips the screen without ever mounting it. The legacy AsyncStorage flag is still read on mount as a fast-path migration: if it's set but the DB column isn't, the screen quietly upgrades the DB and bails. Types regenerated in `src/types/supabase.ts`; `mockEvents.ts` host-profile factory updated to include the required field. Branch: `funny-kare-983d2c`.
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
