import type { EventWithRelations } from '@/types/event.types';

/**
 * Profile activity tabs — the data model behind the tab strip that replaced
 * the Saved / Activities / Tickets buttons on both profile screens.
 *
 * Lara's complaint was that those three controls "do the same thing". They
 * very nearly did. Measured against production on 2026-08-17:
 *
 *   - `Activities` was defined as (events I created) ∪ (events I registered
 *     for). The `on_event_created` trigger auto-inserts a registration row
 *     for every creator, so `created ⊆ registered` — verified: 0 of 56 events
 *     lacked a creator registration row.
 *   - `Tickets` was (events I registered for).
 *
 * So `Activities` and `Tickets` were the SAME QUERY wearing two labels, for
 * all 23 users with any data. That is the redundancy, and it is why the fix
 * had to be an information-architecture change and not a visual one.
 *
 * The tabs below are real subsets with real, measured differences (Lara's own
 * profile: All 8, Going 4, Saved 5, Tickets 2):
 *
 *   All      = Going ∪ Saved, deduped
 *   Going    = activities you're registered for (includes ones you host)
 *   Saved    = activities you bookmarked          — PRIVATE, own profile only
 *   Tickets  = the Going subset that is ticketed  — PRIVATE, own profile only
 *
 * `Tickets ⊆ Going ⊆ All` by construction, so "All" never double-counts.
 */
export type ActivityTabKey = 'all' | 'going' | 'saved' | 'tickets' | 'hosting';

export interface ActivityTab {
  key: ActivityTabKey;
  label: string;
  count: number;
  events: EventWithRelations[];
  /** Shown when this tab has nothing in it. */
  emptyBody: string;
}

/**
 * Is this activity ticketed rather than free-entry?
 *
 * Three independent signals, any one of which means "there is a ticket":
 * an explicit `is_free === false`, a positive price, or an external
 * `ticket_url`. Measured on production: 38 of 56 activities are paid and 10
 * carry a ticket_url, so this is a substantial proper subset (~62% of a
 * typical user's Going list) rather than a tab that is always empty.
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
 * Merge activity lists into one, keeping the first occurrence of each id.
 *
 * Replaces `mergeUserActivities` from the deleted UserEventsSheet — same
 * dedup-by-id contract, but variadic so "All" can fold Going and Saved
 * together without a second pass.
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
 * The old sheet exposed Upcoming/Past as yet another pair of tabs; folding
 * the ordering in here means one list reads chronologically without adding a
 * second axis of navigation on top of the activity tabs.
 */
export function sortActivities(
  events: EventWithRelations[],
  now: number = Date.now(),
): EventWithRelations[] {
  const upcoming = events
    .filter((e) => +new Date(e.starts_at) >= now)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const past = events
    .filter((e) => +new Date(e.starts_at) < now)
    .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));
  return [...upcoming, ...past];
}

interface BuildTabsInput {
  /** Activities the profile's owner is registered for. */
  going: EventWithRelations[];
  /** Bookmarked activities. Always empty for a profile that isn't yours. */
  saved: EventWithRelations[];
  /**
   * Activities this person CREATED. Only fetched for other people's
   * profiles, where it is the second tab.
   *
   * Own profile doesn't need it: your Going list already contains everything
   * you host (the `on_event_created` trigger registers creators), so a
   * "Hosting" tab there would duplicate a slice of Going that Saved and
   * Tickets already carve up.
   */
  hosting?: EventWithRelations[];
  /**
   * Own profile shows the private tabs (Saved, Tickets); someone else's does
   * not. `saved_events` RLS is `USING (auth.uid() = user_id)`, so another
   * user's saved list reads back as empty — rendering a "Saved" tab there
   * would assert "they saved nothing", which we cannot know. Hiding it is
   * the only honest option.
   */
  isOwnProfile: boolean;
  /** Display name, used to word other-people empty states. */
  displayName?: string;
}

export function buildActivityTabs({
  going,
  saved,
  hosting = [],
  isOwnProfile,
  displayName,
}: BuildTabsInput): ActivityTab[] {
  const who = displayName?.trim() || 'This artist';
  const sortedGoing = sortActivities(going);
  const all = sortActivities(dedupeActivities(going, saved));

  const allTab: ActivityTab = {
    key: 'all',
    label: 'All',
    count: all.length,
    events: all,
    emptyBody: isOwnProfile
      ? 'Nothing here yet — activities you join or save will show up in this list.'
      : `${who} hasn't joined any activities yet.`,
  };

  // ── Someone else's profile ────────────────────────────────────────────
  // All + Hosting. Deliberately NOT All + Going: without access to their
  // saved list, All and Going are the same query, and shipping two tabs over
  // one list would recreate exactly the redundancy this change removed.
  // Hosting is a real, visibly different subset (measured on production: a
  // user with 45 registrations hosts 8 of them).
  if (!isOwnProfile) {
    return [
      allTab,
      {
        key: 'hosting',
        label: 'Hosting',
        count: hosting.length,
        events: sortActivities(hosting),
        emptyBody: `${who} hasn't hosted an activity yet.`,
      },
    ];
  }

  // ── Your own profile ──────────────────────────────────────────────────
  return [
    allTab,
    {
      key: 'going',
      label: 'Going',
      count: sortedGoing.length,
      events: sortedGoing,
      emptyBody:
        "You're not going to anything yet — find something on the feed and register.",
    },
    {
      key: 'saved',
      label: 'Saved',
      count: saved.length,
      events: sortActivities(saved),
      emptyBody:
        'No saved activities yet — tap the bookmark on any activity to keep it for later.',
    },
    {
      key: 'tickets',
      label: 'Tickets',
      count: sortedGoing.filter(isTicketed).length,
      events: sortedGoing.filter(isTicketed),
      emptyBody:
        "No tickets yet — the activities you're going to that need a ticket land here.",
    },
  ];
}
