/**
 * "New message" — pick a person, open the thread.
 *
 * ── Why this is its own sheet ────────────────────────────────────────────────
 * The `+` in the inbox header was `console.log('[Messages] new conversation')`
 * (report ce750054: "these buttons do nothing on the messaging page", with the
 * reporter's expectation spelled out — "the ability to search and send user
 * messages"). The obvious reuse was `EntityListSheet type='user'`, and it does
 * not fit: it filters a FIXED array client-side and every user row navigates
 * to `/user/<id>`. This needs the opposite of both — a server-side search over
 * all profiles, and a destination of the DM thread. Bending the shared sheet
 * into doing both would have meant three new optional props on a component
 * five other screens depend on.
 *
 * ── Search is server-side, and deliberately so ───────────────────────────────
 * The alternative was to list people you already follow and filter locally. On
 * an app with 42 profiles and sparse follow edges that is an empty sheet for
 * most people, which is the dead-button bug again wearing a different hat.
 * `searchProfiles` already exists, already sanitises PostgREST filter syntax,
 * and is already used by the feed's artist search.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { useDebounce } from '@/hooks/useDebounce';
import { searchProfiles } from '@/services/profile.service';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { Profile } from '@/types/user.types';

/** Matches the feed's artist search, which reads well at a glance. */
const RESULT_LIMIT = 15;
const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Signed-in user — filtered out of results; messaging yourself is not a
   *  thing, and the thread route would be nonsense. */
  currentUserId?: string | null;
  /** Blocked profiles, hidden from results the same way the feed hides them
   *  from artist search (App Store 1.2). */
  blockedIds?: Set<string>;
}

export function NewConversationSheet({
  visible,
  onClose,
  currentUserId,
  blockedIds,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);

  // Monotonic request id — same guard the feed's artist search uses. A slow
  // response for "an" must never overwrite the results for "anna".
  const reqId = useRef(0);

  // Fresh sheet every time it opens: a stale query and its results sitting
  // there on reopen looks like the search ran itself.
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setResults([]);
    setError(null);
    setIsSearching(false);
  }, [visible]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    const id = ++reqId.current;
    setIsSearching(true);
    setError(null);

    searchProfiles(q, RESULT_LIMIT)
      .then((profiles) => {
        if (reqId.current !== id) return;
        setResults(
          profiles.filter(
            (p) => p.id !== currentUserId && !(blockedIds?.has(p.id) ?? false)
          )
        );
        setIsSearching(false);
      })
      .catch((err) => {
        if (reqId.current !== id) return;
        console.warn('[Messages] people search failed:', err);
        setResults([]);
        setError("Couldn't search people. Check your connection and try again.");
        setIsSearching(false);
      });

    return () => {
      // Invalidate in-flight work when the query moves on or the sheet closes.
      reqId.current += 1;
    };
  }, [debouncedQuery, currentUserId, blockedIds]);

  const openThread = useCallback(
    (profile: Profile) => {
      onClose();
      // Let the modal finish dismissing before pushing — iOS drops a
      // navigation issued while a Modal is still animating out, the same
      // reason OverflowMenuSheet delays its actions.
      setTimeout(() => router.push(`/(tabs)/messages/${profile.id}`), 250);
    },
    [onClose, router]
  );

  const trimmed = query.trim();
  const showTooShort = trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>New message</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={22} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={colors.text.secondary} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search people…"
            placeholderTextColor={colors.text.secondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search people"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <Text style={styles.hint}>{error}</Text>
          ) : trimmed.length === 0 ? (
            <Text style={styles.hint}>
              Search for someone by name or username to start a conversation.
            </Text>
          ) : showTooShort ? (
            <Text style={styles.hint}>Keep typing…</Text>
          ) : isSearching ? (
            <View style={styles.spinner}>
              <ActivityIndicator color={colors.text.primary} />
            </View>
          ) : results.length === 0 ? (
            <Text style={styles.hint}>No people match “{trimmed}”.</Text>
          ) : (
            results.map((profile) => {
              const name = profile.display_name || profile.username || 'Someone';
              return (
                <TouchableOpacity
                  key={profile.id}
                  style={styles.row}
                  onPress={() => openThread(profile)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${name}`}
                >
                  <Avatar uri={profile.avatar_url} name={name} size={40} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {name}
                    </Text>
                    {profile.username ? (
                      <Text style={styles.rowHandle} numberOfLines={1}>
                        @{profile.username}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.text.secondary}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.tag.border,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: 'rgba(10,10,10,0.04)',
  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    // Kills the default focus ring react-native-web paints on the input.
    outlineStyle: 'none',
  } as object,
  list: {
    marginTop: spacing.md,
  },
  hint: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
  spinner: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  rowHandle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
});
