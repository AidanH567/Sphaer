import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ProfileView } from '@/components/profile/ProfileView';
import { getMockProfileById } from '@/data/mockProfiles';
import { colors, spacing } from '@/constants/theme';

// NOTE: shows mock profile data (src/data/mockProfiles.ts). getMockProfileById
// falls back to the demo profile for unknown ids, so any creator / host tap
// resolves without a routing error. Swap for useProfile(id) once Supabase
// profiles are wired up.

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = getMockProfileById(id);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ProfileView profile={profile} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  navBar: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  navButton: { padding: spacing.sm },
});
