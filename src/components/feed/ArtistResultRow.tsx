import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '@/components/ui/Avatar';
import { colors, typography, spacing } from '@/constants/theme';
import type { Profile } from '@/types/user.types';

interface ArtistResultRowProps {
  profile: Profile;
}

/**
 * One artist match in the feed's search-results "Artists" section: avatar,
 * display name, and the profile's disciplines joined with middots. Tapping
 * the row opens the artist's profile page.
 *
 * The row is surface-transparent on purpose — the feed wraps the matches in
 * a single white rounded card (grouped-list look), so the container owns the
 * background, radius, and shadow.
 *
 * Memoised: rendered inside the feed FlatList's header, which re-renders on
 * every filter / save toggle / focus refresh of the parent screen.
 */
function ArtistResultRowImpl({ profile }: ArtistResultRowProps) {
  const router = useRouter();

  const name = profile.display_name || profile.username || 'Artist';
  const disciplines = (profile.disciplines ?? []).join(' · ');

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/user/${profile.id}`)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}'s profile`}
    >
      <Avatar uri={profile.avatar_url} name={name} size={36} />
      <View style={styles.textCol}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {disciplines.length > 0 && (
          <Text style={styles.disciplines} numberOfLines={1}>
            {disciplines}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export const ArtistResultRow = React.memo(ArtistResultRowImpl);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // 52px ≥ the 44px minimum touch target; keeps the section compact.
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textCol: { flex: 1 },
  name: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.chocolate,
  },
  disciplines: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.neutral.neutral600,
    marginTop: 2,
  },
});
