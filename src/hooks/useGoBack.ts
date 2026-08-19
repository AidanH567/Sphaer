import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

/**
 * A back/close handler that always goes somewhere.
 *
 * ── The bug (Lara's list, item 6) ────────────────────────────────────────────
 * *"on several screens, back arrows / exit icons are missing or not
 * functioning. make them functional on each screen."*
 *
 * Every back chevron in the app was wired straight to `router.back()`.
 * `router.back()` pops the navigation history — and when there is nothing to
 * pop it does **nothing at all**, silently. The arrow renders, it takes the
 * press, and the screen doesn't move. That is the "not functioning" half of
 * the report, and it is not rare:
 *
 *  1. `router.replace()` REPLACES the current entry instead of pushing one, so
 *     any screen entered by a replace starts life with an empty stack:
 *       - `app/location.tsx` is only ever reached via replace (from
 *         `(auth)/onboarding` and `(auth)/signup`), so its back arrow was dead
 *         100% of the time;
 *       - `(tabs)/circles/[id]` after creating a circle (`create/circle.tsx`);
 *       - `event/[id]` after viewing a ticket (`ticket/[id].tsx`).
 *  2. The `PendingDeepLinkGate` in `app/_layout.tsx` replays deep links with
 *     `router.replace()`, so every deep-linkable route (`/event/x`, `/user/x`,
 *     `/circles/x`, `/messages/…`, `/ticket/x`, `/notifications`) opens with a
 *     dead back arrow.
 *  3. On the web build — which is how the app is currently being tested — every
 *     route is directly addressable. A shared link, a bookmark or a plain page
 *     reload lands the user on a screen with no history behind it.
 *
 * In all of those cases the user is stuck: the back arrow does nothing, and on
 * the screens that sit OUTSIDE the `(tabs)` group there is no bottom nav to
 * escape with either.
 *
 * ── The fix ──────────────────────────────────────────────────────────────────
 * Ask first. When there is history, pop it — that preserves the normal
 * "return to wherever I came from" behaviour exactly. When there isn't, replace
 * with the screen's natural parent, so the arrow still means "up and out".
 * `replace` (not `push`) is deliberate: a back gesture should never grow the
 * stack it is trying to unwind.
 *
 * @param fallback Where to go when there is no history to pop. Pass the
 *                 screen's logical parent (a circle detail falls back to the
 *                 circles list, an edit screen to the thing it edits).
 */
export function useGoBack(fallback: Href): () => void {
  const router = useRouter();

  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallback);
  }, [router, fallback]);
}
