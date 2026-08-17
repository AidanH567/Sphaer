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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tag } from '@/components/ui/Tag';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { ErrorState } from '@/components/ui/ErrorState';
import { AddressAutocompleteInput, type SelectedAddress } from '@/components/ui/AddressAutocompleteInput';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useAuthContext } from '@/context/AuthContext';
import { Image } from 'expo-image';
import { useEvent } from '@/hooks/useEvents';
import { updateEvent, uploadGeneratedEventPoster } from '@/services/events.service';
import { useGeneratedPoster, type GeneratedPoster } from '@/hooks/useGeneratedPoster';
import {
  GeneratedPosterCanvas,
  posterCanvasHostStyle,
} from '@/components/events/GeneratedPosterCanvas';
import { geocodeAddress } from '@/lib/geocoding';
import { EVENT_CATEGORIES } from '@/constants/categories';
import type { EventUpdate } from '@/types/event.types';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthContext();
  const { event, isLoading, error, refetch } = useEvent(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  // Poster generated in this session, not yet uploaded. Held until Save so
  // one tap on "Generate" does not mutate the activity behind the user's back.
  const [generatedPoster, setGeneratedPoster] = useState<GeneratedPoster | null>(null);
  // Per-field validation errors — same pattern as create/index.tsx.
  const [errors, setErrors] = useState<{
    title?: string;
    startsAt?: string;
    endsAt?: string;
  }>({});
  // Structured place from an autocomplete pick. Cleared when the user keeps
  // typing afterward — then we fall back to live geocoding on save.
  const [selectedPlace, setSelectedPlace] = useState<SelectedAddress | null>(null);
  // Form state is seeded from the fetched event exactly once, so user edits
  // are never clobbered by a background refetch.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!event || hydrated) return;
    setTitle(event.title);
    setDescription(event.description ?? '');
    setAddress(event.address ?? '');
    setStartsAt(new Date(event.starts_at));
    setEndsAt(event.ends_at ? new Date(event.ends_at) : null);
    setIsFree(event.is_free ?? true);
    setPrice(event.price != null ? String(event.price) : '');
    setCategories(event.categories ?? []);
    setHydrated(true);
  }, [event, hydrated]);

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  // Reads the live form values, so a poster generated after fixing a typo in
  // the title carries the corrected one.
  const poster = useGeneratedPoster({
    title,
    startsAt: startsAt ? startsAt.toISOString() : undefined,
    endsAt: endsAt ? endsAt.toISOString() : null,
    locationName: selectedPlace?.name ?? event?.location_name ?? null,
    address: address.trim() || null,
  });

  async function handleGeneratePoster() {
    try {
      const generated = await poster.generate();
      setGeneratedPoster(generated);
      if (generated.titleTruncated) {
        Alert.alert(
          'Poster made',
          'Your title was a little long for the poster, so it was shortened there. The activity keeps its full title.'
        );
      }
    } catch (e: unknown) {
      Alert.alert(
        "Couldn't make a poster",
        e instanceof Error ? e.message : 'Please try again.'
      );
    }
  }

  async function handleSave() {
    if (!event) return;
    // Collect all per-field errors so the user sees every issue at once.
    const next: typeof errors = {};
    if (!title.trim()) next.title = 'Please add a title for your activity.';
    if (!startsAt) next.startsAt = 'Please pick a start date and time.';
    if (startsAt && endsAt && endsAt <= startsAt) {
      next.endsAt = 'End time must be after the start.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !startsAt) return;

    setIsSaving(true);
    try {
      const updates: EventUpdate = {
        title: title.trim(),
        description: description.trim() || null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt ? endsAt.toISOString() : null,
        categories,
        is_free: isFree,
        price: !isFree && price ? parseFloat(price) : null,
      };

      // Location fields are only written when the address actually changed,
      // so an untouched address keeps its original pin + venue name.
      const trimmedAddress = address.trim();
      if (selectedPlace) {
        updates.address = selectedPlace.formatted_address;
        updates.lat = selectedPlace.lat;
        updates.lng = selectedPlace.lng;
        updates.neighbourhood = selectedPlace.neighbourhood;
        updates.borough = selectedPlace.borough;
        if (selectedPlace.name) {
          updates.location_name = selectedPlace.name;
        }
      } else if (trimmedAddress !== (event.address ?? '').trim()) {
        // Typed (or cleared) without picking a suggestion — one-shot geocode,
        // mirroring create. Neighbourhood/borough are unknown for free text.
        updates.address = trimmedAddress || null;
        updates.neighbourhood = null;
        updates.borough = null;
        if (trimmedAddress) {
          const geo = await geocodeAddress(trimmedAddress);
          updates.lat = geo?.lat ?? null;
          updates.lng = geo?.lng ?? null;
        } else {
          updates.lat = null;
          updates.lng = null;
        }
      }

      // Upload before the row update so a failed upload leaves the activity
      // exactly as it was, rather than pointing poster_url at nothing.
      if (generatedPoster) {
        updates.poster_url = await uploadGeneratedEventPoster(
          event.creator_id,
          event.id,
          generatedPoster.base64
        );
      }

      await updateEvent(event.id, updates);
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
      <Text style={styles.navTitle}>Edit Activity</Text>
      <View style={styles.navSpacer} />
    </View>
  );

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {navBar}
        <ErrorState
          icon="cloud-offline-outline"
          title="Couldn't load this activity"
          body={error}
          onRetry={refetch}
          onBack={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (isLoading || (event && !hydrated)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {navBar}
        <View style={styles.center}>
          <ActivityIndicator color={colors.neutral.chocolate} />
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {navBar}
        <ErrorState
          icon="calendar-outline"
          title="Activity not found"
          body="This activity may have been cancelled or removed."
          onBack={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  // Creator-only guard. RLS would reject the update anyway — this just
  // surfaces a friendly state instead of a failing save.
  if (user?.id !== event.creator_id) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {navBar}
        <ErrorState
          icon="lock-closed-outline"
          title="Not your activity"
          body="You can only edit your own activities."
          onBack={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {navBar}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Choose topics?</Text>
        <View style={styles.tags}>
          {EVENT_CATEGORIES.map((cat) => (
            <Tag
              key={cat}
              label={cat}
              variant="choice"
              selected={categories.includes(cat)}
              onPress={() => toggleCategory(cat)}
            />
          ))}
        </View>

        <View style={styles.form}>
          <Input
            label="Title"
            placeholder=""
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
            }}
            error={errors.title}
          />
          <View>
            <Text style={styles.inputLabel}>Describe</Text>
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
          <DateTimeField
            label="Starts"
            value={startsAt}
            onChange={(d) => {
              setStartsAt(d);
              if (errors.startsAt) setErrors((e) => ({ ...e, startsAt: undefined }));
            }}
            placeholder="Pick a start time"
            minimumDate={new Date()}
          />
          {errors.startsAt && <Text style={styles.fieldError}>{errors.startsAt}</Text>}
          <DateTimeField
            label="Ends (optional)"
            value={endsAt}
            onChange={(d) => {
              setEndsAt(d);
              if (errors.endsAt) setErrors((e) => ({ ...e, endsAt: undefined }));
            }}
            placeholder="Pick an end time"
            clearable
            minimumDate={startsAt ?? new Date()}
          />
          {errors.endsAt && <Text style={styles.fieldError}>{errors.endsAt}</Text>}
          <AddressAutocompleteInput
            label="Location"
            placeholder="Search for a Berlin address…"
            helper="Type to search. Pick a suggestion to pin your activity on the map."
            value={address}
            onChangeText={setAddress}
            onSelect={setSelectedPlace}
            onClearSelection={() => setSelectedPlace(null)}
          />

          <View style={styles.priceRow}>
            <TouchableOpacity
              style={[styles.priceToggle, isFree && styles.priceToggleActive]}
              onPress={() => setIsFree(true)}
              accessibilityRole="button"
              accessibilityState={{ selected: isFree }}
            >
              <Text style={[styles.priceToggleText, isFree && styles.priceToggleTextActive]}>
                Free
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.priceToggle, !isFree && styles.priceToggleActive]}
              onPress={() => setIsFree(false)}
              accessibilityRole="button"
              accessibilityState={{ selected: !isFree }}
            >
              <Text style={[styles.priceToggleText, !isFree && styles.priceToggleTextActive]}>
                Paid
              </Text>
            </TouchableOpacity>
          </View>

          {!isFree && (
            <Input
              label="Price (€)"
              icon="pricetag-outline"
              placeholder="0.00"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />
          )}
        </View>

        {/* Cover image. Read-only here except for one action: an activity with
            no poster is a hole in the Mural, and this is where its creator can
            fill it without leaving the app to make artwork. Swapping an
            existing poster for a different photo still belongs to Create. */}
        <View style={styles.posterSection}>
          <Text style={styles.sectionLabel}>Cover image</Text>
          {generatedPoster ? (
            <>
              <Image
                source={{ uri: generatedPoster.dataUri }}
                style={styles.posterPreview}
                contentFit="cover"
              />
              <Text style={styles.posterHint}>
                Made from your title, date and location. Save to attach it.
              </Text>
            </>
          ) : event.poster_url ? (
            <Image
              source={{ uri: event.poster_url }}
              style={styles.posterPreview}
              contentFit="cover"
            />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.generateRow, !poster.canGenerate && styles.generateRowDisabled]}
                onPress={handleGeneratePoster}
                disabled={!poster.canGenerate || poster.isGenerating}
                accessibilityRole="button"
                accessibilityLabel="Generate a poster"
                accessibilityState={{ disabled: !poster.canGenerate || poster.isGenerating }}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={18}
                  color={
                    poster.canGenerate ? colors.neutral.chocolate : colors.neutral.neutral400
                  }
                />
                <Text
                  style={[
                    styles.generateLabel,
                    !poster.canGenerate && styles.generateLabelDisabled,
                  ]}
                >
                  {poster.isGenerating ? 'Making your poster…' : 'Generate a poster'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.posterHint}>
                This activity has no cover image, so it shows as a blank tile on the Mural.
              </Text>
            </>
          )}
        </View>

        <Button label="Save changes" onPress={handleSave} isLoading={isSaving} />
      </ScrollView>

      {/* Offscreen, at full 1080×1528 — see GeneratedPosterCanvas. */}
      {poster.layout && !event.poster_url && !generatedPoster && (
        <View style={posterCanvasHostStyle} pointerEvents="none">
          <GeneratedPosterCanvas ref={poster.canvasRef} layout={poster.layout} />
        </View>
      )}
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
  // Matches create/index.tsx (Figma Tabbar 6277:10003): SF Bold 18 ink.
  navTitle: {
    fontSize: 18,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.ink,
  },
  // Balances the 24px back chevron so the title stays centred.
  navSpacer: { width: 24 },
  scroll: { padding: spacing.base, gap: spacing.xl, paddingBottom: spacing['4xl'] },
  sectionLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.chocolate,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: -spacing.sm },
  form: { gap: spacing.base },
  posterSection: { gap: spacing.sm },
  posterPreview: { width: '100%', height: 240, borderRadius: radius.md },
  posterHint: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 12,
    color: colors.neutral.meta,
  },
  // Mirrors the same control on the Create screen: outlined, secondary,
  // never competing with the primary Save button.
  generateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.hiddenLines,
    borderRadius: radius.sm,
  },
  generateRowDisabled: { opacity: 0.6 },
  generateLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.chocolate,
  },
  generateLabelDisabled: { color: colors.neutral.neutral400 },
  // Error caption rendered under DateTimeFields (Input ships its own).
  fieldError: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 12,
    color: colors.badge.red,
    marginTop: -spacing.sm,
  },
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
  priceRow: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  priceToggle: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  priceToggleActive: { backgroundColor: colors.neutral.chocolate },
  priceToggleText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  priceToggleTextActive: { color: colors.white },
});

export const ErrorBoundary = makeRouteErrorBoundary('event-edit');
