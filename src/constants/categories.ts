/**
 * The event/circle category vocabulary.
 *
 * ── Where the list comes from ────────────────────────────────────────────────
 * Lara's category sheet (2026-08-18), plus the two she added in her follow-up
 * report (Clubbing, Queer life), minus the two she asked to drop (Service,
 * Jobs). It is her wording verbatim, including the capitalisation — "Social
 * movements" is lowercase-m on her sheet where the old constant had
 * "Social Movements", and that one-character difference matters, because the
 * feed filter matches categories by exact string (`overlaps` in
 * `events.service.ts`, `includes` in `circle-filter.ts`).
 *
 * ── Why there is a second, shorter list ──────────────────────────────────────
 * 36 chips in one horizontal row is a scroll with no end in sight, so the
 * filter row shows `DEFAULT_FILTER_CATEGORIES` and hides the rest behind a
 * "More categories" chip (see `FilterBar.tsx`). Everywhere the user is
 * *tagging* something rather than *filtering* — create event, create circle,
 * edit circle, profile disciplines — still renders the full list, because
 * those screens are already wrapped grids you scroll vertically, and a tag you
 * cannot find is a tag nobody uses.
 *
 * The default set is not a taste judgement: it is every category that at least
 * one real event actually carries today (measured against production on
 * 2026-08-18, after the rename in
 * `supabase/migrations/20260818000000_rename_event_categories.sql`), plus
 * Queer life, which Lara named as missing and which should not sit behind a
 * button. A chip that returns an empty feed is worse than a chip one tap away.
 */

export const EVENT_CATEGORIES = [
  'Art',
  'Film',
  'Music',
  'Wellbeing',
  'Performing Arts',
  'Craft',
  'Design, Illustration, Animation',
  'Photography',
  'Festivals',
  'Street Art',
  'Fashion',
  'Exhibitions',
  'Academic',
  'Tech',
  'Tattoo',
  'Gaming',
  'Jam Session',
  'Spiritual',
  'Talk',
  'Workshops',
  'Social movements',
  'Coaching',
  'Learning',
  'Meet Ups',
  'Food & Drinks',
  'Markets',
  'Pop-ups',
  'Literature',
  'Language',
  'Sports',
  'Outdoors',
  'Volunteering',
  'Neighbourhood',
  'Family & Kids',
  'Clubbing',
  'Queer life',
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/**
 * The chips the filter row shows before you press "More categories".
 *
 * Kept in `EVENT_CATEGORIES` order so a category never moves when the row
 * expands — the default block stays put and the rest append after it.
 *
 * Typed as `readonly string[]` rather than a literal tuple on purpose: every
 * caller compares it against a plain `string` coming out of filter state, and
 * a literal union would reject that.
 */
export const DEFAULT_FILTER_CATEGORIES: readonly string[] = [
  'Art',
  'Film',
  'Music',
  'Wellbeing',
  'Performing Arts',
  'Exhibitions',
  'Tech',
  'Talk',
  'Workshops',
  'Learning',
  'Meet Ups',
  'Neighbourhood',
  'Clubbing',
  'Queer life',
];

/**
 * What every retired category name becomes.
 *
 * `events.categories` is `text[]` with no CHECK constraint, so nothing in the
 * database was ever validated against the old list — production carries five
 * values that were never in this file at all (`Community`, `Technology`,
 * `Nightlife`, `Dance`, `Exhibition`), written by the aggregator. Those rows
 * have been unreachable from the filter row since the day they landed; the new
 * vocabulary happens to have a good home for each, so they are folded in here
 * too.
 *
 * `null` means "drop the value" — Lara asked for Service and Jobs to go and
 * there is no successor to move them to. No event in production carries either
 * as its *only* category, so nothing ends up uncategorised.
 *
 * This map is the source of truth for
 * `supabase/migrations/20260818000000_rename_event_categories.sql`, and
 * `categories.test.ts` asserts the two stay in step. It is deliberately not
 * used at runtime: the migration rewrites the rows, and `FilterBar` keeps any
 * still-selected legacy value visible on its own (see the `extras` logic
 * there), so a normalisation shim on the read path would be a second source of
 * truth for no gain.
 */
export const LEGACY_CATEGORY_ALIASES: Readonly<Record<string, string | null>> = {
  // Renamed by Lara's sheet.
  Workshop: 'Workshops',
  'Social Movements': 'Social movements',
  Coach: 'Coaching',
  Wellness: 'Wellbeing',
  Meet: 'Meet Ups',
  Education: 'Learning',
  // Retired with a near neighbour rather than a rename.
  Therapy: 'Wellbeing',
  Concert: 'Music',
  // Never in this file — written by the aggregator, already unfilterable.
  Community: 'Neighbourhood',
  Technology: 'Tech',
  Nightlife: 'Clubbing',
  Dance: 'Performing Arts',
  Exhibition: 'Exhibitions',
  // Dropped at Lara's request, no successor.
  Service: null,
  Job: null,
};

export const CIRCLE_TAGS = [
  'Music',
  'Art',
  'Film',
  'Photography',
  'Dance',
  'Theater',
  'Literature',
  'Design',
  'Architecture',
  'Fashion',
  'Food',
  'Tech',
  'Activism',
  'Community',
] as const;

export type CircleTag = (typeof CIRCLE_TAGS)[number];
