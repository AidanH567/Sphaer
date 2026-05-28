import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ProfileForm, type ProfileFormValues } from '@/components/profile/ProfileForm';
import { useAuthContext } from '@/context/AuthContext';
import { updateProfile, getProfileImages } from '@/services/profile.service';
import type { ProfileImage } from '@/types/user.types';
import { colors, typography, spacing } from '@/constants/theme';

const INK = '#1B1B18';

/**
 * Full-screen Edit Profile route. Outside the tabs group so the bottom nav
 * hides while editing. Routes back to /(tabs)/profile on save or cancel.
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const { user, profile, setProfile } = useAuthContext();

  const [gallery, setGallery] = useState<ProfileImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getProfileImages(user.id)
      .then(setGallery)
      .catch(() => setGallery([]))
      .finally(() => setGalleryLoading(false));
  }, [user]);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>You need to be signed in to edit your profile.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initialValues: ProfileFormValues = {
    display_name: profile?.display_name ?? '',
    bio: profile?.bio ?? '',
    about: profile?.about ?? '',
    location: profile?.location ?? '',
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
        experiences: values.experiences,
      });
      setProfile(updated);
      router.back();
    } catch (e: unknown) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header — Cancel / title / spacer for symmetry */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.navButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={24} color={INK} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Edit Profile</Text>
        <View style={styles.navButton} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {galleryLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={INK} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ProfileForm
              mode="edit"
              userId={user.id}
              initialValues={initialValues}
              initialGallery={gallery}
              onSubmit={handleSubmit}
              submitLabel="Save"
            />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: typography.fontFamily.display,
    fontSize: 17,
    fontWeight: typography.fontWeight.semibold,
    color: INK,
  },
  keyboardView: { flex: 1 },
  scroll: {
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
