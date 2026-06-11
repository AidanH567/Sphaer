import React, { useState } from 'react';
import { ViewToggle } from './ViewToggle';
import { SearchFilterBar } from './SearchFilterBar';

type FeedView = 'list' | 'map' | 'mural';

interface FeedHeaderProps {
  activeView: FeedView;
  onViewChange: (view: FeedView) => void;
  selectedCategories?: string[];
  onToggleCategory: (category: string) => void;
  /** Optional: emit each keystroke of the search bar to the parent. */
  onSearchChange?: (text: string) => void;
  /** Optional neighbourhood filter — when both are passed, the row renders
   *  under the categories. Feed + Map opt in; Mural can leave it off. */
  selectedNeighborhood?: string | null;
  onNeighborhoodChange?: (next: string | null) => void;
}

/**
 * Activity feed header: search bar, view toggle (Feed/Map/Mural), category
 * filter chips, optional neighbourhood filter. Thin wrapper around the
 * shared SearchFilterBar — map.tsx and mural.tsx use this component too,
 * so its public API stays stable. Search text + neighbourhood are owned
 * by the parent when callbacks are provided; otherwise FeedHeader keeps
 * search text in local state for back-compat.
 */
export function FeedHeader({
  activeView,
  onViewChange,
  selectedCategories,
  onToggleCategory,
  onSearchChange,
  selectedNeighborhood,
  onNeighborhoodChange,
}: FeedHeaderProps) {
  const [searchText, setSearchTextLocal] = useState('');

  function handleSearchChange(next: string) {
    setSearchTextLocal(next);
    onSearchChange?.(next);
  }

  return (
    <SearchFilterBar
      searchText={searchText}
      onSearchChange={handleSearchChange}
      searchPlaceholder="Berlin, what’s on today?!"
      // Figma 4045:8204 resting header: pin + "Berlin what's on Today?!"
      // (city underlined) + circular search button. Exact frame copy.
      greeting={{ city: 'Berlin', rest: 'what’s on Today?!' }}
      selectedCategories={selectedCategories ?? []}
      onToggleCategory={onToggleCategory}
      selectedNeighborhood={selectedNeighborhood}
      onNeighborhoodChange={onNeighborhoodChange}
      middleSlot={<ViewToggle activeView={activeView} onViewChange={onViewChange} />}
    />
  );
}
