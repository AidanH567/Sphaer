import type { EventWithRelations } from '@/types/event.types';

/**
 * Profile activity tabs — the segmented control inside the Activities sheet,
 * opened by tapping the "Activities" stat on either profile screen.
 *
 * ── History, so the shape is not re-derived from scratch next time ──
 *
 * Lara's complaint was that the profile's Saved / Activities / Tickets
 * controls "do the same thing". They very nearly did. Measured against
 * production on 2026-08-17:
 *
 *   - `Activities` was defined as (events I created) ∪ (events I registered
 *     for). The `on_event_created` trigger auto-inserts a registration row
 *     for every creator, so `created ⊆ registered` — verified: 0 of 56 events
 *     lacked a creator registration row.
 *   - `Tickets` was (events I registered for).
 *
 * So `Activities` and `Tickets` were the SAME QUERY wearing two labels, for
 * all 23 users with any data.
 *
 * The first fix restructured the whole profile around an inline tab strip and
 * was rejected on the layout — Aidan wanted the original profile back. The
 * CATEGORIES were the part worth keeping, so they moved into the sheet the
 * Activities stat already opened. One door, four categories behind it.
 *
 * ── The two axes, and how they are resolved ──
 *
 * All / Going / Saved are RELATIONSHIP filters; Past is a TIME filter. Mixing
 * them in one control is only honest if the rule is stated, so:
 *
 *   **Going and Saved show UPCOMING only. Past shows what has finished.**
 *
 * That rule is surfaced in the sheet subtitle (`TIME_RULE_COPY`) and echoed in
 * every empty state, rather than left for the user to infer. It matters here:
 * Aidan's own account has 56 activities and 6 upcoming, so Past is the fullest
 * tab and Going is near-empty — which must read as normal, not broken.
 *
 *   All   = Going ∪ Saved ∪ Past, deduped   (the full set; the stat count)
 *   Going = registered ∧ upcoming
 *   Saved = bookmarked ∧ upcoming           — PRIVATE, own profile only
 *   Past  = anything in the set that has finished
 *
 * The three visible tabs therefore PARTITION All: every activity is either
 * upcoming (Going and/or Saved) or finished (Past), so nothing is reachable
 * only from All. That is why Past is defined over the whole set rather than
 * over registrations alone — a saved activity whose date has passed would
 * otherwise be visible in All and nowhere else.
 *
 * ⚠️ There is deliberately NO Tickets tab. Tickets is a strict subset of
 * Going, and at the door you already know which activity you are at — you do
 * not browse a ticket list. The ticket lives as a tappable badge on the row
 * instead (see `isTicketed` + ActivityRow), which is one tap to the QR from
 * any tab rather than two through a tab.
 */
export type ActivityTabKey = 'all' | 'going' | 'saved' | 'past';

export interface ActivityTab {
  key: ActivityTabKey;
  label: string;
  count: number;
  events: EventWithRelations[];
  /** Shown when this tab has nothing in it. */
  emptyBody: string;
}

/**
 * The upcoming/finished rule, stated once so the UI never has to guess at it.
 * Rendered as the sheet's subtitle.
 */
export const TIME_RULE_COPY =
  'Going and Saved show what’s still to come. Past is everything that has finished.';

/**
 * Is this activity ticketed rather than free-entry?
 *
 * Three independent signals, any one of which means "there is a ticket":
 * an explicit `is_free === false`, a positive price, or an external
 * `ticket_url`. Measured on production: 38 of 56 activities are paid and 10
 * carry a ticket_url, so this is a substantial proper subset (~62% of a
 * typical user's Going list) rather than a signal that never fires.
 *
 * `is_free == null` alone does NOT count as ticketed — an unset flag is not
 * evidence of a price.
 */
export function isTicketed(event: EventWithRelations): boolean {
  if (event.is_free === false) return true;
  if (typeof event.price === 'number' && event.price > 0) return true;
  return Boolean(event.ticket_url);
}

/**
 * Where a row's ticket badge should go when tapped.
 *
 *   local    — the viewer has a registration row, so there is a real QR at
 *              /ticket/[id]. One tap from any tab to the thing you show at
 *              the door; this is what replaced the Tickets tab.
 *   external — the activity is ticketed only through someone else's site
 *              (`ticket_url`) and the viewer has not registered here, so
 *              there is no local QR to route to. Opening the external page is
 *              the honest destination; pretending we hold a ticket is not.
 *   null     — no badge. Either it isn't ticketed, or it is paid but the
 *              viewer neither registered nor has a link to follow, in which
 *              case they hold nothing and the badge would be a lie.
 */
export type TicketBadgeTarget =
  | { kind: 'local'; eventId: string }
  | { kind: 'external'; url: string }
  | null;

export function ticketBadgeTarget(
  event: EventWithRelations,
  isRegistered: boolean,
): TicketBadgeTarget {
  if (!isTicketed(event)) return null;
  if (isRegistered) return { kind: 'local', eventId: event.id };
  if (event.ticket_url) return { kind: 'external', url: event.ticket_url };
  return null;
}

/**
 * When an activity is over.
 *
 * `ends_at` when the creator set one, otherwise `starts_at`. Using the end
 * matters for the Going/Past split: a club night that started three hours ago
 * and runs until 06:00 is still something you are AT, not something you
 * attended — dropping it into Past mid-event would be wrong.
 */
