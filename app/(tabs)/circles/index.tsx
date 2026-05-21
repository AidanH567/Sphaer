import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CircleCard } from '@/components/circles/CircleCard';
import { CircleJoinSheet } from '@/components/circles/CircleJoinSheet';
import { colors, typography, spacing, radius } from '@/constants/theme';
import {
  MOCK_CIRCLE_CATEGORIES,
  getMockCirclesByIds,
  type MockCircle,
} from '@/data/mockCircles';

// NOTE: this page renders mock data from src/data/mockCircles.ts. To go live,
// replace MOCK_CIRCLE_CATEGORIES / getMockCirclesByIds with Supabase queries
// (circles.service.ts) — CircleCard only needs the MockCircle display fields.

export default function CirclesScreen() {
  // The tapped circle drives the join sheet; null keeps it closed.
  const [selectedCircle, setSelectedCircle] = useState<MockCircle | null>(null);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.text.tertiary} />
          <Text style={styles.searchPlaceholder}>Berlin what's on Today?!</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {MOCK_CIRCLE_CATEGORIES.map((category) => {
          const circles = getMockCirclesByIds(category.circleIds);
          return (
            <View key={category.id} style={styles.section}>
              {/* Category header */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>{category.title}</Text>
                  <Text style={styles.sectionSubtitle}>{category.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.text.secondary} />
              </View>

              {/* Horizontally swipeable circle row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}
              >
                {circles.map((circle) => (
                  <CircleCard
                    key={circle.id}
                    circle={circle}
                    onPress={() => setSelectedCircle(circle)}
                  />
                ))}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      {/* Join popup — opens on card tap, routes to detail on Join Circle */}
      <CircleJoinSheet
        circle={selectedCircle}
        onClose={() => setSelectedCircle(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  searchRow: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  searchPlaceholder: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 17,
    color: colors.text.primary,
  },

  scroll: {
    paddingBottom: 110,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md,
  },
  sectionHeaderText: { flex: 1 },
  sectionTitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 20,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  sectionSubtitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  row: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm, // Figma: 8px between cards
    paddingVertical: spacing.sm, // room for the card shadow
  },
});
