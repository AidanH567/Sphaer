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

### 1. Figma styling audit — 12 of 14 screens remaining

**Why.** Investor demo will hit screens we never matched against Figma; visual
drift on any of them makes the app feel half-finished even when the logic
is sound. Today we got the first 2 of 14 screens shipped before the Figma
MCP hit its Starter-plan total-calls cap. **The user said they will buy a
Figma subscription so this audit can resume at full bandwidth.** When the
rate limit lifts (either via the upgrade, a daily reset, or — worst case —
the Dev Mode paste fallback below), the remaining 12 ship per-screen as
their own commits per the standard workflow.

**Figma file (use this fileKey for every call):**
`iuCO8ENAhfYIJly1JGAeU1` — `Sphaer_Prototype_RA (Copy)` in user's drafts.
Verified working as long as the rate limit has bandwidth left.

**Already shipped (do NOT re-audit):**
- ✅ `2012:1757` — Splash Screen (1×1 placeholder PNG → Figma-matched
  splash.png via new scripts/generate-splash.ts). Commit `bf3cd71`.
- ✅ `2012:1683` — Tagline screen ("Your City. Your Sphaer."). Size
  24→26, "Your Sphaer." weight bold→medium on app/(auth)/index.tsx.
  Commit `bc36700`.

**Remaining queue (12 screens — user dropped these URLs in chat 2026-06-09):**

| # | Node ID | Likely screen (confirm via screenshot first) |
|---|---|---|
| 1 | `2012:1711` | Auth flow (3rd of 3 splash-flow screens?) |
| 2 | `5013:10790` | Sign Up form (Figma Sign Up Flow Screen 1.1 per existing comments) |
| 3 | `5013:10915` | Sign Up form variant 2 (per existing comments) |
| 4 | `2012:1787` | Location-onboarding prompt phase (per existing comments) |
| 5 | `5108:8379` | Location-onboarding searching/intermediate (per existing comments) |
| 6 | `2012:1797` | Location-onboarding "We Found You" (per existing comments) |
| 7 | `4045:8204` | Likely a feed/list screen — confirm |
| 8 | `2665:12253` | Likely an event detail or profile — confirm |
| 9 | `3491:2499` | Confirm via screenshot |
| 10 | `4025:5033` | Confirm via screenshot |
| 11 | `4484:10814` | Confirm via screenshot |
| 12 | `4025:5294` | Confirm via screenshot |

**Per-screen workflow.**
1. `get_design_context(fileKey: 'iuCO8ENAhfYIJly1JGAeU1', nodeId: <node>)`
2. Identify which React Native screen/component the Figma frame corresponds
   to — match by content (e.g. tagline frame → `app/(auth)/index.tsx`).
3. Compare per-element: spacing, font size/weight/family, color, radius,
   shadow, icon size, alignment. The Figma uses `Test_Martina_Plantijn` for
   display text — match via `typography.fontFamily.display`. Cream bg
   `#FFFFFF` ↔ `colors.white`. Chocolate ink `#2B2A27` ↔ `colors.neutral.chocolate`.
4. Trivial deltas (token swaps, off-by-2 padding, weight tweaks) fix
   inline. Non-trivial (component restructure, missing feature, new layout)
   file as their own BACKLOG item.
5. Commit per screen: `style(<screen>): match Figma <nodeId>` with a body
   listing the deltas. Push and merge to main per the standard solo-dev
   workflow in CLAUDE.md.
6. Update this BACKLOG entry's queue table (move shipped row into the
   "Already shipped" list above).

**Done when.**
- [ ] All 12 queued screens audited (2 already shipped → 14/14 total)
- [ ] Each shipped commit references its Figma node ID
- [ ] Non-trivial deltas filed as their own items in `P0 — Investor demo polish`
- [ ] `tailwind.config.js` and `theme.ts` stay in lockstep — any new token
      added on one side is mirrored on the other

**Rate-limit fallback.** If the user hasn't upgraded yet and the MCP is
capped, ask the user to open the frame in Figma's Dev Mode panel (right
side), copy the spec, and paste into chat. Audit against the paste, no
MCP calls needed. Slower but works.

**Out of scope.** Map-marker styling, custom font-file loading (separate
backlog item — Test Martina Plantijn is referenced via
`typography.fontFamily.display` but not loaded; falls back to system
serif until the .otf files land).

---

### 2. Apple Sign In (P1 launch blocker, conditional on Apple dev account)

**Why.** App Store policy: any app offering third-party sign-in (Google,
Facebook, etc.) MUST also offer Sign in with Apple — failing this is a
near-guaranteed reject at review. We already ship Google.

**Approach.**
1. Add `expo-apple-authentication` to the project (`npx expo install
   expo-apple-authentication`). Drop the Apple button onto the landing
   screen + login screen + signup screen, mirroring the existing
   `GoogleButton` in `src/components/auth/AuthControls.tsx`.
2. Add `signInWithApple()` to `src/services/auth.service.ts` — mirrors
   `signInWithGoogle()` but goes through Apple's native sheet, exchanges
   the identity token for a Supabase session via
   `supabase.auth.signInWithIdToken({ provider: 'apple', token })`.
3. Configure Supabase Auth's Apple provider (one-time dashboard work):
   add the Apple Service ID, Team ID, Key ID, and signing key.
4. Same skip-onboarding flow as Google — Apple users land straight on
   `/(tabs)/feed`.

