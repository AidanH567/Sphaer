import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileForm, type ProfileFormValues } from '@/components/profile/ProfileForm';
import { colors, typography, spacing } from '@/constants/theme';
import { useAuthContext } from '@/context/AuthContext';
import { updateProfile } from '@/services/profile.service';

/**
 * First-run profile setup. Renders the shared <ProfileForm /> in onboarding
 * mode (no experiences / gallery — those come later via Edit Profile).
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { user, profile, setProfile } = useAuthContext();

  if (!user) {
    // AuthContext is still loading or there's no session — bounce.
    return null;
  }

  // Seed the form from whatever the profile trigger / previous edits left us.
  const initialValues: ProfileFormValues = {
    display_name: profile?.display_name ?? '',
    bio: profile?.bio ?? '',
    about: profile?.about ?? '',
    location: profile?.location ?? 'Berlin',
    neighborhood: profile?.neighborhood ?? '',
    website: profile?.website ?? '',
    disciplines: profile?.disciplines ?? [],
    avatar_url: profile?.avatar_url ?? null,
    experiences: profile?.experiences ?? [],
  };

  async function handleSubmit(values: ProfileFormValues) {
    if (!user) return;
    try {
      const updated = await updateProfile(user.id, {
        display_name: values.display_name,
        bio: values.bio || null,
        about: values.about || null,
        location: values.location || null,
        neighborhood: values.neighborhood || null,
        website: values.website || null,
        disciplines: values.disciplines,
        avatar_url: values.avatar_url,
      });
      setProfile(updated);
      // Hand off to the location-onboarding flow; it'll send the user to
      // the feed once they share location (or skip).
      router.replace('/location' as never);
    } catch (e: unknown) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.title}>Set up your profile</Text>
          <Text style={styles.subtitle}>Tell the community a bit about yourself.</Text>
        </View>

        <ProfileForm
          mode="onboarding"
          userId={user.id}
          initialValues={initialValues}
          onSubmit={handleSubmit}
          submitLabel="Let's go"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scroll: {
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
    gap: spacing.xl,
  },
  hero: { gap: spacing.xs },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
});
