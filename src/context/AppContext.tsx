import React, { createContext, useContext, useState } from 'react';
import type { EventFilters } from '@/types/event.types';

type FeedView = 'list' | 'map' | 'mural';

interface AppContextValue {
  feedView: FeedView;
  setFeedView: (view: FeedView) => void;
  feedFilters: EventFilters;
  setFeedFilters: (filters: EventFilters) => void;
}

const AppContext = createContext<AppContextValue>({
  feedView: 'list',
  setFeedView: () => {},
  feedFilters: {},
  setFeedFilters: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [feedView, setFeedView] = useState<FeedView>('list');
  const [feedFilters, setFeedFilters] = useState<EventFilters>({});

  return (
    <AppContext.Provider value={{ feedView, setFeedView, feedFilters, setFeedFilters }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
