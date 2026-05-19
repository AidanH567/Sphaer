import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tag } from '@/components/ui/Tag';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useAuthContext } from '@/context/AuthContext';
import { updateProfile, uploadAvatar } from '@/services/profile.service';
import { EVENT_CATEGORIES } from '@/constants/categories';

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, setProfile } = useAuthContext();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('Berlin');
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  function toggleDiscipline(disc: string) {
    setDisciplines((prev) =>
      prev.includes(disc) ? prev.filter((d) => d !== disc) : [...prev, disc]
    );
  }

  async function handleFinish() {
    if (!user) return;
    if (!displayName.trim()) {
      Alert.alert('Name required', 'Please enter your display name.');
      return;
    }

    setIsLoading(true);
    try {
      let avatarUrl: string | undefined;
      if (avatarUri) {
        avatarUrl = await uploadAvatar(user.id, avatarUri);
      }

      const updated = await updateProfile(user.id, {
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        location: location.trim() || null,
        disciplines,
        avatar_url: avatarUrl ?? null,
      });

      setProfile(updated);
      router.replace('/(tabs)/feed');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save profile.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Set up your profile</Text>
        <Text style={styles.subtitle}>Tell the community a bit about yourself.</Text>

        <TouchableOpacity style={styles.avatarPicker} onPress={pickAvatar}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="camera-outline" size={28} color={colors.text.tertiary} />
              <Text style={styles.avatarHint}>Add photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.form}>
          <Input
            label="Display name"
            placeholder="How should people know you?"
            value={displayName}
            onChangeText={setDisplayName}
          />
          <Input
            label="Bio"
            placeholder="A short intro…"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={3}
            style={styles.bioInput}
          />
          <Input
            label="Location"
            icon="location-outline"
            placeholder="Berlin"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        <Text style={styles.sectionLabel}>What are your disciplines?</Text>
        <View style={styles.tags}>
          {EVENT_CATEGORIES.map((cat) => (
            <Tag
              key={cat}
              label={cat}
              selected={disciplines.includes(cat)}
              onPress={() => toggleDiscipline(cat)}
            />
          ))}
        </View>

        <Button
          label="Let's go"
          onPress={handleFinish}
          isLoading={isLoading}
          style={styles.cta}
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
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: -spacing.md,
  },
  avatarPicker: { alignSelf: 'center' },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
  form: { gap: spacing.base },
  bioInput: { height: 80, paddingTop: spacing.sm },
  sectionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: -spacing.sm,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cta: {},
});
