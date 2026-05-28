import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { EVENT_CATEGORIES } from '@/constants/categories';
import {
  uploadAvatar,
  uploadGalleryImages,
  removeProfileImage,
  getGalleryImageUrl,
} from '@/services/profile.service';
import type { ProfileExperienceEntry, ProfileImage } from '@/types/user.types';

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ProfileFormValues {
  display_name: string;
  bio: string;          // short tagline ("Filmmaker & Workshop Facilitator")
  about: string;        // long-form paragraph
  location: string;     // city
  neighborhood: string; // optional finer-grained
  website: string;
  disciplines: string[];
  avatar_url: string | null;
  experiences: ProfileExperienceEntry[];
}

export interface ProfileFormProps {
  /** 'onboarding' hides experiences + gallery to keep first-run light. */
  mode: 'onboarding' | 'edit';
  /** The authed user's ID — needed for storage paths. */
  userId: string;
  initialValues: ProfileFormValues;
  /** Existing gallery rows (edit mode only). Ignored in onboarding mode. */
  initialGallery?: ProfileImage[];
  /** Called with the form values when the user taps the primary CTA. */
  onSubmit: (values: ProfileFormValues) => Promise<void>;
  /** Label for the submit button. Defaults: "Let's go" / "Save". */
  submitLabel?: string;
}

const GALLERY_MAX = 20;
const GALLERY_BATCH_MAX = 10;

// ─── Component ───────────────────────────────────────────────────────────────

