import React, { useCallback, useEffect, useState } from 'react';
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
import { CircleActivityCard } from '@/components/circles/CircleActivityCard';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useCircle } from '@/hooks/useCircles';
import { useAuthContext } from '@/context/AuthContext';
import {
  isMember as isCircleMember,
  joinCircle,
  leaveCircle,
} from '@/services/circles.service';
import { supabase } from '@/lib/supabase';
import type { EventWithRelations } from '@/types/event.types';
import type { Profile } from '@/types/user.types';

const MEMBERS_PREVIEW_LIMIT = 6;

export default function CircleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthContext();

  const { circle, isLoading } = useCircle(id);

  const [memberStatus, setMemberStatus] = useState<'unknown' | 'in' | 'out'>('unknown');
  const [activities, setActivities] = useState<EventWithRelations[]>([]);
  const [membersPreview, setMembersPreview] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);

  // Check current membership + fetch upcoming activities + member preview
  useEffect(() => {
    if (!id) return;
    let active = true;

    Promise.all([
      user ? isCircleMember(user.id, id).catch(() => false) : Promise.resolve(false),
      fetchCircleActivities(id),
      fetchCircleMembersPreview(id, MEMBERS_PREVIEW_LIMIT),
    ]).then(([memberFlag, acts, members]) => {
      if (!active) return;
      setMemberStatus(memberFlag ? 'in' : 'out');
      setActivities(acts);
      setMembersPreview(members);
    });

    return () => {
      active = false;
    };
  }, [id, user]);

  const handleMembership = useCallback(async () => {
    if (!user || !circle) {
      Alert.alert('Sign in required', 'Please sign in to join circles.');
      return;
    }
    setBusy(true);
    try {
      if (memberStatus === 'in') {
        await leaveCircle(user.id, circle.id);
        setMemberStatus('out');
      } else {
        await joinCircle(user.id, circle.id);
        setMemberStatus('in');
      }
      // Refresh members preview
      const next = await fetchCircleMembersPreview(circle.id, MEMBERS_PREVIEW_LIMIT);
      setMembersPreview(next);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }, [user, circle, memberStatus]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (!circle) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.notFound}>Circle not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isMemberFlag = memberStatus === 'in';
  const hiddenMembers = Math.max(0, circle.members_count - membersPreview.length);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton}>
          <Ionicons name="information-circle-outline" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Banner + overlapping avatar */}
        <View style={styles.bannerWrap}>
          {circle.cover_url ? (
            <Image source={{ uri: circle.cover_url }} style={styles.cover} resizeMode="cover" />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]} />
          )}
          {circle.avatar_url ? (
            <Image source={{ uri: circle.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="people" size={32} color={colors.text.tertiary} />
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>{circle.name}</Text>
          <Text style={styles.meta}>
            {circle.members_count.toLocaleString('de-DE')} members{'  ·  '}
            {circle.activities_count} activities
          </Text>
          {circle.description && (
            <Text style={styles.description}>{circle.description}</Text>
          )}

          <TouchableOpacity
            style={[styles.membershipButton, !isMemberFlag && styles.membershipButtonJoin]}
            onPress={handleMembership}
            activeOpacity={0.85}
            disabled={busy || memberStatus === 'unknown'}
          >
            {busy ? (
              <ActivityIndicator color={isMemberFlag ? colors.black : colors.white} />
            ) : (
              <>
                <Ionicons
                  name={isMemberFlag ? 'person' : 'person-add-outline'}
                  size={18}
                  color={isMemberFlag ? colors.text.primary : colors.white}
                />
                <Text
                  style={[styles.membershipText, !isMemberFlag && styles.membershipTextJoin]}
                >
                  {isMemberFlag ? "You're a member" : 'Join circle'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.conversationButton}
            activeOpacity={0.85}
            onPress={() => Alert.alert('Coming soon', 'Circle conversations are not wired up yet.')}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.white} />
            <Text style={styles.conversationText}>Join conversation</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Upcoming Activities — real events with circle_id == this circle */}
          <Text style={styles.sectionHeading}>Upcoming Activities</Text>
          {activities.length === 0 ? (
            <Text style={styles.emptyHint}>No upcoming activities yet.</Text>
          ) : (
            activities.map((activity) => (
              <CircleActivityCard
                key={activity.id}
                activity={{
                  id: activity.id,
                  title: activity.title,
                  dateLabel: new Date(activity.starts_at).toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  }),
                  timeLabel: new Date(activity.starts_at).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  image: activity.poster_url ?? '',
                }}
              />
            ))
          )}

          <View style={styles.divider} />

          {/* Members preview */}
          <Text style={styles.sectionHeading}>Members</Text>
          {membersPreview.length === 0 ? (
            <Text style={styles.emptyHint}>No members yet.</Text>
          ) : (
            <View style={styles.membersRow}>
              {membersPreview.map((member, i) => (
                <Image
                  key={member.id}
                  source={{ uri: member.avatar_url ?? '' }}
                  style={[styles.memberAvatar, i > 0 && styles.memberAvatarOverlap]}
                />
              ))}
              {hiddenMembers > 0 && (
                <Text style={styles.memberMore}>
                  +{hiddenMembers.toLocaleString('de-DE')}
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Helpers (could live in circles.service later) ────────── */

async function fetchCircleActivities(circleId: string): Promise<EventWithRelations[]> {
  const { data, error } = await supabase
    .from('events')
    .select(`*, creator:profiles!events_creator_id_fkey(*), circle:circles(*)`)
    .eq('circle_id', circleId)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(5);
  if (error) return [];
  return (data as EventWithRelations[]) ?? [];
}

async function fetchCircleMembersPreview(circleId: string, limit: number): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('circle_members')
    .select('user:profiles!circle_members_user_id_fkey(*)')
    .eq('circle_id', circleId)
    .limit(limit);
  if (error) return [];
  return (data ?? [])
    .map((row) => (row as { user: Profile | null }).user)
    .filter((p): p is Profile => p !== null);
}

const AVATAR_SIZE = 88;
const COVER_HEIGHT = 190;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: typography.fontSize.base, color: colors.text.tertiary },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  navButton: { padding: spacing.sm },

  scroll: { paddingBottom: 110 },

  bannerWrap: { marginBottom: AVATAR_SIZE / 2 },
  cover: { width: '100%', height: COVER_HEIGHT, backgroundColor: colors.surface },
  coverPlaceholder: { backgroundColor: '#E7E2D5' },
  avatar: {
    position: 'absolute',
    left: spacing.base,
    bottom: -AVATAR_SIZE / 2,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.white,
    backgroundColor: colors.surface,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { paddingHorizontal: spacing.base, paddingTop: spacing.md },

  name: {
    fontFamily: typography.fontFamily.display,
    fontSize: 24,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  meta: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  description: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    marginTop: spacing.sm,
  },

  membershipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: spacing.lg,
  },
  membershipButtonJoin: { backgroundColor: colors.black, borderColor: colors.black },
  membershipText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 16,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  membershipTextJoin: { color: colors.white },

  conversationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
    borderRadius: radius.full,
    backgroundColor: colors.black,
    marginTop: spacing.md,
  },
  conversationText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 16,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },

  sectionHeading: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 20,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },

  emptyHint: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },

  membersRow: { flexDirection: 'row', alignItems: 'center' },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.surface,
  },
  memberAvatarOverlap: { marginLeft: -12 },
  memberMore: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginLeft: spacing.md,
  },
});
