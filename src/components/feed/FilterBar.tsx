import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Tag } from '@/components/ui/Tag';
import { spacing } from '@/constants/theme';
import { EVENT_CATEGORIES } from '@/constants/categories';

interface FilterBarProps {
  selectedCategories: string[];
  onToggleCategory: (category: string) => void;
}

export function FilterBar({ selectedCategories, onToggleCategory }: FilterBarProps) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {EVENT_CATEGORIES.map((cat) => (
          <Tag
            key={cat}
            label={cat}
            selected={selectedCategories.includes(cat)}
            onPress={() => onToggleCategory(cat)}
            style={styles.tag}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tag: {},
});
