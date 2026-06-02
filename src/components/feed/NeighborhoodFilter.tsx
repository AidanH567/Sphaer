import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { BERLIN_BOROUGHS, BERLIN_NEIGHBORHOODS } from '@/constants/berlinNeighborhoods';

// Combined suggestion list: Bezirks first (broader scope is usually more
// useful as an initial filter), then Ortsteils. Names that appear in
// both lists (e.g. "Mitte", "Pankow", "Spandau", "Neukölln",
// "Lichtenberg", "Reinickendorf") are deduplicated — when the user picks
// one of these, eventMatchesLocationFilter treats it as a Bezirk
// (broader semantics — matches every event in the borough).
const ALL_LOCATION_OPTIONS = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of BERLIN_BOROUGHS) {
    if (!seen.has(b.toLowerCase())) {
      seen.add(b.toLowerCase());
      out.push(b);
    }
  }
  for (const n of BERLIN_NEIGHBORHOODS) {
    if (!seen.has(n.toLowerCase())) {
      seen.add(n.toLowerCase());
      out.push(n);
    }
  }
  return out;
})();

interface NeighborhoodFilterProps {
  /** Currently selected neighbourhood, or `null` for no filter. */
  value: string | null;
  onChange: (next: string | null) => void;
}

/**
 * Type-to-search filter for Berlin neighbourhoods. Renders as a small chip
 * once a neighbourhood is selected, or a text input with suggestions
 * underneath while the user is typing.
 *
 * Suggestions list is hardcoded from `BERLIN_NEIGHBORHOODS` for v1 —
 * later we'd swap to Google Places Autocomplete, but for the demo a
 * curated list is faster and avoids the API quota cost.
 */
export function NeighborhoodFilter({ value, onChange }: NeighborhoodFilterProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return ALL_LOCATION_OPTIONS.slice(0, 8);
    return ALL_LOCATION_OPTIONS.filter((n) => n.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);

  // Selected → chip-only view
  if (value) {
    return (
      <View style={styles.chipRow}>
        <View style={styles.selectedChip}>
          <Ionicons name="location" size={14} color={colors.white} />
          <Text style={styles.selectedChipText}>{value}</Text>
          <TouchableOpacity
            onPress={() => {
              onChange(null);
              setQuery('');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Empty → input + suggestion strip
  const showSuggestions = focused || query.length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <Ionicons name="location-outline" size={16} color={colors.text.tertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay so a tap on a suggestion can land before we hide
            setTimeout(() => setFocused(false), 150);
          }}
          placeholder="Filter by neighbourhood…"
          placeholderTextColor={colors.text.placeholder}
          style={styles.input}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestionsRow}
          keyboardShouldPersistTaps="handled"
        >
          {suggestions.map((n) => (
            <TouchableOpacity
              key={n}
              style={styles.suggestion}
              onPress={() => {
                onChange(n);
                setQuery('');
                setFocused(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionText}>{n}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const CHOCOLATE = '#2B2A27';

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.base,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: colors.text.primary,
    paddingVertical: 0,
  },

  suggestionsRow: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  suggestion: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },

  chipRow: {
    paddingHorizontal: spacing.base,
    flexDirection: 'row',
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: CHOCOLATE,
  },
  selectedChipText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
});
