import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useEvents } from '@/hooks/useEvents';
import { Avatar } from '@/components/ui/Avatar';
import { Tag } from '@/components/ui/Tag';
import { EventCard } from '@/components/feed/EventCard';
import { colors, typography, spacing } from '@/constants/theme';
import { formatCount } from '@/utils/format';
import { signOut } from '@/services/auth.service';

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { profile, isLoading } = useProfile(user?.id);
  const { events } = useEvents();
  const myEvents = events.filter((e) => e.creator_id === user?.id);

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.black} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <Text style={styles.navTitle}>Profile</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {profile?.cover_url ? (
          <Image source={{ uri: profile.cover_url }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={styles.coverPlaceholder} />
        )}

        <View style={styles.profileSection}>
          <Avatar
            uri={profile?.avatar_url}
            name={profile?.display_name ?? user?.email ?? ''}
            size={80}
          />
          <Text style={styles.name}>
            {profile?.display_name ?? user?.email ?? 'My Profile'}
          </Text>
          {profile?.username && (
            <Text style={styles.username}>@{profile.username}</Text>
          )}
          {profile?.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{formatCount((profile as any)?.followers_count ?? 0)}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{formatCount((profile as any)?.following_count ?? 0)}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{myEvents.length}</Text>
              <Text style={styles.statLabel}>Activities</Text>
            </View>
          </View>

          {profile?.disciplines && profile.disciplines.length > 0 && (
            <View style={styles.disciplines}>
              {profile.disciplines.map((d) => (
                <Tag key={d} label={d} />
              ))}
            </View>
          )}
        </View>

        {myEvents.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>My Activities</Text>
            {myEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </View>
        )}
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navTitle: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  cover: { width: '100%', height: 140, backgroundColor: colors.surface },
  coverPlaceholder: { height: 80, backgroundColor: colors.surface },
  profileSection: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    marginTop: -40,
  },
  name: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  username: { fontSize: typography.fontSize.sm, color: colors.text.tertiary },
  bio: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.md,
  },
  stat: { alignItems: 'center', gap: 2 },
  statNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: { fontSize: typography.fontSize.xs, color: colors.text.tertiary },
  statDivider: { width: 1, height: 24, backgroundColor: colors.border },
  disciplines: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
});
