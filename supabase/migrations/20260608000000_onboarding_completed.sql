-- onboarding_completed — server-side truth for the auth gate
--
-- The auth layout previously sent every signed-in session through
-- /location, and /location bailed early using an AsyncStorage flag keyed
-- by user id. AsyncStorage is local to a single install — a reinstall, a
-- second device, or a switch between native and web wiped the flag and
-- silently re-routed returning users through the location prompt again.
--
-- This column gives both the layout gate and /location a server-side
-- "they've already done this" signal that survives device changes.
--
-- See BACKLOG.md ▶ UP NEXT #1 (Login → location-onboarding glitch).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: anyone who already has a neighborhood, or a non-empty location,
-- has implicitly completed the legacy flow (email signup always sets
-- location='Berlin' at the end of the onboarding form; OAuth users who
-- completed the location prompt have neighborhood set on the AppContext
-- side but not on profiles — those will see the screen one more time and
-- the new server-side write covers it from then on).
UPDATE public.profiles
   SET onboarding_completed = TRUE
 WHERE neighborhood IS NOT NULL
    OR (location IS NOT NULL AND location <> '');
