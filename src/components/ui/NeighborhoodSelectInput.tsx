import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '@/constants/theme';
import {
  BERLIN_NEIGHBORHOODS,
  matchBerlinNeighborhood,
} from '@/constants/berlinNeighborhoods';

// The picker offers the curated 26 Berlin Ortsteile from
// src/constants/berlinNeighborhoods.ts — the SAME canonical list the feed
// filter and event geocoding already use, so a profile's neighbourhood is
// filterable/comparable against events for free. (We deliberately did NOT
// use the full ~96 official Ortsteile: events and the Explore filter are
// built around this curated subset, and a profile value outside it could
// never match anything in the app.) Alphabetically sorted for scanning.
const SORTED_NEIGHBORHOODS = [...BERLIN_NEIGHBORHOODS].sort((a, b) =>
  a.localeCompare(b, 'de')
);

const MAX_SUGGESTIONS = 8;

export interface NeighborhoodSelectInputProps {
  /** Currently stored neighbourhood ('' = none). May be a legacy free-text
   *  value that is not in the canonical list — it still renders, but the
   *  only way to CHANGE the field is to pick from the list (or clear). */
  value: string;
  /** Fires ONLY with a canonical list entry, or '' when cleared.
   *  Free text can never be committed. */
  onSelect: (neighborhood: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
}

/**
 * Searchable dropdown over the fixed Berlin neighbourhood list.
 * Replaces the old free-text neighbourhood input on profile
 * onboarding + edit — users were typing fake/misspelled neighbourhoods,
 * which broke location display and could never match the feed filter.
 *
 * Type to filter, tap to select. Typing alone never changes the stored
 * value: blur without a selection reverts to whatever was stored.
 */
export function NeighborhoodSelectInput({
  value,
  onSelect,
  label = 'Neighborhood (optional)',
  placeholder = 'Search Berlin neighbourhoods…',
  error,
}: NeighborhoodSelectInputProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  // Legacy data guard: an existing profile may hold a value that predates
  // the fixed list. Show it (the profile must keep rendering), but flag it
  // so the user picks a real one on their next edit.
  const isLegacyValue = value.length > 0 && matchBerlinNeighborhood(value) === null;

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return SORTED_NEIGHBORHOODS.slice(0, MAX_SUGGESTIONS);
    // startsWith matches first — "wed" should rank Wedding above nothing —
    // then substring matches (e.g. "berg" → Kreuzberg, Schöneberg, …).
    const starts = SORTED_NEIGHBORHOODS.filter((n) => n.toLowerCase().startsWith(q));
    const contains = SORTED_NEIGHBORHOODS.filter(
      (n) => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q)
    );
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [query]);

  function handlePick(neighborhood: string) {
    onSelect(neighborhood);
    setQuery('');
    setFocused(false);
    Keyboard.dismiss();
  }

  function handleClear() {
    onSelect('');
    setQuery('');
  }

  const showDropdown = focused;
  // While the dropdown is open the input is a search box; otherwise it
  // displays the stored value. Typing edits ONLY the query — the stored
  // value changes exclusively through handlePick/handleClear.
  const displayedText = focused ? query : value;

  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputRow,
          focused && styles.inputRowFocused,
          error ? styles.inputRowError : null,
        ]}
      >
        <Ionicons
          name={isLegacyValue ? 'alert-circle-outline' : 'location-outline'}
          size={18}
          color={isLegacyValue ? colors.badge.red : focused ? colors.black : colors.text.tertiary}
        />
        <TextInput
          value={displayedText}
          onChangeText={setQuery}
          onFocus={() => {
            setQuery('');
            setFocused(true);
          }}
          onBlur={() => {
            // Delay so a tap on a suggestion lands before the list hides
            // (same pattern as AddressAutocompleteInput).
            setTimeout(() => {
              setFocused(false);
              setQuery('');
            }, 180);
          }}
          placeholder={value.length > 0 ? value : placeholder}
          placeholderTextColor={colors.text.placeholder}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={label}
        />
        {!focused && value.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Clear neighborhood"
          >
            <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>

      {showDropdown && (
        <View style={styles.suggestionsBox}>
          {suggestions.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>
                No matching Berlin neighbourhood — pick one from the list.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.suggestionsScroll}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {suggestions.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={styles.suggestion}
                  onPress={() => handlePick(n)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${n}`}
                >
                  <Ionicons name="location" size={16} color={colors.text.secondary} />
                  <Text style={styles.suggestionText} numberOfLines={1}>
                    {n}
                  </Text>
                  {value === n && (
                    <Ionicons name="checkmark" size={16} color={colors.black} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {!showDropdown && isLegacyValue && !error && (
        <Text style={styles.legacyWarning}>
          “{value}” isn’t a Berlin neighbourhood we recognise — tap to pick one from the
          list.
        </Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.hiddenLines,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  inputRowFocused: { borderColor: colors.black },
  inputRowError: { borderColor: colors.badge.red },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    paddingVertical: 0,
    height: '100%',
  },

  suggestionsBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  suggestionsScroll: { maxHeight: 260 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestionText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  emptyRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },

  legacyWarning: {
    fontSize: typography.fontSize.xs,
    color: colors.badge.red,
  },
  error: {
    fontSize: typography.fontSize.xs,
    color: colors.badge.red,
  },
});
