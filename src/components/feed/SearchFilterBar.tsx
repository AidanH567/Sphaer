import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, motion, radius } from '@/constants/theme';
import { FilterBar } from './FilterBar';
import { NeighborhoodFilter } from './NeighborhoodFilter';

interface SearchFilterBarProps {
  /** Current search text — owned by the parent so it can run the filter. */
  searchText: string;
  onSearchChange: (text: string) => void;
  searchPlaceholder?: string;

  /** Selected category chips — owned by the parent. */
  selectedCategories: string[];
  onToggleCategory: (category: string) => void;

  /** Optional neighbourhood filter — shown under the categories when both
   *  the neighbourhood props are wired (Feed + Map pass these, Mural
   *  doesn't need to). */
  selectedNeighborhood?: string | null;
  onNeighborhoodChange?: (next: string | null) => void;

  /**
   * Optional content rendered between the search row and the categories row.
   * Used by FeedHeader to host the Feed / Map / Mural ViewToggle.
   */
  middleSlot?: React.ReactNode;

  /**
   * Figma 4045:8204 collapsed-header variant. When set, the resting state
   * renders a greeting line (location pin + serif text, the city name
   * underlined) with a circular search button on the right, instead of the
   * always-on input pill. Tapping the button expands into the standard
   * search input + Cancel; Cancel collapses back to the greeting.
   * Circles (and any caller that omits this) keeps the input pill.
   */
  greeting?: { city: string; rest: string };

  /** Override the default background (defaults to appleMail used by feed). */
  style?: ViewStyle;
}

/**
 * Shared search-and-filter header used by both the Activity Feed and the
 * Circles page.
 *
 * ─── Why this exists ────────────────────────────────────────────────
 * The previous implementation tied the visibility of the categories row to
 * the TextInput's focus state. On web that produced a "blur-before-click"
 * race: tapping a category chip moved focus away from the TextInput, which
 * fired `onBlur` → `setSearchActive(false)` → re-render that *unmounted*
 * the categories row including the chip the user was clicking. The chip's
 * `onPress` then never fired.
 *
 * The fix decouples `searchActive` (whether the user is in "filter mode")
 * from TextInput focus. `searchActive` becomes true when the user taps the
 * search bar and stays true until they tap "Cancel" — blur is irrelevant.
 *
 * ─── Visibility rule ───────────────────────────────────────────────
 * The categories row is shown when ANY of these are true:
 *   - searchActive is true
 *   - searchText is non-empty
 *   - one or more categories are selected
 * It hides only when all three are clean.
 *
 * Cancel collapses the search input back to its placeholder and clears
 * `searchText`. It does NOT clear `selectedCategories` — if any chips are
 * still selected, the row stays visible (`hasSelectedCategories` keeps the
 * visibility rule satisfied). Deselecting all chips fully closes the row.
 */
