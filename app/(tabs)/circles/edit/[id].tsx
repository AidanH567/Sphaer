import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tag } from '@/components/ui/Tag';
import { ErrorState } from '@/components/ui/ErrorState';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useAuthContext } from '@/context/AuthContext';
import { useCircle } from '@/hooks/useCircles';
import {
  updateCircle,
  uploadCircleImage,
  uploadCircleCover,
} from '@/services/circles.service';
import { EVENT_CATEGORIES } from '@/constants/categories';
import type { CircleUpdate } from '@/types/circle.types';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

/**
 * Creator-only edit screen for a circle — mirrors app/event/edit/[id].tsx.
 * Prefills from the fetched circle, uploads avatar/cover only when the user
 * picked a replacement, saves via updateCircle, then pops back to the detail
 * page (which refetches on focus).
 */
export default function EditCircleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthContext();
  const { circle, isLoading, error, refetch } = useCircle(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  // Display URIs — seeded with the stored https URLs, replaced by local
  // file:// URIs when the user picks a new image. Upload only on change.
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  // Form state is seeded from the fetched circle exactly once, so user edits
  // are never clobbered by a background refetch (same pattern as event edit).
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!circle || hydrated) return;
    setName(circle.name);
    setDescription(circle.description ?? '');
    setTags(circle.tags ?? []);
    setAvatarUri(circle.avatar_url);
    setCoverUri(circle.cover_url);
    setHydrated(true);
  }, [circle, hydrated]);

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to change the circle photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  async function pickCover() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to change the cover image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.9,
    });
    if (!result.canceled) {
      setCoverUri(result.assets[0].uri);
    }
  }

  async function handleSave() {
    if (!circle || !user) return;
    if (!name.trim()) {
      setNameError('Please add a name for your circle.');
      return;
    }
    setNameError(undefined);

    setIsSaving(true);
    try {
      const updates: CircleUpdate = {
        name: name.trim(),
        description: description.trim() || null,
        tags,
      };

      // Upload only freshly-picked images (URI differs from the stored URL).
      // Storage paths are deterministic per circle, so re-uploads overwrite
      // in place (upsert: true in the service).
      if (avatarUri && avatarUri !== circle.avatar_url) {
        updates.avatar_url = await uploadCircleImage(user.id, circle.id, avatarUri, 'avatar');
      }
      if (coverUri && coverUri !== circle.cover_url) {
        updates.cover_url = await uploadCircleCover(user.id, circle.id, coverUri);
      }

      await updateCircle(circle.id, updates);
      router.back();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  }

  const navBar = (
    <View style={styles.navBar}>
      <TouchableOpacity
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.navTitle}>Edit Circle</Text>
      <View style={styles.navSpacer} />
    </View>
  );

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {navBar}
        <ErrorState
          icon="cloud-offline-outline"
          title="Couldn't load this circle"
          body={error}
          onRetry={refetch}
          onBack={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (isLoading || (circle && !hydrated)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {navBar}
        <View style={styles.center}>
          <ActivityIndicator color={colors.neutral.chocolate} />
        </View>
      </SafeAreaView>
    );
  }

  if (!circle) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {navBar}
        <ErrorState
          icon="people-outline"
          title="Circle not found"
          body="This circle may have been removed."
          onBack={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  // Creator-only guard. RLS would reject the update anyway — this just
  // surfaces a friendly state instead of a failing save.
  if (user?.id !== circle.creator_id) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {navBar}
        <ErrorState
          icon="lock-closed-outline"
          title="Not your circle"
          body="You can only edit circles you created."
          onBack={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {navBar}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar picker — same affordance as the create screen */}
        <TouchableOpacity
          style={styles.avatarPicker}
          onPress={pickAvatar}
          accessibilityRole="button"
          accessibilityLabel={avatarUri ? 'Change circle photo' : 'Add circle photo'}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="image-outline" size={28} color={colors.text.tertiary} />
              <Text style={styles.pickerHint}>Add photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Cover image picker */}
        <TouchableOpacity
          onPress={pickCover}
          accessibilityRole="button"
          accessibilityLabel={coverUri ? 'Change cover image' : 'Add cover image'}
        >
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.coverImage} contentFit="cover" />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="image-outline" size={28} color={colors.text.tertiary} />
              <Text style={styles.pickerHint}>Add cover</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.form}>
          <Input
            label="Circle name"
            placeholder=""
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (nameError) setNameError(undefined);
            }}
            error={nameError}
          />
          <View>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={styles.textarea}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              placeholder=""
              placeholderTextColor={colors.text.placeholder}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Tags</Text>
        <View style={styles.tags}>
          {EVENT_CATEGORIES.map((cat) => (
            <Tag
              key={cat}
              label={cat}
              variant="choice"
              selected={tags.includes(cat)}
              onPress={() => toggleTag(cat)}
            />
          ))}
        </View>

        <Button label="Save changes" onPress={handleSave} isLoading={isSaving} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // Matches event edit (Figma Tabbar 6277:10003): SF Bold 18 ink.
  navTitle: {
    fontSize: 18,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.ink,
  },
  // Balances the 24px back chevron so the title stays centred.
  navSpacer: { width: 24 },
  scroll: { padding: spacing.base, gap: spacing.xl, paddingBottom: spacing['4xl'] },

  avatarPicker: { alignSelf: 'center' },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pickerHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  coverImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
  },
  coverPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  form: { gap: spacing.base },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  textarea: {
    borderWidth: 1,
    borderColor: colors.neutral.hiddenLines,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 144,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.chocolate,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: -spacing.sm },
});

export const ErrorBoundary = makeRouteErrorBoundary('circle-edit');
