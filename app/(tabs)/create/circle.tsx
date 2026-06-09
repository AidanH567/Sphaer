import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tag } from '@/components/ui/Tag';
import { colors, typography, spacing } from '@/constants/theme';
import { useAuthContext } from '@/context/AuthContext';
import { createCircle, updateCircle, uploadCircleImage } from '@/services/circles.service';
import { EVENT_CATEGORIES } from '@/constants/categories';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function CreateCircleScreen() {
  const router = useRouter();
  const { user } = useAuthContext();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add a circle photo.');
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

  async function handleCreate() {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Please add a name for your circle.');
      return;
    }

    setIsLoading(true);
    try {
      const circleId = crypto.randomUUID();

      // Upload avatar BEFORE the circle insert so we have a URL to store.
      // We can't reuse the upload-then-update pattern cleanly because the
      // storage path needs the user id (RLS), not the circle id alone.
      let avatarUrl: string | null = null;
      if (avatarUri) {
        avatarUrl = await uploadCircleImage(user.id, circleId, avatarUri, 'avatar');
      }

      // Create the circle row. Trigger `on_circle_created` will add the
      // creator to circle_members with role='admin' atomically.
      await createCircle({
        id: circleId,
        creator_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        tags,
        is_public: true,
        avatar_url: avatarUrl,
        cover_url: null,
      });

      // Trigger has already added the creator as admin. Navigate straight
      // to the circles page — useFocusEffect there will refetch and the
      // new circle appears in the appropriate tag group.
      router.replace('/(tabs)/circles');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create circle.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Create a Circle</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar picker */}
        <TouchableOpacity style={styles.avatarPicker} onPress={pickAvatar}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="image-outline" size={28} color={colors.text.tertiary} />
              <Text style={styles.avatarHint}>Add photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.form}>
          <Input
            label="Circle name"
            placeholder=""
            value={name}
            onChangeText={setName}
          />
          <Input
            label="Description"
            placeholder=""
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <Text style={styles.sectionLabel}>Tags</Text>
        <View style={styles.tags}>
          {EVENT_CATEGORIES.map((cat) => (
            <Tag
              key={cat}
              label={cat}
              selected={tags.includes(cat)}
              onPress={() => toggleTag(cat)}
            />
          ))}
        </View>

        <Button
          label="Create circle"
          onPress={handleCreate}
          isLoading={isLoading}
          style={styles.cta}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  scroll: {
    padding: spacing.base,
    gap: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  avatarPicker: {
    alignSelf: 'center',
  },
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
  avatarHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  form: { gap: spacing.base },
  sectionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: -spacing.sm,
  },
  cta: {},
});

export const ErrorBoundary = makeRouteErrorBoundary('create-circle');
