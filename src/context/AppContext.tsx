import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/context/AuthContext';
import { getBlockedIds } from '@/services/moderation.service';
import type { EventFilters } from '@/types/event.types';

type FeedView = 'list' | 'map' | 'mural';

export interface PosterSize {
  width: number;
  height: number;
}

export interface UserCoords {
  lat: number;
  lng: number;
}

interface AppContextValue {
  feedView: FeedView;
  setFeedView: (view: FeedView) => void;
  feedFilters: EventFilters;
  setFeedFilters: (filters: EventFilters) => void;
  /**
   * User's last-known coordinates. Acquired via `expo-location` the first
   * time the user toggles "Near me" on the feed; subsequent toggles reuse
   * the cached value. `null` = either denied permission or not yet asked.
   * Lives here rather than in `feedFilters` so the filter can stay
   * serialisable without leaking geo into URL state.
   */
  userCoords: UserCoords | null;
  setUserCoords: (coords: UserCoords | null) => void;
  /** Cache for Image.getSize() results, keyed by poster_url. Lives at app
   *  scope so navigating into a poster and back doesn't re-trigger the
   *  HEAD-style network round-trip when Mural remounts. Read via getter to
   *  keep AppContext's render path clean — writes go through setPosterSize. */
  getPosterSize: (url: string) => PosterSize | undefined;
  setPosterSize: (url: string, size: PosterSize) => void;
  /**
   * Increments every time the app returns to the foreground
   * (background/inactive → active). Hooks and screens can put it in an
   * effect/useMemo dependency array to refetch or recompute on resume —
   * e.g. useNotifications re-binds its Realtime channel + refetches, and
   * time-window filters ("tonight" / "this weekend", which evaluate
   * against `new Date()` at compute time) get a chance to recompute after
   * the app slept past midnight or across a DST shift instead of serving
   * yesterday's window.
   */
  foregroundTick: number;
  /**
   * Profile ids the signed-in user has blocked (App Store Guideline 1.2 —
   * blocked users' content must disappear). Hydrated on auth and on app
   * resume; refreshed after block/unblock via refreshBlocked(). Feed,
   * messages inbox, and group-chat hooks filter against this Set
   * client-side — cheap O(1) lookups, and it keeps working even before
   * the blocked_users table exists server-side (reads degrade to empty).
   */
  blockedIds: Set<string>;
  refreshBlocked: () => Promise<void>;
}

const AppContext = createContext<AppContextValue>({
  feedView: 'list',
  setFeedView: () => {},
  feedFilters: {},
  setFeedFilters: () => {},
  userCoords: null,
  setUserCoords: () => {},
  getPosterSize: () => undefined,
  setPosterSize: () => {},
  foregroundTick: 0,
  blockedIds: new Set<string>(),
  refreshBlocked: async () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const [feedView, setFeedView] = useState<FeedView>('list');
  const [feedFilters, setFeedFilters] = useState<EventFilters>({});
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);

  // Plain Map ref — reads don't trigger renders, writes notify the Mural via
  // its own `useMuralDimensions` loading-progress state. Keeps the rest of
  // the app from re-rendering every time a poster's dimensions resolve.
  const posterSizesRef = useRef<Map<string, PosterSize>>(new Map());
  const getPosterSize = useCallback(
    (url: string) => posterSizesRef.current.get(url),
    []
  );
  const setPosterSize = useCallback((url: string, size: PosterSize) => {
    posterSizesRef.current.set(url, size);
  }, []);

  // ── Foreground resume ──────────────────────────────────────────────────
  // iOS/Android freeze JS timers and silently drop the Realtime websocket
  // while the app is backgrounded. On background→active we (a) reconnect
  // the shared Realtime socket if it dropped, and (b) bump foregroundTick
  // so consumers can refetch/recompute. The tick also addresses the
  // "tonight" / "this weekend" staleness: those chip windows are computed
  // against `new Date()` at render time, so a feed restored the next
  // morning (or across a DST change) keeps showing the old window until a
  // tick consumer re-renders it.
  const [foregroundTick, setForegroundTick] = useState(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const wasBackgrounded =
        appStateRef.current === 'background' || appStateRef.current === 'inactive';
      if (wasBackgrounded && next === 'active') {
        if (!supabase.realtime.isConnected()) {
          supabase.realtime.connect();
        }
        setForegroundTick((n) => n + 1);
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  // ── Blocked users ──────────────────────────────────────────────────────
  const userId = user?.id;
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());

  const refreshBlocked = useCallback(async () => {
    if (!userId) {
      setBlockedIds(new Set());
      return;
    }
    try {
      setBlockedIds(new Set(await getBlockedIds(userId)));
    } catch (err) {
      // Transient failure (network): keep the previous set — flashing a
      // blocked user's content back in would be worse than a stale list.
      // ("Table missing" already degrades to [] inside the service.)
      if (__DEV__) console.error('[AppContext] refreshBlocked failed:', err);
    }
  }, [userId]);

  // Hydrate on sign-in/out and re-check on app resume — a cheap id-only
  // select, so piggybacking on foregroundTick costs one tiny query.
  useEffect(() => {
    void foregroundTick;
    refreshBlocked();
  }, [refreshBlocked, foregroundTick]);

  return (
    <AppContext.Provider
      value={{
        feedView,
        setFeedView,
        feedFilters,
        setFeedFilters,
        userCoords,
        setUserCoords,
        getPosterSize,
        setPosterSize,
        foregroundTick,
        blockedIds,
        refreshBlocked,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
