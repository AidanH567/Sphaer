# Sphaer — Deferred Work

Things explicitly scoped *out* during planning for later builds. Captured so they
don't get lost. Each entry includes why it was deferred and the rough shape of
the work when we come back to it.

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