**Done when.**
- [ ] Apple button on landing, login, signup.
- [ ] Sign-in flow returns a session and routes the user past onboarding.
- [ ] Manually verified on an iOS simulator/device (Apple sign-in is iOS-
      only at the OS level, but the button can render on Android/web for
      consistency — pressing it just no-ops with an "Apple sign-in is only
      available on iOS" alert).

**STOP CONDITION.** Apple Sign In requires an Apple Developer account
($99/year) + a Service ID configured in App Store Connect + a signing key
generated and downloaded from there. If the Apple dev account isn't set
up yet, file this as a blocked-on-credentials item and skip — the user
must register / configure those before any of this can be tested.

**Files likely touched.**
- `src/services/auth.service.ts` — add `signInWithApple()`.
- `src/components/auth/AuthControls.tsx` — new `AppleButton`.
- `app/(auth)/index.tsx`, `login.tsx`, `signup.tsx` — render the button.
- `package.json` — `expo-apple-authentication`.
- `app.json` — `expo-apple-authentication` config plugin entry.

---

## P0 — App Store launch blockers (audit 2026-06-09 — promote candidates)

These are submission-blockers, not polish. Each is a near-guaranteed App
Store / Play Store rejection. Promote to `▶ UP NEXT` before any other
P1 work once Apple Sign In + the Figma audit clear.

### ~~Privacy Policy + Terms of Service pages don't exist~~ — shipped as in-app routes 2026-06-09
Why (historical): `app/(auth)/signup.tsx` linked to `https://sphaer.app/privacy` and `/terms`; both 404'd. Shipped in-app `app/legal/privacy.tsx` and `app/legal/terms.tsx` via a new `<LegalScreen />` component; signup links now `router.push('/legal/...')` instead of `Linking.openURL` external. Follow-up if hosted external pages are needed for SEO / sharing: rewire to those URLs.

### ~~iOS permission descriptions missing from `app.json`~~ — shipped 2026-06-09
Why (historical): `app.json` only set `photosPermission` for image-picker. The Near-me filter uses `expo-location` and would have crashed at permission request time. Shipped: full `ios.infoPlist` entries for location, photo library (read + add), camera, notifications; new `expo-location` config plugin entry; Android `permissions` array. HIG-style copy ("Sphaer uses your X to do Y for you"). Future: re-verify on real iOS device when push notifications land and `NSUserNotificationsUsageDescription` is actually invoked.

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

(Account deletion is in `▶ UP NEXT` #2 as the Figma-blocked fallback work.)

### Apple Sign In (if Google Sign In is shipped)
Why: App Store rule — if you offer third-party sign-in (Google, Facebook), you must also offer Sign in with Apple. Otherwise reject.
Done when:
- [ ] Apple sign-in button on landing + login screens
- [ ] `expo-apple-authentication` integrated
- [ ] Supabase Auth Apple provider configured
- [ ] Same OAuth-skip-onboarding flow as Google

### Notifications list screen (data layer ready, UI missing)
Why: `src/hooks/useNotifications.ts` already exists and `notifications` table is set up, but there's no route to render the list. Every notification we produce (follows, event reminders, circle activity, new messages outside the unread badge) currently fires into a black hole.
Done when:
- [ ] New route `app/(tabs)/notifications/index.tsx` consuming `useNotifications()`
- [ ] Visual states for each notification `type`: 'follow', 'event_reminder', 'circle_event', 'message'
- [ ] Tap a notification → navigate to the right destination (profile / event / circle / chat)
- [ ] Mark-as-read on tap; bulk "Mark all read" CTA at top
- [ ] Bottom-nav entry (or surface inside profile if tab bar is full); badge on the icon for unread count

### ~~Permission Info.plist sweep (HIG copy)~~ — shipped 2026-06-09 (merged with P0 permission descriptions)

### Email confirmation re-enabled (already in existing Profile v2 #9)

---

## P2 — Soon (next quarter-ish)

### Push notifications via Expo Notifications (client half + producer half)
Why: Currently notifications only render in-app. Real engagement needs push. **Producer side is also missing** — even after the notifications-screen ships, no Postgres trigger fires on messages INSERT, follows INSERT, or events INSERT, so the in-app notifications list stays empty for new activity. The producer triggers are the bigger half of this item.
Done when:
- [ ] **Client:** `expo-notifications` setup + permission flow + `profiles.expo_push_token` column + storage
- [ ] **Producer:** Postgres triggers on `messages` INSERT (notify recipient), `follows` INSERT (notify followed user), `events` INSERT (notify followers of `events.circle_id` when set — see Activities v2 #18)
- [ ] **Push delivery:** edge function that reads `notifications` rows pending delivery and calls Expo Push API with the user's token
- [ ] Scheduled job for event reminders (N hours before `events.starts_at` for any user with that event saved)
- [ ] In-app preferences screen for which notification types to receive

### Saved-event reminders
Why: README promises saved events trigger reminders. `saved_events` has no reminder column and no scheduler. Pairs with push notifications.
Done when:
- [ ] Migration adds `reminder_at TIMESTAMPTZ NULL` to `saved_events` (or default to event.starts_at − N hours via a settings table)
- [ ] Optional timepicker when user saves an event (default: 2h before start)
- [ ] Scheduled edge function or pg_cron sweeps reminders due in the next 15 minutes → enqueues notifications → push handles delivery

### Inline form validation on Create flows (not Alert popups)
Why: `app/(tabs)/create/index.tsx` and `app/(tabs)/create/circle.tsx` use `Alert.alert('Title required')` etc. The rest of the app (signup, ProfileForm) uses inline per-field error state. Investors notice the inconsistency.
Done when:
- [ ] Convert `Alert.alert('Title required')` etc. on both create screens to per-field `error` prop on the `Input` component
- [ ] Match the dirty-state guard pattern from ProfileForm (Save disabled until form is dirty + valid)
- [ ] Visually verified parity with signup.tsx

### "Not found" + network-error recovery UX
Why: `app/event/[id].tsx`'s "Event not found" state has no back button. `/user/[id]` "Profile not found" too. Many data fetches show stuck `ActivityIndicator` if the request fails — no retry button. User gets dead-ended.
Done when:
- [ ] Reusable `<ErrorState />` in `src/components/ui/` with icon + headline + body + Retry button + optional Back button
- [ ] Wire into every detail screen's not-found path + every list screen's fetch-error path
- [ ] `useEvents` / `useCircles` / `useProfile` etc. expose an `error` state that screens can render

### ~~"Available for work" placeholder bar on own profile~~ — removed 2026-06-09
Why (historical): the bar's "Get in touch" CTA alerted "Coming soon" — meaning the user was being asked to message themselves. Removed entirely from `app/(tabs)/profile/index.tsx`. When Profile v2 #2 ships the actual `is_available_for_work` toggle, the bar will surface on `/user/[id].tsx` for users who opt in.

### ~~Ticket detail "Download as PDF" / "Send by email" placeholders~~ — removed 2026-06-09
Why (historical): both buttons alerted "Coming soon"; investor demo friction. Removed for v1; re-add when PDF gen (`expo-print`) + email-send (Supabase edge function) actually ship. Bonus: `handleInviteFriends` now delegates to the shared `shareEvent()` so the canonical URL + platform-tuned payload matches the rest of the app.

### Unfollow from the follower / following list
Why: `EntityListSheet` lists Followers and Following but has no per-row unfollow action. User must navigate to the profile and tap Follow again. Common iOS / Insta pattern is long-press → Unfollow.
Done when:
- [ ] Long-press (or swipe-left on iOS) reveals an Unfollow action
- [ ] Optimistic UI matches existing toggleFollow pattern in `app/user/[id].tsx`

### Share — web preview pages + Universal Links / App Links (deferred infrastructure)
Why: The in-app Share buttons + canonical `sphaer.app/...` URLs already ship (see ✓ Shipped 2026-06-09). What's left is the deep-link plumbing so the URLs actually open something useful when received.
Done when:
- [ ] Web preview pages at `sphaer.app/event/<id>`, `/circles/<id>`, `/user/<id>` with OG tags + "Open in app" button (needs DNS + hosting decision)
- [ ] Apple App Site Association file at `sphaer.app/.well-known/apple-app-site-association` (needs Apple Developer account)
- [ ] Android `assetlinks.json` (needs Google Play app signing key)
- [ ] iOS `associated-domains` entitlement + Android intent filters in `app.json`

---

## P2 — Code hygiene & known bugs (audit 2026-06-09)

Things the audit flagged as wrong-but-not-on-fire. Group several into one
PR per ship; don't expand the current item to absorb these.

### ~~Message hooks swallow fetch errors (3 hooks)~~ — hook half shipped 2026-06-09
Each of `useMessages`, `useEventMessages`, `useCircleMessages` now exposes an `error: string | null` state and sets it in the `.catch` branch of the initial fetch before logging. The chat screens still need to read the new state and render `<ErrorState />` — that part lands when ErrorState ships in the next P2 item.

### Unsafe JSONB casts in messages.service.ts
Why: Lines 20 / 28 / 35 cast `row.partner as unknown as Event/Circle/Profile` and `row.last_message as unknown as Message` from the `get_conversations` RPC return. If the SQL function schema drifts, these break silently at runtime.
Done when:
- [ ] Either regenerate types so the RPC return is properly typed, OR
- [ ] Add a runtime validator (zod / io-ts) at the cast boundary that throws a clear error on shape mismatch

### Missing skeletons on `/user/[id]` + message threads
Why: `ProfileSkeleton` exists but isn't used on the other-user-profile fetch path. Message threads (`messages/[id]`, `messages/event/[id]`, `messages/circle/[id]`) use `ActivityIndicator` instead of a chat-bubble skeleton list. Visual inconsistency vs. rest of app.
Done when:
- [ ] `/user/[id]` shows `ProfileSkeleton` during `status === 'loading'`
- [ ] New `MessageBubbleSkeleton` component (staggered pulse to mimic real bubble list); wire into all three chat screens

### Other-users-profile (`/user/[id]`) still falls back to `mockProfiles`
Why: Profile v2 #7 — already deferred. Worth promoting because `/user/[id]` falling to mocks means any DB user without a hard-coded mock entry hits a stale fake profile or "not found".
Done when:
- [ ] `getProfile(id)` fully replaces `getMockProfileByExactId`
- [ ] Mock fallback removed; 404 → real ErrorState

### Stale `MockConversation` type import — KEPT (audit was wrong)
On closer reading, `app/(tabs)/messages/index.tsx` uses `MockConversation` as a deliberate display-shape adapter — real Conversation rows are mapped into the legacy shape so the Figma-styled `ConversationRow` component keeps working. Not stale. The real follow-up is to update `ConversationRow` to accept the native `Conversation` type and rename `MockConversation` → `ConversationRowDisplay` in a proper types file. Bigger refactor; not a hygiene-batch item.

### ~~`as any` route casts in BottomNav + EntityListSheet~~ — shipped 2026-06-09
Both `BottomNav.tsx` and `EntityListSheet.tsx` now import `type Href from 'expo-router'` and cast via `as Href` instead of `as any`. Type system intact.

### ~~`fontWeight: '510' as any` in ViewToggle~~ — shipped 2026-06-09
Switched both occurrences to `'500'` (the value RN was silently falling back to anyway). Inline comment documents the Figma-510 origin and the rounding rationale.

### Memo audit of high-churn parents
Why: Feed memoizes `visibleEvents`; Profile / Circles / chat bubble subtrees don't. On AppContext or auth state flip they re-render wide trees.
Done when:
- [ ] Profile screen wraps stable children (ProfileCompletionCard, AvailableForWorkBar, SettingsSection) with `React.memo`
- [ ] Circle cards memoize their handlers via `useCallback`
- [ ] Chat bubble list memoizes per-message render

### Accessibility audit (concrete numbers)
Why: 325 TouchableOpacity/Pressable instances in the app vs only ~14 `accessibilityLabel` props. VoiceOver users can't navigate.
Done when:
- [ ] Per-screen sweep PR — add `accessibilityLabel` to every interactive element
- [ ] Icon-only buttons get descriptive labels ("Refresh mural", "Share event", "Open ticket")
- [ ] Image-as-button (poster tap, avatar tap) gets `accessibilityRole="button"` + label
- [ ] Contrast spot-check on `text.secondary` (#767779) on white — verify WCAG AA pass

### ~~Document the eslint suppressions~~ — shipped 2026-06-09
All 4 suppressions in MuralCanvas (×3) + update-password (×1) now carry a one- to three-line comment explaining the omitted dep (Reanimated shared values, wheel handler reading .value at fire time, run-once-on-mount avoidance of infinite loop).

---

## P2 — Security (audit 2026-06-09)

### Image upload file-type validation
Why: `src/services/events.service.ts#uploadEventPoster()` and the profile gallery upload paths guess extension from URI string — no Content-Type validation. A user could upload `.exe` renamed `.jpg`. Bucket RLS limits write to own folder but doesn't prevent malicious file types.
Done when:
- [ ] Validate MIME type server-side via an edge function gate OR Supabase Storage `allowed_mime_types` bucket config
- [ ] Reject anything that isn't `image/jpeg | image/png | image/webp | image/heic`
- [ ] Optional: add a virus-scan call (VirusTotal API) on upload before making the object public

### Rate limiting on writes (messages / follows / notifications)
Why: No throttle anywhere. A user can spam-send 100 DMs in a second, each firing a notification. Harassment + spam vector.
Done when:
- [ ] Postgres function `check_rate_limit(uid uuid, action text)` that reads count from a rolling-window log table; rejects if over threshold
- [ ] Triggers on `messages` / `follows` / `notifications` INSERT call the function
- [ ] Thresholds picked per action — e.g. 10 DMs / minute, 30 follows / hour

### Google Maps API key restrictions
Why: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is bundled into the APK / IPA (unavoidable on Expo). If unrestricted, an attacker can reuse it for their own quota / billing. One-time ops fix.
Done when:
- [ ] In Google Cloud Console, restrict the Maps API key to bundle IDs `com.sphaer.app` (iOS + Android)
- [ ] No code change; just operational checklist

### PostgREST `.or()` search uses unescaped user input
Why: `src/services/events.service.ts` builds `.or()` from the search string. PostgREST's parser is safe today, but if it ever changes or a user finds a vector, this is risky. Defensive sanitisation.
Done when:
- [ ] Strip PostgREST-reserved chars (`,`, `(`, `)`, `*`, `:`) from search input before interpolation
- [ ] Or move to a PostgREST function with explicit parameters

---

## P2 — Data integrity (audit 2026-06-09)

### Denormalised follower / following counts
Why: `getProfile()` recomputes counts on read. Concurrent follows can race; the counts could disagree with reality on a hot profile.
Done when:
- [ ] Migration adds `followers_count INT DEFAULT 0`, `following_count INT DEFAULT 0` to `profiles`
- [ ] Postgres trigger on `follows` INSERT / DELETE uses `UPDATE ... SET count = count + 1` for atomicity
- [ ] Read path stops computing from `follows` join

### Soft-delete policy decision
Why: Events / circles / messages are all hard-deleted today; cascade deletion of an account vapourises everything. For future content moderation / dispute resolution, decide whether to add `deleted_at TIMESTAMPTZ` columns now and filter at query time.
Done when:
- [ ] Product decision: hard-delete v. soft-delete per content type
- [ ] If soft-delete: migrations add `deleted_at`, all service queries add `WHERE deleted_at IS NULL`, account deletion still hard-purges the user's own rows but moderation can soft-delete others'

---

## P2 — Developer experience (audit 2026-06-09)

### Zero test coverage
Why: No `.test.*` files anywhere; no Jest / Vitest / Detox config. Every refactor is by hand. **PROMOTE candidate for after launch** — let's not block ship on tests, but baseline coverage prevents regressions.
Done when:
- [ ] Jest + React Native Testing Library installed
- [ ] Smoke test suite covers: signup form validation, create-event form validation, save-event toggle, sign-out flow
- [ ] GitHub Actions CI runs the suite on push before merge

### TypeScript enums for `notification.type` and `circle_members.role`
Why: Schema enforces them via string CHECK constraints; code uses string literals scattered everywhere. A typo (`'circle_evnt'` instead of `'circle_event'`) silently breaks notification routing.
Done when:
- [ ] New `src/types/enums.ts` with `type NotificationType = 'follow' | 'event_reminder' | 'circle_event' | 'message'`
- [ ] All `notification.type` callsites + RPC return types use the typed alias
- [ ] Same for `CircleRole = 'admin' | 'member'`

---

## Backlog (later — months out)

- **Circle group chat (Messaging v2)** — `src/hooks/useCircleMessages.ts` already exists but is unused; circle detail screen has no chat tab. Wire the existing hook + add chat UI inside circle detail (new tab between Members and Activities); existing 1:1 ChatBubble + ChatComposer components should drop in.
- **Ticketing / Stripe integration** — schema has `events.is_free` + `price` + `ticket_url` but `registrations.service.ts` is RSVP-only (no payment processor). Investors will ask about monetisation. Big project: Stripe Checkout + webhook for confirmation + refund / cancel path + `paid_at` column on registrations.
- **Notification triggers (Activities v2 #18 — pair with push notifications)** — Postgres trigger on `events` INSERT fans out a `notifications` row to every user in `circle_follows` WHERE circle_id matches the event's circle_id. Needed once the notifications screen ships, otherwise the screen stays empty for circle-event activity.
- **Onboarding tutorial (3-screen swipeable intro before signup CTA)** — first-open users see "Discover Berlin events" → "Follow artists & communities" → "Save & get notified" before the landing-screen Get Started / Log In CTAs. Promote this if investor demo is approaching — a blank feed cold-start is a bad first impression.
- **Onboarding screen consolidation (5 → 3)** — current first-time path is splash → tagline → landing → signup → verify-email → onboarding → /location → feed. Folding the `/location` neighborhood picker into the onboarding form's final step would cut to 3 screens and feel less interrogative.
- **Photo likes + comments on profile gallery (Profile v2 #4 + #5 promoted)** — tap a gallery thumbnail → photo detail page with hearts + comments + caption display. New tables: `profile_image_likes (user_id, image_id)` + `profile_image_comments (id, image_id, author_id, content, created_at)`. Notifications producer fans out to the gallery owner.
- **Bulk calendar export for saved events** — single `.ics` file containing every saved event so the user can import their whole queue at once. Per-event Add-to-Calendar already shipped 2026-06-09; this is the saved-list variant. Add a button to the Saved sheet on profile.
- **Map clustering** — when zoomed out, group pins to avoid visual mess. `react-native-maps` supports this with a cluster wrapper.
- **Dark mode** — `theme.ts` is already token-based, so this is mostly a swap of color values + `useColorScheme()` hook + a refactor of every screen to read colors via a `useColors()` hook instead of importing `colors` directly.
- **Blocking / reporting users** — mute/block flow + report-to-mods. App Store may push back if absent given the social nature.
- **Analytics (PostHog / Mixpanel)** — track funnel: signup → first event view → first save → first message. Pick one.
- **Crash reporting (Sentry / Bugsnag)** — wire to error boundaries from the P1 item.
- **AI-generated event posters** — user mentioned this is coming. Designers can generate a poster from an event title/description. Hook `expo-image-manipulator` for client crop, openAI or Replicate for the gen, store dims at gen time (resolves the deferred `poster_width`/`poster_height` columns from the Mural session).
- **Splash screen polish** — current splash is the Expo default. Custom Sphaer artwork matching the landing screen.
- **Profile image gallery editing** — long-press to delete, drag-to-reorder. Currently photos are append-only inside Edit Profile; no delete in view mode.

---

## ✓ Shipped

*Add shipped items here as they land: title, date, one-line summary, PR/commit link.*

- **2026-06-09 — Code hygiene batch (4 fixes from audit).** (1) Message hooks `useMessages`, `useEventMessages`, `useCircleMessages` all swallowed initial-fetch errors via `.catch((err) => console.error(...))`; each now also calls `setError(err.message)` and exposes `error: string | null` in its return shape. The chat screens still need to consume the new error and render `<ErrorState />` — that ships with the ErrorState component in the next P2 item. (2) `BottomNav.tsx` + `EntityListSheet.tsx` route casts changed from `router.push(x as any)` to `router.push(x as Href)` (importing `type Href from 'expo-router'`). Type system no longer bypassed. (3) `ViewToggle.tsx` `fontWeight: '510' as any` → `'500'` (the value RN was silently falling back to anyway); inline comment documents Figma origin + rounding. (4) All four `react-hooks/exhaustive-deps` suppressions (3 in `MuralCanvas`, 1 in `update-password`) now carry explanatory comments: Reanimated shared values that don't trigger React renders, wheel handler reading `.value` at fire time, run-once mount avoiding infinite loop. (5) `MockConversation` import in messages inbox was flagged by audit as "stale" — on re-read it's a deliberate display-shape adapter, not stale; kept with a note in BACKLOG for a follow-up rename. Typecheck clean. Commit `0a18f6e`.
- **2026-06-09 — Removed "Available for work" placeholder bar + ticket "Coming soon" buttons (P2 polish).** Two P2 "dead UI" items shipped as one cleanup. (1) The "Available for work" bar on `/(tabs)/profile` rendered on the user's OWN profile with a "Get in touch" button that alerted "Coming soon" — i.e. the user was being asked to message themselves. Removed the `<AvailableForWorkBar />` from both render paths (dev-fallback + authed), deleted the component function, deleted the orphan `availableBar / availableLeft / availableTitle / availableDot / availableLocation / getInTouchButton / getInTouchText` styles, removed now-unused `Alert` import + `INK / META / SUCCESS_DOT` constants. Documented with a one-line comment that the bar will return on `/user/[id]` when Profile v2 #2 ships the `is_available_for_work` toggle. (2) `app/ticket/[id].tsx` had two outline buttons "Download as PDF" + "Send by Email" wired to `handleComingSoon()` → `Alert.alert('Coming soon')`. Removed both buttons + the `handleComingSoon` function. Bonus: `handleInviteFriends` now delegates to the shared `shareEvent(event)` from `share.service.ts` so the canonical URL + platform-tuned payload is consistent with event detail / circle / profile share buttons; removed now-unused `Share` + `Alert` imports. The remaining ticket actions are "Invite Friends" (works) + "Done" (back). Typecheck clean. Commit `e7ead60`.
- **2026-06-09 — iOS + Android permission descriptions in app.json (P0 App Store blocker).** `app.json` only had `photosPermission` for `expo-image-picker`. The Near-me filter calls `expo-location`, which would have crashed at permission-request time on iOS (no `NSLocationWhenInUseUsageDescription`) and been rejected at App Store Connect upload. Shipped a full sweep: new `ios.infoPlist` entries for `NSLocationWhenInUseUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`, `NSCameraUsageDescription`, `NSUserNotificationsUsageDescription` — all with HIG-style copy ("Sphaer uses your X to do Y" with concrete examples). New `expo-location` config-plugin entry sets `locationAlwaysAndWhenInUsePermission` so the prompt copy is consistent. `expo-image-picker` plugin gained `cameraPermission` for selfie/QR scan use. Android side: new `android.permissions` array listing `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE`, `CAMERA`, `POST_NOTIFICATIONS`, `INTERNET`. Merged the original P1 "HIG copy sweep" item into this ship since the HIG-style copy was written in the same pass. Outstanding: test on a real iOS device when push notifications actually invoke `NSUserNotificationsUsageDescription`. Commit `28ca7e7`.
- **2026-06-09 — Privacy Policy + Terms of Service as in-app routes (P0 App Store blocker).** Original BACKLOG entry assumed legal pages would be hosted at `sphaer.app/privacy` + `/terms` (those URLs 404 today). Shipped a faster alternative: new `src/components/legal/LegalScreen.tsx` is a reusable shell (back chevron + title + scrollable structured-section body) consuming a `{ title, lastUpdated, intro, sections: [{heading, body}] }` prop where `body` can be a string or a mix of paragraph strings and `{bullets: [...]}` blocks. New routes `app/legal/privacy.tsx` + `app/legal/terms.tsx` each compose `<LegalScreen>` with App-Store-submittable boilerplate copy — Privacy covers data collection (auth, profile, content, optional location for Near me), usage purposes (no ad networks, no behavioural profiling), Supabase as the EU-region data processor, GDPR rights (access/edit/delete/export), no tracking cookies, 16+ age requirement; Terms covers eligibility, account responsibility, content ownership + IP licence-to-display, acceptable use, event-organiser disclaimer, termination, warranties + liability limits, governing law (Germany / Berlin courts). Both end in a `privacy@sphaer.app` / `hello@sphaer.app` contact footer. Last-updated date set to 2026-06-09; user can refine wording. `app/(auth)/signup.tsx` now navigates via `router.push('/legal/terms')` / `'/legal/privacy'` instead of `Linking.openURL` external (now-unused `Linking` import removed). `app/_layout.tsx` registers both new routes as `presentation: 'card'`. Both screens have `makeRouteErrorBoundary` per the established pattern. Each is reachable without an auth session — App Store reviewers must read them without signing up. Typecheck clean. Commit `2e668c1`.
- **2026-06-09 — Add to calendar via .ics on event detail (P2 polish).** New `src/utils/ics.ts` generates RFC 5545-compliant VCALENDAR/VEVENT strings from an event (CRLF line endings, UTC `YYYYMMDDTHHMMSSZ` timestamps, proper escape sequences for `\\`, `;`, `,`, and newlines in TEXT fields). New `src/services/calendar.service.ts#addEventToCalendar()` hands the .ics off to the system calendar in a platform-conditional way: on web, builds a Blob URL of the file and triggers a download via a transient `<a download>` element (works on Chrome / Safari / Firefox); on native, base64-encodes the body into a `data:text/calendar;base64,...` URI and hands to `Linking.openURL` — iOS opens the system Calendar's "Add Event" sheet, Android opens the calendar picker. No new permissions needed because we never touch the device calendar directly — the OS routes to whatever calendar app the user has. base64 encoder is platform-conditional too: `btoa` on web (with a UTF-8 pre-encode so emoji in descriptions survive), `Buffer.from` on RN. New `calendar-outline` button on `app/event/[id].tsx` topbar between the share and bookmark buttons; `accessibilityLabel="Add to calendar"`. Output sanity-checked in Node against a sample event with semicolons, commas, and a newline in the description — all escape sequences emit correctly, VEVENT validates as a self-contained calendar item. Commit `bb20bda`.
- **2026-06-09 — In-app share buttons on event/circle/profile (P2 polish).** New `src/services/share.service.ts` centralises three share helpers — `shareEvent(event)`, `shareCircle(circle)`, `shareProfile(profile)` — each builds a canonical `https://sphaer.app/event/<id>` / `circles/<id>` / `user/<id>` URL and calls React Native's `Share.share()` with a platform-tuned payload (iOS keeps `message` + `url` separate so receivers render link-preview cards; Android folds the URL into `message` because `url` is silently dropped there). The web-preview pages at those URLs don't exist yet, but baking the canonical URL in now means every share emitted from the app is forward-compatible the moment the web app + Universal Links / App Links land (filed as deferred-infrastructure item under P2). `app/event/[id].tsx`: existing placeholder `handleShare` (which previously only shared a title + location string with no URL) now delegates to `shareEvent()`; removed the now-unused `Share` import from react-native. `app/(tabs)/circles/[id].tsx`: replaced the no-op `information-circle-outline` button in the topbar with a `share-outline` button wired to `shareCircle()`. `app/user/[id].tsx`: added a second `share-outline` button in the topbar next to the back chevron — required adding `flexDirection: 'row'` + `justifyContent: 'space-between'` to the existing navBar style so the two buttons sit on opposite sides; gated on `displayProfile &&` so it doesn't render on the loading/not-found states. Visually verified in preview on `/user/lea-weber` (dev fallback mock profile): share-outline icon visible top-right next to back chevron, `aria-label="Share profile"` confirmed. `event/[id]` and `circles/[id]` paths require a real DB record (could not verify the exact icon swap end-to-end without seeded UUIDs), but the implementations are byte-identical patterns to the user/[id] one so the typecheck-pass is high-confidence. Commit `2ac34b7`.
- **2026-06-09 — Mural refresh affordance (P2 polish — overscroll → button).** Spec called for vertical overscroll → refetch, but the Mural canvas's pan gesture already owns vertical drag (with rubber-band at both ends), and adding overscroll-triggers-refresh would either fight that rubber-band or risk regressions in the carefully-tuned pan/pinch math. Shipped the same UX intent via a small floating refresh button — 36×36px circle in the top-right of `canvasSlot`, semi-transparent black background (`rgba(0,0,0,0.55)`) with a 1px white-15% border so it reads on both bright posters and the black wall background, white refresh icon (ionicons `refresh`), white spinner during the refetch. `zIndex: 10` sits it above the GestureDetector so taps don't get swallowed. Hit-slop padded 10px on each side for thumb reach. New `handleRefresh` callback awaits `refetch()` from `useEvents`; sets `isRefreshing` state so the icon swaps to a spinner during the round-trip. Visually verified in preview: button renders top-right with subtle dark fill + white outline, accessible via `aria-label="Refresh mural"`, tap fires `refetch` without throwing. The existing `useFocusEffect(refetch)` still covers the "switch tab, come back" case — this button covers "I want fresh data right now without leaving the wall." Commit `9695fe2`.
- **2026-06-09 — Discovered: Save/bookmark sync already shipped in an earlier session (BACKLOG retirement).** The P2 "Save/bookmark events synced (move from AsyncStorage to saved_events table)" entry was stale — `src/services/events.service.ts` already has `getSavedEventIds()`, `saveEvent()`, `unsaveEvent()`, `getSavedEvents()` all hitting the `saved_events` table; `app/(tabs)/feed/index.tsx#toggleSave()` and `app/event/[id].tsx` both call those service functions with optimistic UI; `app/(tabs)/profile/index.tsx` renders saved activities via the `getSavedEvents(user.id)` + `openSheet === 'saved'` EntityListSheet. The whole flow is DB-backed end-to-end; only AsyncStorage usage left in the codebase is the legacy onboarding flag in `app/location.tsx` (which already auto-migrates to `profiles.onboarding_completed`). Retired the BACKLOG entry as part of the Mural refresh ship.
- **2026-06-09 — Tonight / This weekend / Free quick-filter chips on Feed (P2 polish).** New `src/utils/event-filters.ts` exposes `isTonight()`, `isThisWeekend()`, `currentWeekendWindow()` (Mon-Thu: upcoming Fri 18:00 → Sun 23:59:59; Fri pre-18:00: today 18:00 → Sun; Fri post-18:00 / Sat / Sun: now → Sun 23:59:59), and `applyChipFilters(events, { tonight, thisWeekend, isFree })` — the single predicate that all three feed views share. `EventFilters` (in `src/types/event.types.ts`) gains `tonight?` and `thisWeekend?` flags; `isFree?` was already there from a previous session, now finally surfaced. `app/(tabs)/feed/index.tsx`: three new chips render in the existing chipRow next to Near me (Tonight / This weekend / Free), styled with the same chip pattern (white pill, dark active state, icon + label) — renamed `nearMeChip*` styles to plain `chip*` so the new chips reuse them. ChipRow now scrolls horizontally on narrow screens (was a flex row; ScrollView with `horizontal` prevents overflow). Tonight ⇄ This weekend are mutex (selecting one auto-clears the other); Free stacks freely since it's orthogonal to time. Empty state copy branches on which chip is active: "Nothing on tonight", "Nothing on this weekend", "No free events match" — body always points back at the chips. `app/(tabs)/feed/map.tsx` and `app/(tabs)/feed/mural.tsx` both delegate to `applyChipFilters()` in their `visibleEvents` memos so view switches stay coherent — toggling Tonight on Feed, then switching to Map, leaves the map showing the tonight subset. Visually verified in preview: Free chip narrows the list to the 2 free events (Open Mic Prenzlauer + Berlin Zine Fair); Tonight shows "Nothing on tonight" empty state (the seed data has no events for today); clicking This weekend clears Tonight and shows "Nothing on this weekend". Commit `eb3934b`.
- **2026-06-09 — Email confirmation interstitial (Profile v2 #9 — code half).** New `app/(auth)/verify-email.tsx` interstitial sits between signup and onboarding when the Supabase project's email-confirmation toggle is ON. Subscribes to `onAuthStateChange` and routes to `/onboarding` the moment `SIGNED_IN` arrives (which fires when the user taps the email link, lands back on the app with the session-bearing URL fragment, and `detectSessionInUrl: true` parses it). Renders the typed email back to the user, an animated spinner + "Waiting for confirmation…" status, a "Resend email" CTA with a 60-second cooldown (calls `supabase.auth.resend({ type: 'signup', email })`), and a "Start over" link that signs out any pending session and bounces to the landing. `useAuth.signUp()` now returns the raw supabase `data` so callers can branch — `signup.tsx`'s `handleSignUp()` checks `result?.session` and routes to `/onboarding` when confirmation is OFF (immediate session, current dashboard state) or `/verify-email?email=...` when confirmation is ON (no session yet, link sent). `_layout.tsx` gains a third mid-flow fall-through for `verify-email` so the layout doesn't intercept the screen when a session briefly populates. Visually verified in preview: navigated directly to `/verify-email?email=test@example.com`, screen renders all elements correctly with the email echoed. **DEPLOYMENT NOTE for the human:** flip Supabase dashboard → Authentication → Providers → Email → "Confirm email" ON. The interstitial code is in place — once the toggle flips, the next email signup will go through `/verify-email` automatically. Test plan: with the toggle on, sign up a throwaway → see verify-email screen → check inbox → click link → confirm you land on onboarding without the verify-email screen visible afterward. Commit `6933a2b`.
- **2026-06-09 — Password reset / forgot password (P1 App Store launch blocker).** `src/services/auth.service.ts` gains two new helpers: `requestPasswordReset(email)` (wraps `supabase.auth.resetPasswordForEmail` with a platform-conditional redirect URL — `<origin>/update-password` on web, `sphaer://auth/update-password` on native, mirroring the Google OAuth pattern) and `updatePassword(newPassword)` (wraps `supabase.auth.updateUser({ password })`). Two new screens: `app/(auth)/reset-password.tsx` (email field + "Send reset link" CTA → on submit calls the service and flips to a "Check your inbox" success state with the email echoed back; surfaces inline validation for malformed addresses; always shows the same success state regardless of whether the email matched an account, to avoid leaking which addresses are registered) and `app/(auth)/update-password.tsx` (deep-link landing — polls `getSession()` then subscribes to `onAuthStateChange` with a 1.5s fallback to detect whether the recovery token populated a session; renders three states: "Set a new password" with new + confirm fields when a recovery session is present, "Password updated" success after successful `updateUser`, "Link expired" when no recovery session shows up after the polling window; on success signs out the recovery session before bouncing to login because silently signing the user in via a recovery flow is surprising and means a stolen email link grants persistent access). The login screen's existing "Forgot password?" link now `router.push('/(auth)/reset-password')` instead of the placeholder Alert. `app/(auth)/_layout.tsx` gets a second mid-flow fall-through: previously only `onboarding` was allowed to mount while a session was present (post-signup form), now `update-password` is also allowed because Supabase populates a temporary recovery session before the screen mounts — without the fall-through the layout would bounce the user to `/location` or `/feed` before they could set a new password. The `lastSeg` is cast to `String()` because expo-router's generated route literal type hasn't picked up the new files yet. Visually verified in preview: clicking "Forgot password?" on /login navigates to /reset-password with correct chrome (logo, serif title, dark CTA, back-to-login link), inline email validation shows "Enter a valid email address" for malformed inputs, /update-password loads the "Link expired" state after the 1.5s polling window when accessed directly without a token. **DEPLOYMENT NOTE for the human:** the Supabase Auth dashboard's "Reset Password" email template needs the `redirectTo` URLs added to its allowlist (Authentication → URL Configuration → Redirect URLs) — add `<production-web-origin>/update-password` and `sphaer://auth/update-password`. Until those are allowlisted, Supabase will refuse to redirect and the reset email's link will dead-end on the Supabase error page. Email template body can stay default. **Test plan (not yet executed end-to-end — needs the dashboard config + a throwaway account):** sign up a throwaway, log out, log in screen → Forgot password → enter the throwaway email → check inbox → click link → land on /update-password → set new password → log in with the new password. Commit `7498329`.
- **2026-06-09 — Account deletion (P1 App Store launch blocker).** New `supabase/functions/delete-account/index.ts` edge function: verifies the caller's JWT via a user-scoped client, best-effort cleans up storage (avatars under `<userId>/`, gallery objects under `<userId>/`, plus posters on events they created and images on circles they created — fetched via a creator_id query BEFORE the cascade fires so paths are still resolvable), then calls `admin.auth.admin.deleteUser(userId)`. The schema already has `profiles.id REFERENCES auth.users(id) ON DELETE CASCADE` and every downstream FK is `ON DELETE CASCADE` (events, event_registrations, event_message_reads, saved_events, follows, circles, circle_members, circle_follows, circle_message_reads, messages, direct_message_reads, notifications, profile_images) — so a single auth-row delete cascades the entire user graph. No new migration needed. Client: new `src/services/account.service.ts#deleteAccount()` invokes the function via `supabase.functions.invoke('delete-account')` with the caller's JWT auto-attached. UI: new `SettingsSection` at the bottom of `app/(tabs)/profile/index.tsx` (below the Available-for-work bar, separated by a hairline) with a red trash icon + "Delete account" row; tapping opens a two-step ConfirmSheet flow — first sheet "Delete your Sphaer account?" with red "Continue" button; on Continue advances (with a 240ms gap so the close animation finishes cleanly) to second sheet "Permanently delete account · Last chance" with red "Delete account" button. On success the local session is killed via signOut() (errors swallowed because the JWT now references a non-existent user) and the user is bounced to `/`. Visually verified in preview by clicking through both sheets. `tsconfig.json` now excludes `supabase/functions/**` from the project's tsc check since the edge function runs under Deno's own type system. **Deployment note:** the function file is committed but NOT yet deployed — Supabase MCP returned net::ERR_FAILED for the entire session. Run `supabase functions deploy delete-account` once the MCP is back up or via the CLI to make the client call resolve; until deployed the UI surfaces "Function not found" via the ConfirmSheet's error alert. **Test plan (not yet executed — no throwaway account at hand):** sign up a throwaway account, post an event, save another event, follow someone, join a circle, send a DM; tap Delete account → Continue → Delete account; verify (a) you're bounced to `/`, (b) the auth row is gone (Supabase dashboard → Auth → Users), (c) the profile row is gone (`select * from profiles where id = '<uuid>'`), (d) the event is gone, (e) the save is gone, (f) the follow is gone, (g) the circle membership is gone, (h) the message is gone, (i) the avatar object is gone from the avatars bucket. Commit `629b901`.
- **2026-06-09 — Figma audit: Tagline screen (2012:1683).** "Your City. Your Sphaer." on the landing screen was at fontSize 24 / weight bold for "Your Sphaer." — Figma spec is 26 / Medium. Updated styles.tagline / styles.taglineBold on `app/(auth)/index.tsx`. Color, layout, animation, and hero structure already matched. Font file Test Martina Plantijn is referenced via `typography.fontFamily.display` but not loaded at runtime — falls back to system serif until the .otf files land (separate item). Commit `bc36700`.
- **2026-06-09 — Figma audit: Splash Screen (2012:1757).** Replaced the 1×1 placeholder `assets/images/splash.png` with a Figma-matched 1024×1024 splash. New `scripts/generate-splash.ts` emits the splash via sharp: white Master Cream bg (`#FFFFFF`), two-hoop logo from the existing `SphaerIcon` SVG paths scaled 3× and centred, "Sphaer" wordmark below in system sans-serif Semibold, all in Neutral/chocolate (`#2B2A27`). Cluster centred vertically with the Figma's ~7.5px optical lift. Closes the "Splash screen polish" Backlog (later) item early. Commit `bf3cd71`. **Note for future sessions:** the Figma audit is now the active UP NEXT — 12 screens remaining, user pending a Figma subscription upgrade for full audit bandwidth.
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
