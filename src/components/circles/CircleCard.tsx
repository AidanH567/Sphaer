import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '@/components/ui/Avatar';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { formatMemberCount } from '@/utils/format';
import type { CircleWithCounts } from '@/types/circle.types';

interface CircleCardProps {
  circle: CircleWithCounts;
}

export function CircleCard({ circle }: CircleCardProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/circles/${circle.id}`)}
      activeOpacity={0.9}
    >
      <Avatar uri={circle.avatar_url} name={circle.name} size={52} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{circle.name}</Text>
        <Text style={styles.meta}>
          {formatMemberCount(circle.members_count)} · {circle.activities_count} Activities
        </Text>
        {circle.description && (
          <Text style={styles.description} numberOfLines={2}>
            {circle.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.base,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  info: { flex: 1, gap: 2 },
  name: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  meta: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  description: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
    lineHeight: 18,
  },
});
