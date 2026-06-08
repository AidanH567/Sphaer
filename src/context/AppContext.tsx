import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { EventFilters } from '@/types/event.types';

type FeedView = 'list' | 'map' | 'mural';

export interface PosterSize {
  width: number;
  height: number;
}

interface AppContextValue {
  feedView: FeedView;
  setFeedView: (view: FeedView) => void;
  feedFilters: EventFilters;
  setFeedFilters: (filters: EventFilters) => void;
  /** Cache for Image.getSize() results, keyed by poster_url. Lives at app
   *  scope so navigating into a poster and back doesn't re-trigger the
   *  HEAD-style network round-trip when Mural remounts. Read via getter to
   *  keep AppContext's render path clean — writes go through setPosterSize. */
  getPosterSize: (url: string) => PosterSize | undefined;
  setPosterSize: (url: string, size: PosterSize) => void;
}

const AppContext = createContext<AppContextValue>({
  feedView: 'list',
  setFeedView: () => {},
  feedFilters: {},
  setFeedFilters: () => {},
  getPosterSize: () => undefined,
  setPosterSize: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [feedView, setFeedView] = useState<FeedView>('list');
  const [feedFilters, setFeedFilters] = useState<EventFilters>({});

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

  return (
    <AppContext.Provider
      value={{
        feedView,
        setFeedView,
        feedFilters,
        setFeedFilters,
        getPosterSize,
        setPosterSize,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
