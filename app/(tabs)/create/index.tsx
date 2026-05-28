import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tag } from '@/components/ui/Tag';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useAuthContext } from '@/context/AuthContext';
import { createEvent, uploadEventPoster } from '@/services/events.service';
import { getAdminCircles } from '@/services/circles.service';
import { EVENT_CATEGORIES } from '@/constants/categories';
import type { CircleWithCounts } from '@/types/circle.types';

export default function CreateScreen() {
  const router = useRouter();
  const { user } = useAuthContext();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [posterUri, setPosterUri] = useState<string | null>(null);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [adminCircles, setAdminCircles] = useState<CircleWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load circles the user can host as (admin role). Trigger guarantees every
  // circle they created lands here.
  useEffect(() => {
    if (!user) return;
    getAdminCircles(user.id)
      .then(setAdminCircles)
      .catch(() => setAdminCircles([]));
  }, [user]);

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function pickPoster() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add a poster.');
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

  async function handleCreate() {
    if (!user) return;
    if (!title.trim()) {
      Alert.alert('Title required', 'Please add a title for your activity.');
      return;
    }
    if (!startsAt) {
      Alert.alert('Start time required', 'Please pick a start date and time.');
      return;
    }
    if (endsAt && endsAt <= startsAt) {
      Alert.alert('End must be after start', 'Please pick an end time later than the start.');
      return;
    }

    setIsLoading(true);
    try {
      const eventId = crypto.randomUUID();
      let posterUrl: string | null = null;

      if (posterUri) {
        posterUrl = await uploadEventPoster(user.id, eventId, posterUri);
      }

      await createEvent({
        id: eventId,
        creator_id: user.id,
        circle_id: selectedCircleId,
        title: title.trim(),
        description: description.trim() || null,
        location_name: locationName.trim() || null,
        address: address.trim() || null,
        lat: null,
        lng: null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt ? endsAt.toISOString() : null,
        categories,
        poster_url: posterUrl,
        ticket_url: null,
        is_free: isFree,
        price: !isFree && price ? parseFloat(price) : null,
      });

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Create Activity</Text>
        <TouchableOpacity>
          <Ionicons name="information-circle-outline" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Choose topics</Text>
        <View style={styles.tags}>
          {EVENT_CATEGORIES.map((cat) => (
            <Tag
              key={cat}
              label={cat}
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
            onChangeText={setTitle}
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
          <Input
            label="Location"
            icon="location-outline"
            placeholder="Venue name"
            value={locationName}
            onChangeText={setLocationName}
          />
          <Input
            label="Address"
            icon="map-outline"
            placeholder="Street, Berlin"
            value={address}
            onChangeText={setAddress}
          />
          <DateTimeField
            label="Starts"
            value={startsAt}
            onChange={setStartsAt}
            placeholder="Pick a start time"
            minimumDate={new Date()}
          />
          <DateTimeField
            label="Ends (optional)"
            value={endsAt}
            onChange={setEndsAt}
            placeholder="Pick an end time"
            clearable
            minimumDate={startsAt ?? new Date()}
          />

          <View style={styles.priceRow}>
            <TouchableOpacity
              style={[styles.priceToggle, isFree && styles.priceToggleActive]}
              onPress={() => setIsFree(true)}
            >
              <Text style={[styles.priceToggleText, isFree && styles.priceToggleTextActive]}>
                Free
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.priceToggle, !isFree && styles.priceToggleActive]}
              onPress={() => setIsFree(false)}
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

          {/* Circle association — only render if user admins any circles */}
          {adminCircles.length > 0 && (
            <View>
              <Text style={styles.inputLabel}>Host as</Text>
              <View style={styles.circlePicker}>
                <TouchableOpacity
                  style={[styles.circlePill, !selectedCircleId && styles.circlePillActive]}
                  onPress={() => setSelectedCircleId(null)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="person-outline"
                    size={14}
                    color={!selectedCircleId ? colors.white : colors.text.secondary}
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
                  >
                    <Ionicons
                      name="people-outline"
                      size={14}
                      color={selectedCircleId === c.id ? colors.white : colors.text.secondary}
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
        </View>

        <TouchableOpacity style={styles.posterPicker} onPress={pickPoster}>
          {posterUri ? (
            <Image source={{ uri: posterUri }} style={styles.posterPreview} resizeMode="cover" />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Ionicons name="image-outline" size={32} color={colors.text.tertiary} />
              <Text style={styles.posterHint}>Add poster image</Text>
            </View>
          )}
        </TouchableOpacity>

        <Button
          label="Publish activity"
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
  scroll: { padding: spacing.base, gap: spacing.xl, paddingBottom: spacing['4xl'] },
  sectionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: -spacing.sm },
  form: { gap: spacing.base },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  textarea: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 100,
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
  priceToggleActive: { backgroundColor: colors.black },
  priceToggleText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  priceToggleTextActive: { color: colors.white },
  circlePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  circlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  circlePillActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  circlePillText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  circlePillTextActive: { color: colors.white },
  posterPicker: { borderRadius: 12, overflow: 'hidden' },
  posterPreview: { width: '100%', height: 240 },
  posterPlaceholder: {
    height: 160,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  posterHint: { fontSize: typography.fontSize.sm, color: colors.text.tertiary },
  cta: {},
});
