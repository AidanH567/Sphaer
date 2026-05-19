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
import { useCircle } from '@/hooks/useCircles';
import { useAuthContext } from '@/context/AuthContext';
import { useEvents } from '@/hooks/useEvents';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EventCard } from '@/components/feed/EventCard';
import { joinCircle, leaveCircle } from '@/services/circles.service';
import { colors, typography, spacing, shadow } from '@/constants/theme';
import { formatMemberCount } from '@/utils/format';

export default function CircleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthContext();
  const { circle, isLoading } = useCircle(id);
  const { events } = useEvents({ search: undefined });
  const circleEvents = events.filter((e) => e.circle_id === id);

  const [isMember, setIsMember] = useState(circle?.is_member ?? false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  async function handleToggleMembership() {
    if (!user || !circle) return;
    setIsActionLoading(true);
    try {
      if (isMember) {
        await leaveCircle(user.id, circle.id);
        setIsMember(false);
      } else {
        await joinCircle(user.id, circle.id);
        setIsMember(true);
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update membership.');
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

  if (!circle) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {circle.cover_url && (
          <Image source={{ uri: circle.cover_url }} style={styles.cover} resizeMode="cover" />
        )}

        <View style={styles.profileCard}>
          <Avatar uri={circle.avatar_url} name={circle.name} size={80} />
          <Text style={styles.name}>{circle.name}</Text>
          <Text style={styles.meta}>
            {formatMemberCount(circle.members_count)} · {circle.activities_count} Activities
          </Text>
          {circle.description && (
            <Text style={styles.description}>{circle.description}</Text>
          )}

          <View style={styles.actions}>
            <Button
              label={isMember ? 'Leave circle' : 'Join circle'}
              onPress={handleToggleMembership}
              isLoading={isActionLoading}
              variant={isMember ? 'secondary' : 'primary'}
              style={styles.joinButton}
            />
          </View>
        </View>

        {circleEvents.length > 0 && (
          <View style={styles.eventsSection}>
            <Text style={styles.sectionTitle}>Activities</Text>
            {circleEvents.map((event) => (
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
  navBar: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  backButton: { padding: spacing.sm },
  cover: { width: '100%', height: 180, backgroundColor: colors.surface },
  profileCard: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadow.sm,
  },
  name: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  meta: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  description: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  actions: { width: '100%', marginTop: spacing.sm },
  joinButton: {},
  eventsSection: { paddingTop: spacing.base },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
});