export function SearchFilterBar({
  searchText,
  onSearchChange,
  searchPlaceholder = 'Search…',
  selectedCategories,
  onToggleCategory,
  selectedNeighborhood,
  onNeighborhoodChange,
  middleSlot,
  greeting,
  style,
}: SearchFilterBarProps) {
  const insets = useSafeAreaInsets();
  const [searchActive, setSearchActive] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const hasSearchText = searchText.length > 0;
  const hasSelectedCategories = selectedCategories.length > 0;
  const hasNeighborhood = Boolean(selectedNeighborhood);
  const showCategories =
    searchActive || hasSearchText || hasSelectedCategories || hasNeighborhood;
  const showNeighborhoodFilter = showCategories && Boolean(onNeighborhoodChange);

  function activateSearch() {
    setSearchActive(true);
    // Slight delay lets the TextInput mount before we focus it.
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancelSearch() {
    setSearchActive(false);
    onSearchChange('');
    inputRef.current?.blur();
  }

  // Whether to render the editable TextInput vs the tappable placeholder
  const showTextInput = searchActive || hasSearchText;

  // ─── Greeting variant (Figma 4045:8204) ──────────────────────────
  // Resting state shows the greeting line + circular search button instead
  // of the input pill; expanding swaps to the standard input + Cancel.
  const isGreetingVariant = Boolean(greeting);
  const showGreeting = isGreetingVariant && !showTextInput;

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // Crossfade the row content when the greeting variant swaps between the
  // greeting line and the search input. Opacity-only (no layout animation)
  // so the categories row below never shifts mid-transition.
  const rowFade = useRef(new Animated.Value(1)).current;
  const prevShowGreeting = useRef(showGreeting);
  useEffect(() => {
    if (!isGreetingVariant || prevShowGreeting.current === showGreeting) return;
    prevShowGreeting.current = showGreeting;
    if (reduceMotion) {
      rowFade.setValue(1);
      return;
    }
    rowFade.setValue(0);
    Animated.timing(rowFade, {
      toValue: 1,
      duration: motion.duration.standard,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [showGreeting, isGreetingVariant, reduceMotion, rowFade]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 26 }, style]}>
      <View style={[styles.searchRow, isGreetingVariant && styles.searchRowGreeting]}>
        <Animated.View style={[styles.rowContent, isGreetingVariant && { opacity: rowFade }]}>
          {showGreeting && greeting ? (
            <>
              {/* Figma 4045:8249 — pin + serif greeting, city underlined */}
              <View style={styles.greetingLine}>
                <Ionicons name="location-outline" size={20} color={colors.neutral.ink} />
                <Text style={styles.greetingText} numberOfLines={1}>
                  <Text style={styles.greetingCity}>{greeting.city}</Text>
                  {` ${greeting.rest}`}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.searchButton}
                onPress={activateSearch}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Search"
              >
                <Ionicons name="search-outline" size={20} color={colors.neutral.ink} />
              </TouchableOpacity>
            </>
          ) : showTextInput ? (
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={22} color={colors.text.primary} />
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                value={searchText}
                onChangeText={onSearchChange}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.text.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onFocus={() => setSearchActive(true)}
                // NOTE: no onBlur deactivation — see comment block at top.
              />
              {hasSearchText && (
                <TouchableOpacity
                  onPress={() => onSearchChange('')}
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
              <Text style={styles.searchPlaceholder}>{searchPlaceholder}</Text>
            </TouchableOpacity>
          )}

          {searchActive && (
            <TouchableOpacity
              onPress={cancelSearch}
              style={styles.cancelButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {middleSlot && <View style={styles.middleSlot}>{middleSlot}</View>}

      {showCategories && (
        <View style={styles.filterWrapper}>
          <FilterBar
            selectedCategories={selectedCategories}
            onToggleCategory={onToggleCategory}
          />
        </View>
      )}

      {showNeighborhoodFilter && onNeighborhoodChange && (
        <View style={styles.neighborhoodWrapper}>
          <NeighborhoodFilter
            value={selectedNeighborhood ?? null}
            onChange={onNeighborhoodChange}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.appleMail,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 24,
  },
  // Figma 4045:8230 header container: 16px horizontal inset (vs the 30px
  // the Circles pill layout uses). Applied whenever the greeting variant is
  // active — resting AND expanded — so edges don't jump mid-transition.
  searchRowGreeting: {
    paddingHorizontal: 16,
  },
  // minHeight pins the row to the input pill's 50px so swapping to the
  // 45px circular button doesn't shift the rows below.
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 50,
  },

  // ─── Greeting variant (Figma 4045:8249) ─────────────────────────
  greetingLine: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
  },
  greetingText: {
    flex: 1,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.lg,
    lineHeight: 29.6, // Figma: 148%
    color: colors.neutral.ink,
  },
  greetingCity: {
    fontWeight: typography.fontWeight.medium,
    textDecorationLine: 'underline',
  },
  searchButton: {
    width: 45,
    height: 45,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
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
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.md,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.regular,
  },

  searchInput: {
    flex: 1,
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    paddingVertical: 0,
    minWidth: 0,
  },

  cancelButton: {
    paddingVertical: 4,
  },
  cancelText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: colors.black,
    fontWeight: typography.fontWeight.medium,
  },

  middleSlot: {
    paddingHorizontal: 30,
    paddingBottom: 20,
  },

  filterWrapper: {
    paddingBottom: 12,
  },
  neighborhoodWrapper: {
    paddingBottom: 12,
  },
});