export function activityEndTime(event: EventWithRelations): number {
  return +new Date(event.ends_at ?? event.starts_at);
}

/** Has this activity finished? The single definition of the time axis. */
export function hasFinished(event: EventWithRelations, now: number = Date.now()): boolean {
  return activityEndTime(event) < now;
}

/**
 * Merge activity lists into one, keeping the first occurrence of each id.
 *
 * Inherited from the deleted UserEventsSheet's `mergeUserActivities` — same
 * dedup-by-id contract, but variadic so "All" can fold several sources
 * together in one pass.
 */
export function dedupeActivities(
  ...lists: EventWithRelations[][]
): EventWithRelations[] {
  const byId = new Map<string, EventWithRelations>();
  for (const list of lists) {
    for (const event of list) {
      if (!byId.has(event.id)) byId.set(event.id, event);
    }
  }
  return [...byId.values()];
}

/**
 * Upcoming soonest-first, then past most-recent-first.
 *
 * Applies to every tab, including All — so All reads as "what's next, then
 * what happened" without needing its own sub-navigation.
 */
export function sortActivities(
  events: EventWithRelations[],
  now: number = Date.now(),
): EventWithRelations[] {
  const upcoming = events
    .filter((e) => !hasFinished(e, now))
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const past = events
    .filter((e) => hasFinished(e, now))
    .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));
  return [...upcoming, ...past];
}

interface BuildTabsInput {
  /** Activities the profile's owner is registered for. */
  going: EventWithRelations[];
  /** Bookmarked activities. Always empty for a profile that isn't yours. */
  saved: EventWithRelations[];
  /**
   * Activities this person CREATED. Only fetched for other people's profiles,
   * where it is folded into the base set alongside their registrations.
   *
   * Own profile doesn't need it: the `on_event_created` trigger registers
   * creators for their own activities, so Going already contains everything
   * you host. It is still fetched for other people as a belt-and-braces
   * source in case a pre-trigger activity is missing its creator row.
   */
  hosting?: EventWithRelations[];
  /**
   * Own profile shows the private Saved tab; someone else's does not.
   * `saved_events` RLS is `USING (auth.uid() = user_id)`, so another user's
   * saved list reads back as empty — rendering a "Saved" tab there would
   * assert "they saved nothing", which we cannot know. Hiding it is the only
   * honest option, and what someone bookmarked is nobody else's business
   * anyway (what they ATTENDED is fair social proof; Past stays public).
   */
  isOwnProfile: boolean;
  /** Display name, used to word other-people empty states. */
  displayName?: string;
  /** Injectable clock — tests pin it, production takes the default. */
  now?: number;
}

export function buildActivityTabs({
  going,
  saved,
  hosting = [],
  isOwnProfile,
  displayName,
  now = Date.now(),
}: BuildTabsInput): ActivityTab[] {
  const who = displayName?.trim() || 'This artist';

  // ⚠️ Saved is dropped outright unless this is your own profile — it never
  // reaches ANY tab, including the All union, so a caller that passes a saved
  // list for someone else cannot leak it through the back door. The hook
  // already declines to fetch it and RLS already refuses to serve it; this is
  // the third layer, and the one a unit test can hold in place.
  const ownSaved = isOwnProfile ? saved : [];

  // The full set behind the Activities stat. Hosting only contributes on
  // other people's profiles (own-profile Going already covers it).
  const all = sortActivities(dedupeActivities(going, ownSaved, hosting), now);
  const upcomingGoing = sortActivities(
    dedupeActivities(going, hosting).filter((e) => !hasFinished(e, now)),
    now,
  );
  const past = all.filter((e) => hasFinished(e, now));

  const allTab: ActivityTab = {
    key: 'all',
    label: 'All',
    count: all.length,
    events: all,
    emptyBody: isOwnProfile
      ? 'Nothing here yet — activities you join or save land in this list.'
      : `${who} hasn’t joined any activities yet.`,
  };

  const goingTab: ActivityTab = {
    key: 'going',
    label: 'Going',
    count: upcomingGoing.length,
    events: upcomingGoing,
    emptyBody: isOwnProfile
      ? 'Nothing coming up. Activities you register for wait here until they’ve happened, then move to Past.'
      : `${who} has nothing coming up — anything they’ve been to is under Past.`,
  };

  const pastTab: ActivityTab = {
    key: 'past',
    label: 'Past',
    count: past.length,
    events: past,
    emptyBody: isOwnProfile
      ? 'Nothing has finished yet — activities move here once they’re over.'
      : `${who} hasn’t been to anything yet.`,
  };

  // ── Someone else's profile: All · Going · Past, no Saved ────────────────
  if (!isOwnProfile) {
    return [allTab, goingTab, pastTab];
  }

  // ── Your own profile: All · Going · Saved · Past ────────────────────────
  const upcomingSaved = sortActivities(
    ownSaved.filter((e) => !hasFinished(e, now)),
    now,
  );

  return [
    allTab,
    goingTab,
    {
      key: 'saved',
      label: 'Saved',
      count: upcomingSaved.length,
      events: upcomingSaved,
      emptyBody:
        'No upcoming saves — tap the bookmark on any activity and it waits here until it starts.',
    },
    pastTab,
  ];
}
