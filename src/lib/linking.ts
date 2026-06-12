import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Deep-link plumbing.
 *
 * expo-router already does the heavy lifting on native: it reads
 * Linking.getInitialURL() on cold start, subscribes to 'url' events while
 * running, and converts both `sphaer://event/x` and `https://<any host>/event/x`
 * into route paths (see expo-router's fork/extractPathFromURL). So nothing
 * here navigates from raw URLs — that would double-navigate.
 *
 * What this module owns instead:
 *  1. pathFromUrl — a strict normalizer for URLs that arrive as *data*
 *     (future push-notification payloads, pasted links) rather than as an
 *     OS open. Unlike expo-router's permissive origin-stripping, it rejects
 *     foreign hosts and non-app paths.
 *  2. The "pending deep link" stash — survives the signed-out auth redirect
 *     (and the OAuth round-trip app restart) so the target can be resumed
 *     after sign-in. Stashed by app/(tabs)/_layout, consumed by the
 *     PendingDeepLinkGate in app/_layout.
 *
 * Universal Links / App Links are deliberately NOT configured yet (gated on
 * the Apple dev account). When they land, the hook-in points are app.json —
 * `ios.associatedDomains: ["applinks:sphaer.app"]` plus the hosted AASA
 * file, and `android.intentFilters` (autoVerify) plus assetlinks.json.
 * app.json is plain JSON and can't carry this comment, so it lives here.
 * Once added, https://sphaer.app URLs open the app directly; expo-router
 * routes them as-is and nothing in this module needs to change.
 */

/** Hosts whose https URLs are ours. Everything else is foreign. */
const APP_HOSTS = new Set(['sphaer.app', 'www.sphaer.app']);

const APP_SCHEME = 'sphaer:';

/**
 * In-app paths that external links / notifications are allowed to open.
 * Paths are case-sensitive, matching expo-router's own route matching.
 */
const DEEP_LINKABLE_PATTERNS: readonly RegExp[] = [
  /^\/event\/[^/?#]+$/,
  /^\/user\/[^/?#]+$/,
  /^\/circles\/[^/?#]+$/,
  /^\/messages\/[^/?#]+$/,
  /^\/messages\/circle\/[^/?#]+$/,
  /^\/messages\/event\/[^/?#]+$/,
  /^\/ticket\/[^/?#]+$/,
  /^\/notifications$/,
];

/** Strip trailing slashes ('/event/x/' → '/event/x'); '' stays ''. */
function normalizePath(path: string): string {
  return path.replace(/\/+$/, '');
}

/**
 * True when `path` (optionally carrying a query string) is an in-app route
 * that deep links are allowed to target.
 */
export function isDeepLinkablePath(path: string): boolean {
  const pathnameOnly = normalizePath(path.split(/[?#]/, 1)[0]);
  return DEEP_LINKABLE_PATTERNS.some((re) => re.test(pathnameOnly));
}

/**
 * Normalize a URL into an in-app route path, or null when it isn't one.
 *
 *   sphaer://event/x              → /event/x
 *   https://sphaer.app/event/x    → /event/x
 *   https://www.sphaer.app/event/x → /event/x
 *   https://evil.com/event/x      → null
 *   javascript:alert(1)           → null
 *   https://sphaer.app/admin      → null
 *
 * Behavior decisions (mirrored in tests):
 *  - Query strings are PRESERVED verbatim (push payloads may carry params;
 *    expo-router surfaces them via useLocalSearchParams). Fragments dropped.
 *  - Trailing slashes stripped.
 *  - Scheme and https host are case-insensitive; the path is case-sensitive
 *    (routes are lowercase, IDs keep their case).
 *  - https only — plain http is treated as foreign.
 */
export function pathFromUrl(url: string): string | null {
  if (typeof url !== 'string' || url === '') return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Not an absolute URL (bare paths, garbage). Callers with a known-good
    // in-app path should use isDeepLinkablePath directly.
    return null;
  }

  let rawPath: string;
  if (parsed.protocol === APP_SCHEME) {
    // Custom scheme: everything after `sphaer://` is the path. WHATWG URL
    // parses the first segment as the host ('sphaer://event/x' → host
    // 'event', pathname '/x'), so stitch them back together.
    const joined = `${parsed.host}${parsed.pathname}`;
    rawPath = joined.startsWith('/') ? joined : `/${joined}`;
  } else if (parsed.protocol === 'https:' && APP_HOSTS.has(parsed.hostname)) {
    rawPath = parsed.pathname;
  } else {
    return null;
  }

  const path = normalizePath(rawPath);
  if (path === '' || !isDeepLinkablePath(path)) return null;
  return `${path}${parsed.search}`;
}

// ─── Pending deep link (signed-out cold start) ───────────────────────────────
//
// Cold-starting a deep link while signed out hits the auth gate in
// app/(tabs)/_layout, which redirects to (auth) and would silently drop the
// target. The gate stashes it here first. A module variable covers the
// no-restart case; AsyncStorage covers the OAuth round trip, which can
// relaunch the app and wipe module state. Stale stashes expire so a link
// tapped days ago can't teleport the user on an unrelated sign-in.

const PENDING_DEEP_LINK_KEY = 'sphaer:pending-deeplink';
const PENDING_DEEP_LINK_TTL_MS = 15 * 60 * 1000;

interface PendingDeepLink {
  path: string;
  ts: number;
}

let pendingInMemory: PendingDeepLink | null = null;

function parsePendingDeepLink(raw: string): PendingDeepLink | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value !== null &&
      typeof value === 'object' &&
      typeof (value as Record<string, unknown>).path === 'string' &&
      typeof (value as Record<string, unknown>).ts === 'number'
    ) {
      return value as unknown as PendingDeepLink;
    }
  } catch {
    // Corrupted entry — treat as absent.
  }
  return null;
}

/**
 * Remember a deep-link target the auth redirect is about to stomp.
 * No-op for paths outside the deep-linkable allowlist. Safe to call from
 * effects — the storage write is fire-and-forget.
 */
export function stashPendingDeepLink(path: string): void {
  if (!isDeepLinkablePath(path)) return;
  const entry: PendingDeepLink = { path, ts: Date.now() };
  pendingInMemory = entry;
  AsyncStorage.setItem(PENDING_DEEP_LINK_KEY, JSON.stringify(entry)).catch(() => {
    // Memory copy still covers the no-restart flow.
  });
}

/**
 * Return the stashed target once and clear it (memory + storage).
 * null when nothing is stashed, the entry is older than 15 minutes, or it
 * fails allowlist re-validation.
 */
export async function consumePendingDeepLink(): Promise<string | null> {
  let entry = pendingInMemory;
  pendingInMemory = null;

  if (!entry) {
    try {
      const raw = await AsyncStorage.getItem(PENDING_DEEP_LINK_KEY);
      entry = raw === null ? null : parsePendingDeepLink(raw);
    } catch {
      entry = null;
    }
  }

  await AsyncStorage.removeItem(PENDING_DEEP_LINK_KEY).catch(() => {
    // Expiry makes a leftover entry harmless.
  });

  if (!entry) return null;
  if (Date.now() - entry.ts > PENDING_DEEP_LINK_TTL_MS) return null;
  if (!isDeepLinkablePath(entry.path)) return null;
  return entry.path;
}
