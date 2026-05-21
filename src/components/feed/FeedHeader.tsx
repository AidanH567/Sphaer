import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '@/constants/theme';
import { ViewToggle } from './ViewToggle';
import { FilterBar } from './FilterBar';

type FeedView = 'list' | 'map' | 'mural';

interface FeedHeaderProps {
  activeView: FeedView;
  onViewChange: (view: FeedView) => void;
  selectedCategories?: string[];
  onToggleCategory: (category: string) => void;
}

export function FeedHeader({
  activeView,
  onViewChange,
  selectedCategories,
  onToggleCategory,
}: FeedHeaderProps) {
  const insets = useSafeAreaInsets();
  const [searchActive, setSearchActive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const prevView = useRef(activeView);
  if (prevView.current !== activeView) {
    prevView.current = activeView;
    if (searchActive) setSearchActive(false);
    if (searchText) setSearchText('');
  }

  const hasSelectedCategories = (selectedCategories?.length ?? 0) > 0;
  const showCategories = searchActive || hasSelectedCategories;

  function activateSearch() {
    setSearchActive(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function deactivateSearch() {
    setSearchActive(false);
    setSearchText('');
    Keyboard.dismiss();
  }

  return (
    <Pressable
      style={[styles.container, { paddingTop: insets.top + 26 }]}
      onPress={deactivateSearch}
    >
      <View style={styles.searchRow}>
        {searchActive ? (
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={22} color={colors.text.primary} />

            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search events..."
              placeholderTextColor={colors.text.placeholder}
              autoCapitalize="none"
              returnKeyType="search"
              onBlur={() => {
                if (!hasSelectedCategories) {
                  setSearchActive(false);
                }
              }}
            />

            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchText('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.searchBar}
            onPress={activateSearch}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={22} color={colors.text.primary} />
            <Text style={styles.searchPlaceholder}>Berlin, what’s on today?!</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.viewToggleRow}>
        <ViewToggle activeView={activeView} onViewChange={onViewChange} />
      </View>

      {showCategories && (
        <View style={styles.filterWrapper}>
          <FilterBar
            selectedCategories={selectedCategories ?? []}
            onToggleCategory={onToggleCategory}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.appleMail,
    borderBottomWidth: 0,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 24,
  },

  searchBar: {
    flex: 1,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingHorizontal: 20,

    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },

  searchPlaceholder: {
    fontSize: 17,
    color: colors.text.tertiary,
    fontWeight: '400',
  },

  searchInput: {
    flex: 1,
    fontSize: 17,
    color: colors.text.primary,
    paddingVertical: 0,
    minWidth: 0,
  },

  viewToggleRow: {
    paddingHorizontal: 30,
    paddingBottom: 20,
  },

  filterWrapper: {
    paddingBottom: 12,
  },
});