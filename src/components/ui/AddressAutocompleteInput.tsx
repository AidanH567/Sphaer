import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { searchPlaces, getPlaceDetails, type PlaceSuggestion } from '@/lib/places';

export interface SelectedAddress {
  /** Google's formatted_address, e.g. "Okerstraße 14, 12049 Berlin" */
  formatted_address: string;
  /** Venue name when Google returns one (e.g. "Berghain"), else null */
  name: string | null;
  lat: number;
  lng: number;
  /** Canonicalised Berlin Ortsteil from our 26-name list, or null */
  neighbourhood: string | null;
  /** Berlin Bezirk (borough) — broader than neighbourhood. Filled even
   *  when neighbourhood is null. */
  borough: string | null;
  /** Stable Google place id, useful for de-dup */
  place_id: string;
}

interface AddressAutocompleteInputProps {
  /** The string currently shown in the input field. */
  value: string;
  /** Fires on every keystroke. Parent owns the raw text so it can be
   *  saved as `address` even if the user never selects a suggestion. */
  onChangeText: (text: string) => void;
  /** Fires only when the user picks one of the suggestions — with the
   *  full structured place data. Parent saves lat/lng/neighbourhood here. */
  onSelect: (address: SelectedAddress) => void;
  /** Cleared selection callback — fires when the user re-edits after
   *  having selected. Parent should clear lat/lng/neighbourhood. */
  onClearSelection?: () => void;
  label?: string;
  placeholder?: string;
  /** Helper text shown below the input when no suggestion is selected. */
  helper?: string;
}

/**
 * Address typeahead backed by Google Places Autocomplete + Place Details.
 * Replaces the plain text address input on Create Activity so the user
 * picks a real, geocoded place — saving lat/lng/neighbourhood without
 * a separate geocoding round trip after submit.
 *
 * Reusable: any screen that wants a structured address picker
 * (future profile location, circle base, etc.) can drop this in.
 */
export function AddressAutocompleteInput({
  value,
  onChangeText,
  onSelect,
  onClearSelection,
  label = 'Address',
  placeholder = 'Search for a Berlin address…',
  helper,
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selectedConfirmed, setSelectedConfirmed] = useState(false);
  // We track the latest fetch so an in-flight stale response can't
  // overwrite suggestions for a newer query.
  const fetchSeq = useRef(0);

  // Debounce keystrokes — 280ms is the standard Google autocomplete cadence.
  useEffect(() => {
    if (selectedConfirmed) return; // suggestions hidden while a selection is locked
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const mySeq = ++fetchSeq.current;
    setLoading(true);
    const timer = setTimeout(() => {
      searchPlaces(q)
        .then((results) => {
          if (mySeq !== fetchSeq.current) return; // stale
          setSuggestions(results);
        })
        .finally(() => {
          if (mySeq === fetchSeq.current) setLoading(false);
        });
    }, 280);
    return () => clearTimeout(timer);
  }, [value, selectedConfirmed]);

  async function handlePickSuggestion(s: PlaceSuggestion) {
    setLoading(true);
    try {
      const details = await getPlaceDetails(s.place_id);
      if (!details) {
        setLoading(false);
        return;
      }
      const formatted = details.formatted_address || s.main_text;
      onChangeText(formatted);
      onSelect({
        formatted_address: formatted,
        name: details.name,
        lat: details.lat,
        lng: details.lng,
        neighbourhood: details.neighbourhood,
        borough: details.borough,
        place_id: details.place_id,
      });
      setSelectedConfirmed(true);
      setSuggestions([]);
      setFocused(false);
    } finally {
      setLoading(false);
    }
  }

  function handleTextChange(next: string) {
    onChangeText(next);
    if (selectedConfirmed) {
      // User is editing after a confirmed selection — clear the locked state
      setSelectedConfirmed(false);
      onClearSelection?.();
    }
  }

  const showSuggestions = focused && !selectedConfirmed && suggestions.length > 0;
  const showHelper = helper && !showSuggestions;

  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
        <Ionicons
          name={selectedConfirmed ? 'checkmark-circle' : 'location-outline'}
          size={18}
          color={selectedConfirmed ? '#1DA851' : colors.text.tertiary}
        />
        <TextInput
          value={value}
          onChangeText={handleTextChange}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Slight delay so a tap on a suggestion lands first
            setTimeout(() => setFocused(false), 180);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.text.placeholder}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading && <ActivityIndicator size="small" color={colors.text.tertiary} />}
        {!loading && value.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              onChangeText('');
              if (selectedConfirmed) {
                setSelectedConfirmed(false);
                onClearSelection?.();
              }
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>

      {showSuggestions && (
        <View style={styles.suggestionsBox}>
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s.place_id}
              style={styles.suggestion}
              onPress={() => handlePickSuggestion(s)}
              activeOpacity={0.7}
            >
              <Ionicons name="location" size={16} color={colors.text.secondary} />
              <View style={styles.suggestionText}>
                <Text style={styles.suggestionMain} numberOfLines={1}>
                  {s.main_text}
                </Text>
                {!!s.secondary_text && (
                  <Text style={styles.suggestionSecondary} numberOfLines={1}>
                    {s.secondary_text}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showHelper && <Text style={styles.helper}>{helper}</Text>}
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
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  inputRowFocused: { borderColor: colors.black },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily.ui,
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
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestionText: { flex: 1, gap: 1 },
  suggestionMain: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  suggestionSecondary: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 12,
    color: colors.text.tertiary,
  },

  helper: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 12,
    color: colors.text.tertiary,
  },
});
