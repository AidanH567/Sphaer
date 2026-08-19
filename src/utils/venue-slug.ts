/**
 * The client-side mirror of SQL `public.venue_slug()`
 * (20260818000000_venues_and_favourites.sql).
 *
 * ⚠️ These two implementations MUST agree. The database is the authority —
 * it is what the unique index enforces — and this copy exists only so the
 * app can answer "does a venue with this name already exist?" before
 * issuing an insert, and so the backfill's grouping can be reasoned about
 * in tests without a database. If you change one, change both; the test
 * file carries the table of cases that pins them together.
 *
 * Steps, in the same order as the SQL:
 *   1. lowercase + trim
 *   2. expand German umlauts the way they are actually typed in ASCII —
 *      ä→ae, ö→oe, ü→ue, ß→ss. NOT ä→a. The production events table
 *      already contains "Arena Neukoelln", hand-typed with "oe".
 *   3. fold remaining Latin-1 accents to bare letters
 *   4. every run of non-alphanumerics becomes one space; trim
 *   5. drop a leading/trailing "berlin" — "Privatclub" and
 *      "Privatclub Berlin" are one venue
 *   6. null if nothing survives
 */

const UMLAUT_EXPANSIONS: readonly [RegExp, string][] = [
  [/ä/g, 'ae'],
  [/ö/g, 'oe'],
  [/ü/g, 'ue'],
  [/ß/g, 'ss'],
  [/æ/g, 'ae'],
  [/ø/g, 'oe'],
  [/å/g, 'aa'],
];

/** Matches SQL's `translate(..., 'àáâãèéêëìíîïòóôõùúûñçý', 'aaaaeeeeiiiiooooouuuncy')`. */
const ACCENT_FROM = 'àáâãèéêëìíîïòóôõùúûñçý';
const ACCENT_TO = 'aaaaeeeeiiiiooooouuuncy';

function foldAccents(input: string): string {
  let out = '';
  for (const ch of input) {
    const i = ACCENT_FROM.indexOf(ch);
    out += i === -1 ? ch : ACCENT_TO[i];
  }
  return out;
}

/**
 * Canonical identity key for a venue name, or null when the name carries
 * no identity at all (empty, punctuation-only, or literally just "Berlin").
 */
export function venueSlug(name: string | null | undefined): string | null {
  if (name == null) return null;

  let s = name.trim().toLowerCase();
  for (const [pattern, replacement] of UMLAUT_EXPANSIONS) {
    s = s.replace(pattern, replacement);
  }
  s = foldAccents(s);
  s = s.replace(/[^a-z0-9]+/g, ' ').trim();
  s = s.replace(/^berlin\s+|\s+berlin$/g, '').trim();

  return s.length > 0 ? s : null;
}

/** Do these two names denote the same venue? */
export function sameVenue(a: string | null | undefined, b: string | null | undefined): boolean {
  const sa = venueSlug(a);
  const sb = venueSlug(b);
  return sa !== null && sa === sb;
}
