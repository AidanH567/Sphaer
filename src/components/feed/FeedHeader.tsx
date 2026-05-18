import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '@/constants/theme';
import { SphaerIcon } from '@/components/SphaerLogo';
import { ViewToggle } from './ViewToggle';

type FeedView = 'list' | 'map' | 'mural';

interface FeedHeaderProps {
  activeView: FeedView;
  onViewChange: (view: FeedView) => void;
  onSearchPress: () => void;
}

export function FeedHeader({ activeView, onViewChange, onSearchPress }: FeedHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topRow}>
        <SphaerIcon size={28} />
        <ViewToggle activeView={activeView} onViewChange={onViewChange} />
        <TouchableOpacity onPress={onSearchPress} style={styles.iconButton}>
          <Ionicons name="search-outline" size={22} color={colors.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: { padding: spacing.xs },
});
