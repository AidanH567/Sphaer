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
}

/**
 * Activity feed header: search bar, view toggle (Feed/Map/Mural), category
 * filter chips. Thin wrapper around the shared SearchFilterBar component;
 * map.tsx and mural.tsx use this component too, so its public API is
 * deliberately stable — the search text state stays internal here unless
 * the parent provides an `onSearchChange` callback.
 */
export function FeedHeader({
  activeView,
  onViewChange,
  selectedCategories,
  onToggleCategory,
  onSearchChange,
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
      selectedCategories={selectedCategories ?? []}
      onToggleCategory={onToggleCategory}
      middleSlot={<ViewToggle activeView={activeView} onViewChange={onViewChange} />}
    />
  );
}