export function ProfileForm({
  mode,
  userId,
  initialValues,
  initialGallery = [],
  onSubmit,
  submitLabel,
}: ProfileFormProps) {
  // ── Form state ────────────────────────────────────────────────────────────
  const [values, setValues] = useState<ProfileFormValues>(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ display_name?: string }>({});

  // Gallery is "live" — adds/removes persist immediately, not on submit
  const [gallery, setGallery] = useState<ProfileImage[]>(initialGallery);
  const [pendingUploads, setPendingUploads] = useState<string[]>([]); // local URIs being uploaded

  // Avatar uploads immediately too — we keep the URI shown during upload
  const [avatarUploading, setAvatarUploading] = useState(false);

  const showRichSections = mode === 'edit';

  function update<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  // ── Avatar picker ─────────────────────────────────────────────────────────
  const pickAvatar = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set an avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const localUri = result.assets[0].uri;
    // Optimistic: show the local URI instantly
    update('avatar_url', localUri);
    setAvatarUploading(true);
    try {
      const publicUrl = await uploadAvatar(userId, localUri);
      update('avatar_url', publicUrl);
    } catch (e: unknown) {
      Alert.alert('Avatar upload failed', e instanceof Error ? e.message : 'Try again.');
      // Revert to whatever it was before
      update('avatar_url', initialValues.avatar_url);
    } finally {
      setAvatarUploading(false);
    }
  }, [userId, initialValues.avatar_url]);

  // ── Gallery picker (batch) ────────────────────────────────────────────────
  const pickGalleryImages = useCallback(async () => {
    if (gallery.length + pendingUploads.length >= GALLERY_MAX) {
      Alert.alert('Gallery full', `You can have up to ${GALLERY_MAX} images.`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add images.');
      return;
    }

    const remaining = GALLERY_MAX - gallery.length - pendingUploads.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: Math.min(GALLERY_BATCH_MAX, remaining),
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;

    const uris = result.assets.map((a) => a.uri);
    // Optimistic: show greyed-out tiles immediately
    setPendingUploads((prev) => [...prev, ...uris]);

    const startingSortOrder = gallery.length;
    try {
      const { images, errors } = await uploadGalleryImages(userId, uris, startingSortOrder);
      setGallery((prev) => [...prev, ...images]);
      if (errors.length > 0) {
        Alert.alert(
          'Some uploads failed',
          `${errors.length} image${errors.length === 1 ? '' : 's'} could not be uploaded.`
        );
      }
    } catch (e: unknown) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setPendingUploads((prev) => prev.filter((u) => !uris.includes(u)));
    }
  }, [gallery, pendingUploads, userId]);

  const removeGalleryImage = useCallback(async (image: ProfileImage) => {
    // Optimistic remove
    setGallery((prev) => prev.filter((g) => g.id !== image.id));
    try {
      await removeProfileImage(image);
    } catch (e: unknown) {
      // Roll back on error
      setGallery((prev) => [...prev, image].sort((a, b) => a.sort_order - b.sort_order));
      Alert.alert('Could not remove image', e instanceof Error ? e.message : 'Try again.');
    }
  }, []);

  // ── Disciplines ───────────────────────────────────────────────────────────
  function toggleDiscipline(disc: string) {
    update(
      'disciplines',
      values.disciplines.includes(disc)
        ? values.disciplines.filter((d) => d !== disc)
        : [...values.disciplines, disc]
    );
  }

  // ── Experiences ───────────────────────────────────────────────────────────
  function addExperience() {
    const newEntry: ProfileExperienceEntry = {
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: '',
      organisation: '',
      start_date: '',
      end_date: null, // null = Present
      description: '',
    };
    update('experiences', [newEntry, ...values.experiences]);
  }

  function updateExperience(id: string, patch: Partial<ProfileExperienceEntry>) {
    update(
      'experiences',
      values.experiences.map((e) => (e.id === id ? { ...e, ...patch } : e))
    );
  }

  function removeExperience(id: string) {
    update(
      'experiences',
      values.experiences.filter((e) => e.id !== id)
    );
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const next: typeof errors = {};
    const trimmedName = values.display_name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      next.display_name = 'Name must be 2–50 characters';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsSubmitting(true);
    try {
      // Filter empty experience entries before saving
      const cleanedExperiences = values.experiences.filter(
        (e) => e.title.trim() || e.organisation?.trim() || e.description?.trim()
      );
      await onSubmit({ ...values, display_name: trimmedName, experiences: cleanedExperiences });
    } catch (e: unknown) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const galleryTiles = useMemo(
    () =>
      gallery.map((img) => (
        <View key={img.id} style={styles.galleryTile}>
          <Image source={{ uri: getGalleryImageUrl(img.path) }} style={styles.galleryImg} />
          <TouchableOpacity
            style={styles.galleryRemove}
            onPress={() => removeGalleryImage(img)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="close" size={14} color={colors.white} />
          </TouchableOpacity>
        </View>
      )),
    [gallery, removeGalleryImage]
  );

  const pendingTiles = useMemo(
    () =>
      pendingUploads.map((uri) => (
        <View key={uri} style={styles.galleryTile}>
          <Image source={{ uri }} style={[styles.galleryImg, styles.galleryImgPending]} />
          <View style={styles.gallerySpinner}>
            <ActivityIndicator color={colors.white} />
          </View>
        </View>
      )),
    [pendingUploads]
  );

  const finalSubmitLabel = submitLabel ?? (mode === 'onboarding' ? "Let's go" : 'Save');

  return (
    <View style={styles.root}>
      {/* ── Avatar ─────────────────────────────────────── */}
      <TouchableOpacity style={styles.avatarPicker} onPress={pickAvatar} activeOpacity={0.85}>
        {values.avatar_url ? (
          <View>
            <Image source={{ uri: values.avatar_url }} style={styles.avatar} />
            {avatarUploading && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={colors.white} />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="camera-outline" size={28} color={colors.text.tertiary} />
            <Text style={styles.avatarHint}>Add photo</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Text fields ────────────────────────────────── */}
      <View style={styles.section}>
        <Input
          label="Display name"
          placeholder="How should people know you?"
          value={values.display_name}
          onChangeText={(t) => update('display_name', t)}
          autoCapitalize="words"
          error={errors.display_name}
          maxLength={50}
        />
        <Input
          label="Tagline"
          placeholder="Filmmaker & Workshop Facilitator"
          value={values.bio}
          onChangeText={(t) => update('bio', t)}
          maxLength={80}
        />
        <Input
          label="About"
          placeholder="Tell people a bit about your work…"
          value={values.about}
          onChangeText={(t) => update('about', t)}
          multiline
          numberOfLines={4}
          style={styles.aboutInput}
          maxLength={600}
        />
        <Input
          label="Location"
          icon="location-outline"
          placeholder="Berlin"
          value={values.location}
          onChangeText={(t) => update('location', t)}
          maxLength={60}
        />
        <Input
          label="Neighborhood (optional)"
          placeholder="Prenzlauerberg"
          value={values.neighborhood}
          onChangeText={(t) => update('neighborhood', t)}
          maxLength={60}
        />
        <Input
          label="Website (optional)"
          placeholder="yourdomain.com"
          value={values.website}
          onChangeText={(t) => update('website', t)}
          autoCapitalize="none"
          keyboardType="url"
          maxLength={120}
        />
      </View>

      {/* ── Disciplines ────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Disciplines</Text>
        <Text style={styles.sectionHint}>Pick a few — these power your discovery on the feed.</Text>
        <View style={styles.tags}>
          {EVENT_CATEGORIES.map((cat) => (
            <Tag
              key={cat}
              label={cat}
              selected={values.disciplines.includes(cat)}
              onPress={() => toggleDiscipline(cat)}
            />
          ))}
        </View>
      </View>

      {/* ── Experiences (edit mode only) ───────────────── */}
      {showRichSections && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Experience</Text>
            <TouchableOpacity
              onPress={addExperience}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="add-circle-outline" size={26} color={colors.black} />
            </TouchableOpacity>
          </View>

          {values.experiences.length === 0 && (
            <Text style={styles.sectionHint}>
              Add roles, residencies, or projects — like a LinkedIn history.
            </Text>
          )}

          {values.experiences.map((exp) => (
            <ExperienceEditor
              key={exp.id}
              experience={exp}
              onChange={(patch) => updateExperience(exp.id, patch)}
              onRemove={() => removeExperience(exp.id)}
            />
          ))}
        </View>
      )}

      {/* ── Gallery (edit mode only) ───────────────────── */}
      {showRichSections && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Gallery</Text>
            <Text style={styles.galleryCount}>
              {gallery.length + pendingUploads.length} / {GALLERY_MAX}
            </Text>
          </View>
          <Text style={styles.sectionHint}>
            Add photos of your work. Tap × to remove. Likes & comments coming later.
          </Text>

          <View style={styles.galleryGrid}>
            {galleryTiles}
            {pendingTiles}
            {gallery.length + pendingUploads.length < GALLERY_MAX && (
              <TouchableOpacity
                style={[styles.galleryTile, styles.galleryAddTile]}
                onPress={pickGalleryImages}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={28} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Submit ─────────────────────────────────────── */}
      <Button
        label={finalSubmitLabel}
        onPress={handleSubmit}
        isLoading={isSubmitting}
        style={styles.submitButton}
      />
    </View>
  );
}

// ─── Experience editor (one entry) ───────────────────────────────────────────

interface ExperienceEditorProps {
  experience: ProfileExperienceEntry;
  onChange: (patch: Partial<ProfileExperienceEntry>) => void;
  onRemove: () => void;
}

function ExperienceEditor({ experience, onChange, onRemove }: ExperienceEditorProps) {
  const isPresent = experience.end_date === null;

  return (
    <View style={styles.expCard}>
      <View style={styles.expCardHeader}>
        <Text style={styles.expCardTitle}>{experience.title || 'New experience'}</Text>
        <TouchableOpacity
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={18} color={colors.badge.red} />
        </TouchableOpacity>
      </View>

      <Input
        placeholder="Role / title"
        value={experience.title}
        onChangeText={(t) => onChange({ title: t })}
        maxLength={80}
      />
      <Input
        placeholder="Organisation / project"
        value={experience.organisation ?? ''}
        onChangeText={(t) => onChange({ organisation: t })}
        maxLength={80}
      />

      <View style={styles.expDateRow}>
        <View style={styles.expDateField}>
          <Input
            placeholder="Start (yyyy-mm)"
            value={experience.start_date ?? ''}
            onChangeText={(t) => onChange({ start_date: t })}
            autoCapitalize="none"
            maxLength={10}
          />
        </View>
        <View style={styles.expDateField}>
          <Input
            placeholder={isPresent ? 'Present' : 'End (yyyy-mm)'}
            value={experience.end_date ?? ''}
            onChangeText={(t) => onChange({ end_date: t })}
            editable={!isPresent}
            autoCapitalize="none"
            maxLength={10}
          />
        </View>
      </View>

      <TouchableOpacity
        style={styles.presentToggleRow}
        onPress={() => onChange({ end_date: isPresent ? '' : null })}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isPresent ? 'checkbox' : 'square-outline'}
          size={18}
          color={colors.black}
        />
        <Text style={styles.presentToggleText}>I currently work here</Text>
      </TouchableOpacity>

      <Input
        placeholder="What you did / are doing"
        value={experience.description ?? ''}
        onChangeText={(t) => onChange({ description: t })}
        multiline
        numberOfLines={3}
        style={styles.expDescription}
        maxLength={400}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { gap: spacing.xl },

  avatarPicker: { alignSelf: 'center' },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
  },
  avatarOverlay: {
    position: 'absolute',
    inset: 0,
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
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

  section: { gap: spacing.base },
  sectionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  sectionHint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: -spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  aboutInput: { height: 100, paddingTop: spacing.sm, textAlignVertical: 'top' },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  // Experience cards
  expCard: {
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  expCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expCardTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  expDateRow: { flexDirection: 'row', gap: spacing.sm },
  expDateField: { flex: 1 },
  expDescription: { height: 80, paddingTop: spacing.sm, textAlignVertical: 'top' },
  presentToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  presentToggleText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },

  // Gallery
  galleryCount: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  galleryTile: {
    width: 100,
    height: 100,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    position: 'relative',
  },
  galleryAddTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.white,
  },
  galleryImg: { width: '100%', height: '100%' },
  galleryImgPending: { opacity: 0.4 },
  galleryRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gallerySpinner: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  submitButton: { marginTop: spacing.sm },
});
