import React, { useState } from 'react';
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
import { colors, typography, spacing } from '@/constants/theme';
import { useAuthContext } from '@/context/AuthContext';
import { createEvent, uploadEventPoster } from '@/services/events.service';
import { EVENT_CATEGORIES } from '@/constants/categories';

export default function CreateScreen() {
  const router = useRouter();
  const { user } = useAuthContext();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [posterUri, setPosterUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function pickPoster() {
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
      Alert.alert('Date required', 'Please add a date for your activity.');
      return;
    }

    setIsLoading(true);
    try {
      const eventId = crypto.randomUUID();
      let posterUrl: string | undefined;

      if (posterUri) {
        posterUrl = await uploadEventPoster(eventId, posterUri);
      }

      await createEvent({
        id: eventId,
        creator_id: user.id,
        circle_id: null,
        title: title.trim(),
        description: description.trim() || null,
        location_name: locationName.trim() || null,
        address: address.trim() || null,
        lat: null,
        lng: null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: null,
        categories,
        poster_url: posterUrl ?? null,
        ticket_url: null,
        is_free: isFree,
        price: !isFree && price ? parseFloat(price) : null,
      });

      Alert.alert('Created!', 'Your activity is live.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/feed') },
      ]);
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
        <Text style={styles.sectionLabel}>Choose topics?</Text>
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
          <Input
            label="Sub Title"
            placeholder=""
            value={subtitle}
            onChangeText={setSubtitle}
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
          <Input
            label="Date & Time"
            icon="calendar-outline"
            placeholder="e.g. 2025-06-15T19:00"
            value={startsAt}
            onChangeText={setStartsAt}
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
