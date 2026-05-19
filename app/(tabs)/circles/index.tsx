import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCircles } from '@/hooks/useCircles';
import { CircleCard } from '@/components/circles/CircleCard';
import { colors, typography, spacing } from '@/constants/theme';

export default function CirclesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { circles, isLoading } = useCircles(search || undefined);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Circles</Text>
        <TouchableOpacity onPress={() => router.push('/create')}>
          <Ionicons name="add-circle-outline" size={26} color={colors.black} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.text.tertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search circles…"
          placeholderTextColor={colors.text.placeholder}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.black} />
        </View>
      ) : circles.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No circles found</Text>
        </View>
      ) : (
        <FlatList
          data={circles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CircleCard circle={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.base,
    paddingHorizontal: spacing.md,
    height: 44,
    backgroundColor: colors.surface,
    borderRadius: 22,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: typography.fontSize.base, color: colors.text.tertiary },
});
