import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tag } from '@/components/ui/Tag';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useAuthContext } from '@/context/AuthContext';
import {
  createCircle,
  updateCircle,
  uploadCircleImage,
  uploadCircleCover,
} from '@/services/circles.service';
import { EVENT_CATEGORIES } from '@/constants/categories';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function CreateCircleScreen() {
  const router = useRouter();
  const { user } = useAuthContext();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

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

  async function pickCover() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add a cover image.');
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

  async function handleCreate() {
    if (!user) return;
    if (!name.trim()) {
      setNameError('Please add a name for your circle.');
      return;
    }
    setNameError(undefined);

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

      // Cover uploads AFTER the insert and lands via updateCircle — keeps
      // the insert payload simple and mirrors how the detail page edits
      // covers later. The circle row already exists at this point, so a
      // cover failure must NOT strand the user on the form: tell them and
      // take them to their new circle, where the Edit screen can retry.
      if (coverUri) {
        try {
          const coverUrl = await uploadCircleCover(user.id, circleId, coverUri);
          await updateCircle(circleId, { cover_url: coverUrl });
        } catch (coverError: unknown) {
          console.error('[CreateCircle] cover upload failed:', coverError);
          Alert.alert(
            'Circle created — cover upload failed',
            'Your circle is live without its cover image. You can add it again from the circle’s Edit screen.'
          );
          router.replace(`/circles/${circleId}`);
          return;
        }
      }

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
      {/* Sticky nav — mirrors Create Activity (Figma Tabbar 6277:10003):
          ✕ close left, SF Bold 18 ink title centered, white bar with a soft
          drop shadow instead of a border. */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={24} color={colors.neutral.ink} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Create Circle</Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Topics — choice chips, same source as before (event categories) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Choose topics?</Text>
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
        </View>

        {/* Name */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Name</Text>
          <Input
            placeholder=""
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (nameError) setNameError(undefined);
            }}
            error={nameError}
            accessibilityLabel="Name"
          />
        </View>

        {/* Describe */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Describe</Text>
          <TextInput
            style={styles.textarea}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            placeholder=""
            placeholderTextColor={colors.text.placeholder}
            accessibilityLabel="Describe"
          />
        </View>

        {/* Avatar — dashed 60px square picker; circular preview once chosen */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Avatar</Text>
          <TouchableOpacity
            style={styles.pickerTouchable}
            onPress={pickAvatar}
            accessibilityRole="button"
            accessibilityLabel={avatarUri ? 'Change avatar' : 'Add avatar'}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
            ) : (
              <View style={styles.pickerSquare}>
                <Ionicons name="add" size={24} color="#9FA7B3" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Cover image — same dashed square; wide 16:9 preview once chosen */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Cover image</Text>
          <TouchableOpacity
            style={coverUri ? null : styles.pickerTouchable}
            onPress={pickCover}
            accessibilityRole="button"
            accessibilityLabel={coverUri ? 'Change cover image' : 'Add cover image'}
          >
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={styles.coverPreview} contentFit="cover" />
            ) : (
              <View style={styles.pickerSquare}>
                <Ionicons name="add" size={24} color="#9FA7B3" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Button label="Create Circle" onPress={handleCreate} isLoading={isLoading} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  // Figma 6277:10003 nav language: no border, shadow {0,2}/0.08/6.
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    zIndex: 1,
  },
  // Figma Tabbar 6277:10003: SF Bold 18 ink.
  navTitle: {
    fontSize: 18,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.ink,
  },
  // Balances the 24px close icon so the title stays optically centered.
  navSpacer: { width: 24 },
  scroll: { padding: spacing.base, gap: spacing.xl, paddingBottom: spacing['4xl'] },
  // Label→field gap (Figma spec: 6–8).
  section: { gap: spacing.sm },
  // Figma form labels: SF Semibold 17 chocolate (Primary/Category Header).
  sectionLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.chocolate,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  // Keeps the tap target bounded to the 60px square (not the full row).
  pickerTouchable: { alignSelf: 'flex-start' },
  // Figma 6277:10054 picker language: 60px dashed square, 2px #9FA7B3, r9.
  pickerSquare: {
    width: 60,
    height: 60,
    borderWidth: 2,
    borderColor: '#9FA7B3',
    borderStyle: 'dashed',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPreview: { width: 60, height: 60, borderRadius: radius.full },
  coverPreview: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.sm },
});

export const ErrorBoundary = makeRouteErrorBoundary('create-circle');
