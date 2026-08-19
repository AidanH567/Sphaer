import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Tag } from '@/components/ui/Tag';
import { spacing } from '@/constants/theme';
import { DEFAULT_FILTER_CATEGORIES, EVENT_CATEGORIES } from '@/constants/categories';

interface FilterBarProps {
  selectedCategories?: string[];
  onToggleCategory: (category: string) => void;
}

const MORE_LABEL = 'More categories';
const FEWER_LABEL = 'Fewer categories';

/**
 * The category chip row — feed, map, mural and circles all render this one.
 *
 * The vocabulary grew from 14 to 36 (Lara's sheet, 2026-08-18), which is more
 * than a horizontal row can carry, so it shows `DEFAULT_FILTER_CATEGORIES` and
 * keeps the rest one press away behind a trailing "More categories" chip. That
 * chip is a `Tag` like every other pill in the row — the row is not restyled,
 * it just gets one more item.
 *
 * The one non-obvious rule is `extras`: a category can be *selected* while
 * living in the hidden tail, because filter state outlives this component
 * (`feedFilters` is held by the screen and survives navigating to an event and
 * back). Rendering only the default set would leave a filter switched on with
 * no chip to switch it off — the feed would look empty for no visible reason.
 * So the collapsed row is "the default set, plus anything currently on",
 * which also means a legacy category still stored on an old event stays
 * clearable if it ever reaches filter state.
 */
export function FilterBar({ selectedCategories = [], onToggleCategory }: FilterBarProps) {
  const [expanded, setExpanded] = React.useState(false);

  const visible = React.useMemo<readonly string[]>(() => {
    if (expanded) return EVENT_CATEGORIES;
    const extras: string[] = [];
    for (const cat of selectedCategories) {
      if (!DEFAULT_FILTER_CATEGORIES.includes(cat) && !extras.includes(cat)) {
        extras.push(cat);
      }
    }
    return extras.length ? [...DEFAULT_FILTER_CATEGORIES, ...extras] : DEFAULT_FILTER_CATEGORIES;
  }, [expanded, selectedCategories]);

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {visible.map((cat) => (
          <Tag
            key={cat}
            label={cat}
            selected={selectedCategories.includes(cat)}
            onPress={() => onToggleCategory(cat)}
            style={styles.tag}
          />
        ))}
        <Tag
          key="__more__"
          label={expanded ? FEWER_LABEL : MORE_LABEL}
          onPress={() => setExpanded((v) => !v)}
          style={styles.tag}
        />
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
