import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '@/hooks/useProfile';
import { useAuthContext } from '@/context/AuthContext';
import { useEvents } from '@/hooks/useEvents';
import { Avatar } from '@/components/ui/Avatar';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { EventCard } from '@/components/feed/EventCard';
import { followUser, unfollowUser } from '@/services/profile.service';
import { colors, typography, spacing } from '@/constants/theme';
import { formatCount } from '@/utils/format';

export default function UserProfileScreen() {
  const { id: userId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthContext();
  const { profile, isLoading } = useProfile(userId);
  const { events } = useEvents();
  const userEvents = events.filter((e) => e.creator_id === userId);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const isOwnProfile = user?.id === userId;

  async function handleToggleFollow() {
    if (!user || !profile) return;
    setIsActionLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(user.id, profile.id);
        setIsFollowing(false);
      } else {
        await followUser(user.id, profile.id);
        setIsFollowing(true);
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setIsActionLoading(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.black} />
      </View>
    );
  }

  if (!profile) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {profile.cover_url ? (
          <Image source={{ uri: profile.cover_url }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={styles.coverPlaceholder} />
        )}

        <View style={styles.profileSection}>
          <Avatar uri={profile.avatar_url} name={profile.display_name ?? ''} size={80} />
          <Text style={styles.name}>{profile.display_name ?? profile.username}</Text>
          {profile.username && (
            <Text style={styles.username}>@{profile.username}</Text>
          )}
          {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

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
          </View>

          {!isOwnProfile && (
            <View style={styles.actions}>
              <Button
                label={isFollowing ? 'Following' : 'Follow'}
                variant={isFollowing ? 'secondary' : 'primary'}
                onPress={handleToggleFollow}
                isLoading={isActionLoading}
                style={styles.actionButton}
              />
              <Button
                label="Message"
                variant="secondary"
                onPress={() => router.push(`/messages/${userId}`)}
                style={styles.actionButton}
              />
            </View>
          )}

          {profile.disciplines && profile.disciplines.length > 0 && (
            <View style={styles.disciplines}>
              {profile.disciplines.map((d) => (
                <Tag key={d} label={d} />
              ))}
            </View>
          )}
        </View>

        {userEvents.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Activities</Text>
            {userEvents.map((event) => (
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
  navBar: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  navButton: { padding: spacing.sm },
  cover: { width: '100%', height: 140, backgroundColor: colors.surface },
  coverPlaceholder: { height: 80, backgroundColor: colors.surface },
  profileSection: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    marginTop: -40,
  },
  name: {
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
  actions: { flexDirection: 'row', gap: spacing.md, width: '100%' },
  actionButton: { flex: 1 },
  disciplines: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
});
