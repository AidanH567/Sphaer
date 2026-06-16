import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Web-only auto-update for the public build.
 *
 * iOS Safari aggressively restores tabs from bfcache / in-memory without
 * re-downloading, so a returning visitor can sit on a stale build of the public
 * link indefinitely (this caused repeated "your changes aren't applying"
 * confusion during mural tuning even though every deploy was live). Content
 * hashing only helps on a real reload — a tab-switch or bfcache restore never
 * re-fetches index.html, so the new bundle is never seen.
 *
 * Fix: whenever the tab becomes visible again (visibilitychange → visible) or a
 * bfcache-restored page is shown (pageshow.persisted), fetch the live
 * index.html uncached and read the content-hashed `entry-<hash>.js` it
 * references. If that differs from the bundle THIS page actually loaded, a newer
 * build is live → reload (which bypasses bfcache and pulls the new bundle). A
 * sessionStorage guard stops reload loops if the CDN is momentarily
 * inconsistent. No-op on native, and on dev (the dev bundle isn't hash-named, so
 * `live` never matches and nothing reloads).
 */
const RELOAD_GUARD_KEY = 'sphaer:lastBuildReload';
const BUNDLE_RE = /entry-[a-f0-9]+\.js/;

export function useWebAutoUpdate() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    let checking = false;

    const loadedBundle = () =>
      document.querySelector('script[src*="entry-"]')?.getAttribute('src') ??
      null;

    const check = async () => {
      if (checking || document.visibilityState !== 'visible') return;
      checking = true;
      try {
        const loaded = loadedBundle();
        if (!loaded) return;
        const res = await fetch(`/?_=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const live = (await res.text()).match(BUNDLE_RE)?.[0] ?? null;
        if (!live || loaded.includes(live)) return;
        // A newer build is live and this page isn't on it.
        if (sessionStorage.getItem(RELOAD_GUARD_KEY) === live) return;
        sessionStorage.setItem(RELOAD_GUARD_KEY, live);
        window.location.reload();
      } catch {
        // Offline / fetch blocked — never let the update check break the app.
      } finally {
        checking = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void check();
    };

    void check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);
}
