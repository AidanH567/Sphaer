/**
 * Provenance: did a person post this event, or did Tina's aggregator read it
 * off a public feed?
 *
 * `events.source` (migration 20260817200000) is the discriminator and the
 * ONLY one — there is no boolean, no flag column:
 *
 *   source IS NULL          → a person posted it in the app
 *   source LIKE 'tina:%'    → imported from a public feed (tina:ics,
 *                             tina:rss, tina:jsonld)
 *
 * Production today holds 56 human-posted and 96 aggregated rows.
 *
 * These helpers exist so the rule lives in exactly one place. `source` is not
 * on the generated `Event` type yet — src/types/supabase.ts predates the
 * migration — so `EventWithRelations` declares the three provenance columns
 * as optional and every read goes through here.
 *
 * Deliberately structural (`{ source?: string | null }`) rather than typed
 * against `EventWithRelations`: event.types.ts imports `EventOrigin` from
 * here, and keeping this module dependency-free stops that from becoming a
 * cycle.
 */

/** The two sides of the feed's provenance filter. Named from the user's side
 *  of the screen, not the column's: `aggregated` is what the UI calls
 *  "Found around Berlin". */
export type EventOrigin = 'community' | 'aggregated';

/** True when Tina's aggregator wrote this row. Empty/whitespace `source` is
 *  treated as human — a blank string is not a feed name, and mis-classifying
 *  one as imported would put a "found around Berlin" credit on a person's
 *  own event. */
export function isAggregated(event: { source?: string | null }): boolean {
  const source = event.source;
  return typeof source === 'string' && source.trim().length > 0;
}

/** True when a person posted this in the app — the exact complement of
 *  `isAggregated`, spelled out so call sites read positively. */
export function isCommunityPosted(event: { source?: string | null }): boolean {
  return !isAggregated(event);
}

/** Does this event belong in the given filter state? `undefined` origin means
 *  "All" and matches everything. */
export function matchesOrigin(
  event: { source?: string | null },
  origin: EventOrigin | undefined,
): boolean {
  if (!origin) return true;
  return origin === 'aggregated' ? isAggregated(event) : isCommunityPosted(event);
}

/**
 * The host we credit an aggregated listing to — "privatclub-berlin.de" from
 * "https://www.privatclub-berlin.de/events/123?utm=x".
 *
 * Hand-parsed rather than `new URL()`: Hermes has URL, but react-native's
 * polyfill history is patchy enough that a malformed `source_url` throwing
 * inside a FlatList row is a real risk, and there is nothing here worth a
 * try/catch. `www.` is dropped because it is noise to a reader.
 *
 * Returns null for anything that doesn't look like a host, so the caller can
 * fall back to the venue name instead of printing a broken credit.
 */
export function sourceHost(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl) return null;
  const withoutScheme = sourceUrl.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  // Cut at the first path / query / fragment / port separator.
  const host = withoutScheme.split(/[/?#:]/)[0]?.toLowerCase() ?? '';
  const bare = host.replace(/^www\./, '');
  // A host needs a dot and no whitespace; anything else is not worth showing.
  if (!bare.includes('.') || /\s/.test(bare)) return null;
  return bare;
}

/**
 * The one-line credit under an aggregated event: "via privatclub-berlin.de",
 * falling back to the venue when the row has no usable `source_url`.
 *
 * Null for human-posted events (nothing to credit) and for aggregated events
 * with neither a source host nor a venue — better a missing line than "via".
 */
export function sourceCreditLabel(
  event: { source?: string | null; source_url?: string | null; location_name?: string | null },
): string | null {
  if (!isAggregated(event)) return null;
  const host = sourceHost(event.source_url);
  if (host) return `via ${host}`;
  const venue = event.location_name?.trim();
  return venue ? `via ${venue}` : null;
}
