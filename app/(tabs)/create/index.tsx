import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tag } from '@/components/ui/Tag';
import { Modal } from '@/components/ui/Modal';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useAuthContext } from '@/context/AuthContext';
import {
  createEvent,
  uploadEventPoster,
  uploadEventMedia,
  type EventInsertV3,
} from '@/services/events.service';
import { getAdminCircles } from '@/services/circles.service';
import { geocodeAddress } from '@/lib/geocoding';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { AddressAutocompleteInput, type SelectedAddress } from '@/components/ui/AddressAutocompleteInput';
import { EventCard } from '@/components/feed/EventCard';
import { EVENT_CATEGORIES } from '@/constants/categories';
import type { CircleWithCounts } from '@/types/circle.types';
import type { EventWithRelations } from '@/types/event.types';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

// Figma 6277:10054: dashed picker tiles are #9FA7B3 — not in the Neutral/*
// palette, scoped to this screen like the original poster tile.
const DASHED_TILE = '#9FA7B3';
// Figma 6277:10002 "By link" sub-caption grey — also outside the palette.
const VISIBILITY_CAPTION = '#A5A5A5';

const MAX_MEDIA_IMAGES = 4;

type Visibility = 'anyone' | 'invite_only';

/** '' → null; comma decimals accepted ("12,50"); invalid / negative → null. */
function parsePriceInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number.parseFloat(trimmed.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** '' → null; must be a whole number above 0, else null. */
function parseSpotsInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export default function CreateScreen() {
  const router = useRouter();
  const { user } = useAuthContext();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  // No Free/Paid toggle (Figma 6277:10002): empty or 0 price = free, >0 = paid.
  const [price, setPrice] = useState('');
  const [spots, setSpots] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('anyone');
  const [categories, setCategories] = useState<string[]>([]);
  const [posterUri, setPosterUri] = useState<string | null>(null);
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [adminCircles, setAdminCircles] = useState<CircleWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  // Confirm sheet asking the user if they want to publish without an address.
  // If yes, we call doPublish() — which is the real publish path.
  const [noAddressWarningVisible, setNoAddressWarningVisible] = useState(false);
  // Per-field validation errors. Cleared on edit; populated by handleCreate.
  // Matches the pattern from signup.tsx + ProfileForm.tsx.
  const [errors, setErrors] = useState<{
    title?: string;
    startsAt?: string;
    endsAt?: string;
    price?: string;
    spots?: string;
  }>({});
  // Structured place data captured when the user picks an autocomplete
  // suggestion. Cleared when they keep typing afterward — then we fall
  // back to live geocoding on submit.
  const [selectedPlace, setSelectedPlace] = useState<SelectedAddress | null>(null);

  // Load circles the user can host as (admin role). Trigger guarantees every
  // circle they created lands here.
  useEffect(() => {
    if (!user) return;
    getAdminCircles(user.id)
      .then(setAdminCircles)
      .catch(() => setAdminCircles([]));
  }, [user]);

  const parsedPrice = parsePriceInput(price);
  const isFree = parsedPrice === null || parsedPrice <= 0;

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function setStartsAtAndClearError(d: Date | null) {
    setStartsAt(d);
    if (errors.startsAt) setErrors((e) => ({ ...e, startsAt: undefined }));
  }

  async function pickPoster() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add a cover image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.9,
    });
    if (!result.canceled) {
      setPosterUri(result.assets[0].uri);
    }
  }

  async function pickMedia() {
    const remaining = MAX_MEDIA_IMAGES - mediaUris.length;
    if (remaining <= 0) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add media images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.9,
    });
    if (!result.canceled) {
      setMediaUris((prev) =>
        [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_MEDIA_IMAGES)
      );
    }
  }

  function removeMedia(index: number) {
    setMediaUris((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate() {
    if (!user) return;
    // Collect all per-field errors so the user sees every issue at once,
    // not one-at-a-time via sequential Alert popups.
    const next: typeof errors = {};
    if (!title.trim()) next.title = 'Please add a title for your activity.';
    if (!startsAt) next.startsAt = 'Please pick a start date and time.';
    if (startsAt && endsAt && endsAt <= startsAt) {
      next.endsAt = 'End time must be after the start.';
    }
    if (price.trim() && parsePriceInput(price) === null) {
      next.price = 'Enter a valid price.';
    }
    if (spots.trim() && parseSpotsInput(spots) === null) {
      next.spots = 'Enter a whole number above 0.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // No address → warn the user the event won't appear on the map.
    // Address isn't required (per spec) — they can proceed anyway.
    if (!address.trim()) {
      setNoAddressWarningVisible(true);
      return;
    }

    await doPublish();
  }

  async function doPublish() {
    if (!user || !startsAt) return; // already validated above
    setIsLoading(true);
    try {
      const eventId = crypto.randomUUID();
      let posterUrl: string | null = null;

      if (posterUri) {
        posterUrl = await uploadEventPoster(user.id, eventId, posterUri);
      }
      let mediaUrls: string[] = [];
      if (mediaUris.length > 0) {
        mediaUrls = await uploadEventMedia(user.id, eventId, mediaUris);
      }

      // Prefer the structured place data from the autocomplete pick.
      // If the user typed an address without picking a suggestion, fall
      // back to a one-shot live geocode on submit. If geocoding fails or
      // address is empty, save with lat/lng/neighbourhood = null — event
      // still creates, just won't appear on the map.
      let lat: number | null = null;
      let lng: number | null = null;
      let neighbourhood: string | null = null;
      let borough: string | null = null;
      let finalAddress: string | null = null;
      let finalLocationName: string | null = null;

      const trimmedAddress = address.trim();
      if (selectedPlace) {
        lat = selectedPlace.lat;
        lng = selectedPlace.lng;
        neighbourhood = selectedPlace.neighbourhood;
        borough = selectedPlace.borough;
        finalAddress = selectedPlace.formatted_address;
        // When Google returned a real venue (e.g. "Berghain"), use it for
        // `location_name` — the dedicated venue-name input was dropped in
        // the Figma 6277:10002 redesign (single "Location" field).
        finalLocationName = selectedPlace.name;
      } else if (trimmedAddress) {
        finalAddress = trimmedAddress;
        const geo = await geocodeAddress(trimmedAddress);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
        }
      }

      const payload: EventInsertV3 = {
        id: eventId,
        creator_id: user.id,
        circle_id: selectedCircleId,
        title: title.trim(),
        description: description.trim() || null,
        location_name: finalLocationName,
        address: finalAddress,
        lat,
        lng,
        neighbourhood,
        borough,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt ? endsAt.toISOString() : null,
        categories,
        poster_url: posterUrl,
        ticket_url: null,
        is_free: isFree,
        price: !isFree && parsedPrice ? parsedPrice : null,
      };

      // v3 columns (migration 20260612010000) go on the payload ONLY when
      // set / non-default. Vanilla activities then never trip the
      // missing-column fallback in createEvent on a not-yet-migrated DB.
      const trimmedSubtitle = subtitle.trim();
      if (trimmedSubtitle) payload.subtitle = trimmedSubtitle;
      const spotsNum = parseSpotsInput(spots);
      if (spotsNum !== null) payload.spots = spotsNum;
      if (visibility !== 'anyone') payload.visibility = visibility;
      if (mediaUrls.length > 0) payload.media_urls = mediaUrls;

      const { degraded } = await createEvent(payload);
      if (degraded) {
        // The insert succeeded on retry without the v3 columns — the DB
        // hasn't run the 20260612010000 migration yet. Tell the user their
        // activity is live, just without the brand-new fields. Non-blocking:
        // the alert sits on top of the feed we navigate to below.
        Alert.alert(
          'Published',
          'Sub Title/Spots/visibility will activate after the next database update.'
        );
      }

      // Trigger has already auto-registered the creator. Navigate
      // straight to the feed — useFocusEffect there will refetch and the
      // new activity appears on top (sorted by created_at desc).
      router.replace('/(tabs)/feed');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create activity.');
    } finally {
      setIsLoading(false);
    }
  }

  // Synthetic event for the Preview modal — same shape the feed receives,
  // so EventCard renders the real thing (title, date, time, location, price,
  // poster). Local posterUri renders fine through expo-image.
  const previewEvent: EventWithRelations = {
    id: 'preview',
    creator_id: user?.id ?? 'preview',
    circle_id: selectedCircleId,
    title: title.trim() || 'Untitled activity',
    description: description.trim() || null,
    location_name: selectedPlace?.name ?? null,
    address: address.trim() || null,
    lat: selectedPlace?.lat ?? null,
    lng: selectedPlace?.lng ?? null,
    neighbourhood: selectedPlace?.neighbourhood ?? null,
    borough: selectedPlace?.borough ?? null,
    starts_at: (startsAt ?? new Date()).toISOString(),
    ends_at: endsAt ? endsAt.toISOString() : null,
    categories,
    poster_url: posterUri,
    ticket_url: null,
    is_free: isFree,
    price: !isFree && parsedPrice ? parsedPrice : null,
    created_at: new Date().toISOString(),
    creator: null,
    circle: null,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Figma Tabbar 6277:10003: ✕ left, SF Bold 18 ink title, info right,
          white bar with 0 2 6 @8% shadow — no border. */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={24} color={colors.neutral.ink} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Create Activity</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="More information">
          <Ionicons name="information-circle-outline" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 1 — Topics */}
        <View style={styles.section}>
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
        </View>

        {/* 2 — Title */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Title</Text>
          <Input
            accessibilityLabel="Title"
            placeholder=""
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
            }}
            error={errors.title}
          />
        </View>

        {/* 3 — Sub Title */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Sub Title</Text>
          <TextInput
            style={styles.subtitleInput}
            accessibilityLabel="Sub Title"
            value={subtitle}
            onChangeText={setSubtitle}
            multiline
            numberOfLines={3}
            placeholder=""
            placeholderTextColor={colors.text.placeholder}
          />
        </View>

        {/* 4 — Describe */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Describe</Text>
          <TextInput
            style={styles.textarea}
            accessibilityLabel="Describe"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            placeholder=""
            placeholderTextColor={colors.text.placeholder}
          />
        </View>

        {/* 5 — Cover image */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Cover image</Text>
          <TouchableOpacity
            style={styles.posterPicker}
            onPress={pickPoster}
            accessibilityRole="button"
            accessibilityLabel={posterUri ? 'Change cover image' : 'Add cover image'}
          >
            {posterUri ? (
              <Image source={{ uri: posterUri }} style={styles.posterPreview} contentFit="cover" />
            ) : (
              <View style={styles.dashedTile}>
                <Ionicons name="add" size={24} color={DASHED_TILE} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* 6 — Media (up to 4 extra images, uploaded alongside the cover) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Media</Text>
          <View style={styles.mediaRow}>
            {mediaUris.map((uri, i) => (
              <View key={`${uri}-${i}`} style={styles.mediaThumbWrap}>
                <Image source={{ uri }} style={styles.mediaThumb} contentFit="cover" />
                <TouchableOpacity
                  style={styles.mediaRemove}
                  onPress={() => removeMedia(i)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove media image ${i + 1}`}
                >
                  <Ionicons name="close" size={12} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
            {mediaUris.length < MAX_MEDIA_IMAGES && (
              <TouchableOpacity
                style={styles.dashedTile}
                onPress={pickMedia}
                accessibilityRole="button"
                accessibilityLabel="Add media images"
              >
                <Ionicons name="add" size={24} color={DASHED_TILE} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 7 — Date + Time (both write startsAt: date picker / time picker).
            Ends stays as a compact extra field — our data model needs an
            optional end, the frame only shows start Date + Time. */}
        <View style={styles.section}>
          <View style={styles.fieldRow}>
            <View style={styles.fieldCol}>
              <Text style={styles.sectionLabel}>Date</Text>
              <DateTimeField
                label="Date"
                hideLabel
                mode="date"
                leadingIcon="calendar-outline"
                value={startsAt}
                onChange={setStartsAtAndClearError}
                placeholder="Add date"
                minimumDate={new Date()}
              />
            </View>
            <View style={styles.fieldCol}>
              <Text style={styles.sectionLabel}>Time</Text>
              <DateTimeField
                label="Time"
                hideLabel
                mode="time"
                leadingIcon="time-outline"
                value={startsAt}
                onChange={setStartsAtAndClearError}
                placeholder="Add time"
              />
            </View>
          </View>
          {errors.startsAt && <Text style={styles.fieldError}>{errors.startsAt}</Text>}
          <View style={styles.endsSection}>
            <Text style={styles.sectionLabel}>Ends (optional)</Text>
            <DateTimeField
              label="Ends (optional)"
              hideLabel
              leadingIcon="time-outline"
              value={endsAt}
              onChange={(d) => {
                setEndsAt(d);
                if (errors.endsAt) setErrors((e) => ({ ...e, endsAt: undefined }));
              }}
              placeholder="Pick an end time"
              clearable
              minimumDate={startsAt ?? new Date()}
            />
          </View>
          {errors.endsAt && <Text style={styles.fieldError}>{errors.endsAt}</Text>}
        </View>

        {/* 8 — Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Location</Text>
          <AddressAutocompleteInput
            label=""
            placeholder="Search for a Berlin address…"
            helper="Type to search. Pick a suggestion to pin your activity on the map."
            value={address}
            onChangeText={setAddress}
            onSelect={setSelectedPlace}
            onClearSelection={() => setSelectedPlace(null)}
          />
        </View>

        {/* 9 — Price + Spots (no Free/Paid toggle: empty/0 = free) */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldCol}>
            <Text style={styles.sectionLabel}>Price</Text>
            <Input
              accessibilityLabel="Price"
              icon="logo-euro"
              placeholder="0"
              value={price}
              onChangeText={(t) => {
                setPrice(t);
                if (errors.price) setErrors((e) => ({ ...e, price: undefined }));
              }}
              keyboardType="decimal-pad"
              error={errors.price}
            />
          </View>
          <View style={styles.fieldCol}>
            <Text style={styles.sectionLabel}>Spots</Text>
            <Input
              accessibilityLabel="Spots"
              icon="person-outline"
              placeholder=""
              value={spots}
              onChangeText={(t) => {
                setSpots(t);
                if (errors.spots) setErrors((e) => ({ ...e, spots: undefined }));
              }}
              keyboardType="number-pad"
              error={errors.spots}
            />
          </View>
        </View>

        {/* 10 — Host as circle (kept from v2 — core feature, not in frame).
            Only render if user admins any circles. */}
        {adminCircles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Host as</Text>
            <View style={styles.circlePicker}>
              <TouchableOpacity
                style={[styles.circlePill, !selectedCircleId && styles.circlePillActive]}
                onPress={() => setSelectedCircleId(null)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: !selectedCircleId }}
              >
                <Ionicons
                  name="person-outline"
                  size={14}
                  color={!selectedCircleId ? colors.white : colors.neutral.chocolate}
                />
                <Text
                  style={[
                    styles.circlePillText,
                    !selectedCircleId && styles.circlePillTextActive,
                  ]}
                >
                  Just me
                </Text>
              </TouchableOpacity>
              {adminCircles.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.circlePill,
                    selectedCircleId === c.id && styles.circlePillActive,
                  ]}
                  onPress={() => setSelectedCircleId(c.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedCircleId === c.id }}
                >
                  <Ionicons
                    name="people-outline"
                    size={14}
                    color={selectedCircleId === c.id ? colors.white : colors.neutral.chocolate}
                  />
                  <Text
                    style={[
                      styles.circlePillText,
                      selectedCircleId === c.id && styles.circlePillTextActive,
                    ]}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* 11 — Who can see this? (joined radio card, default Anyone) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Who can see this?</Text>
          <View style={styles.visibilityCard}>
            <TouchableOpacity
              style={styles.visibilityRow}
              onPress={() => setVisibility('anyone')}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityLabel="Anyone"
              accessibilityState={{ checked: visibility === 'anyone' }}
            >
              <View style={styles.visibilityIconCircle}>
                <Ionicons name="locate-outline" size={22} color={colors.neutral.chocolate} />
              </View>
              <View style={styles.visibilityTextWrap}>
                <Text style={styles.visibilityTitle}>Anyone</Text>
              </View>
              <View style={styles.radioOuter}>
                {visibility === 'anyone' && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.visibilityRow, styles.visibilityRowDivider]}
              onPress={() => setVisibility('invite_only')}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityLabel="Invite only"
              accessibilityState={{ checked: visibility === 'invite_only' }}
            >
              <View style={styles.visibilityIconCircle}>
                <Ionicons name="lock-closed-outline" size={22} color={colors.neutral.chocolate} />
              </View>
              <View style={styles.visibilityTextWrap}>
                <Text style={styles.visibilityTitle}>Invite only</Text>
                <Text style={styles.visibilityCaption}>By link</Text>
              </View>
              <View style={styles.radioOuter}>
                {visibility === 'invite_only' && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 12 — CTAs */}
        <View style={styles.ctas}>
          <Button label="Preview" variant="secondary" onPress={() => setPreviewVisible(true)} />
          <Button label="Publish" onPress={handleCreate} isLoading={isLoading} />
        </View>
      </ScrollView>

      {/* Preview — the real feed EventCard fed with current form values.
          pointerEvents="none" keeps the card's own press (event detail
          route) inert; the Modal supplies the close affordance. */}
      <Modal visible={previewVisible} onClose={() => setPreviewVisible(false)}>
        <Text style={styles.previewHeading}>Preview</Text>
        <View style={styles.previewCardWrap} pointerEvents="none">
          <EventCard event={previewEvent} />
        </View>
      </Modal>

      <ConfirmSheet
        visible={noAddressWarningVisible}
        title="Publish without an address?"
        message="You haven't added an address, so this activity won't appear on the map. People can still find it in the feed."
        confirmLabel="Publish anyway"
        cancelLabel="Add an address"
        onConfirm={async () => {
          setNoAddressWarningVisible(false);
          await doPublish();
        }}
        onClose={() => setNoAddressWarningVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  // Figma Tabbar 6277:10003 — white, soft 0 2 6 @8% shadow, no border.
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
    zIndex: 10,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.ink,
  },
  // Sections sit 24 apart; label→field gap is 6 (Figma 6277:10002).
  scroll: { padding: spacing.base, gap: spacing.xl, paddingBottom: spacing['4xl'] },
  section: { gap: 6 },
  // Figma form labels: SF Semibold 17 chocolate (Primary/Category Header).
  sectionLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.chocolate,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // Error caption rendered under DateTimeFields (Input ships its own).
  fieldError: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 12,
    color: colors.badge.red,
  },
  // Sub Title — multiline sibling of Describe at the Figma 88px height.
  subtitleInput: {
    borderWidth: 1,
    borderColor: colors.neutral.hiddenLines,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 88,
    textAlignVertical: 'top',
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
  // Side-by-side field pairs (Date+Time, Price+Spots): ~166px columns.
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  fieldCol: { flex: 1, gap: 6 },
  endsSection: { gap: 6, marginTop: spacing.md },
  posterPicker: { borderRadius: radius.md, overflow: 'hidden', alignSelf: 'stretch' },
  posterPreview: { width: '100%', height: 240 },
  // Figma 6277:10054: 60px dashed square, 2px #9FA7B3, radius 9.
  dashedTile: {
    width: 60,
    height: 60,
    borderWidth: 2,
    borderColor: DASHED_TILE,
    borderStyle: 'dashed',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  mediaThumbWrap: { width: 60, height: 60 },
  mediaThumb: { width: 60, height: 60, borderRadius: 9 },
  mediaRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.neutral.chocolate,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // Restyled to the create-flow chip language (Tag variant="choice"):
  // 1.7px neutral-700 outline, chocolate label; active = chocolate fill.
  circlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.7,
    borderColor: colors.neutral.neutral700,
    backgroundColor: colors.white,
  },
  circlePillActive: {
    backgroundColor: colors.neutral.chocolate,
    borderColor: colors.neutral.chocolate,
  },
  circlePillText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.chocolate,
  },
  circlePillTextActive: { color: colors.white },
  // "Who can see this?" joined card — Figma 6277:10002.
  visibilityCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral.hiddenLines,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  visibilityRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral.hiddenLines,
  },
  visibilityIconCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: colors.appleMail,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visibilityTextWrap: { flex: 1, gap: 1 },
  visibilityTitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.chocolate,
  },
  visibilityCaption: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.xs,
    color: VISIBILITY_CAPTION,
  },
  // 20px radios — 1.5px hidden-lines ring, chocolate dot when selected.
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.neutral.hiddenLines,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.neutral.chocolate,
  },
  ctas: { gap: spacing.md },
  previewHeading: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.chocolate,
    marginBottom: spacing.md,
  },
  previewCardWrap: { marginHorizontal: -spacing.base },
});

export const ErrorBoundary = makeRouteErrorBoundary('create-activity');
