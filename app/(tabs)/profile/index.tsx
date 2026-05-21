import React from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ProfileView } from '@/components/profile/ProfileView';
import { getMockProfileById, CURRENT_USER_PROFILE_ID } from '@/data/mockProfiles';
import { signOut } from '@/services/auth.service';
import { colors, spacing } from '@/constants/theme';

// NOTE: shows mock profile data (src/data/mockProfiles.ts). To use the real
// signed-in user, swap getMockProfileById() for useProfile(user.id) once
// Supabase auth + the profiles table are wired up.

export default function ProfileScreen() {
  const profile = getMockProfileById(CURRENT_USER_PROFILE_ID);

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={handleSignOut} style={styles.navButton}>
          <Ionicons name="log-out-outline" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <ProfileView profile={profile} isOwnProfile />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  navButton: { padding: spacing.sm },
});
