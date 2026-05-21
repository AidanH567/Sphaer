import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CircleActivityCard } from '@/components/circles/CircleActivityCard';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { getMockCircleById } from '@/data/mockCircles';

// NOTE: reads mock data from src/data/mockCircles.ts. To go live, swap
// getMockCircleById() for the useCircle() hook (src/hooks/useCircles.ts).

export default function CircleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const circle = getMockCircleById(id);

  // The user reaches this screen by pressing "Join Circle", so they are a member.
  const [isMember, setIsMember] = useState(true);

  // Graceful state for an unknown id — never throws.
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

  const hiddenMembers = Math.max(0, circle.members_count - circle.membersPreview.length);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
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
          <Image source={{ uri: circle.cover_url }} style={styles.cover} resizeMode="cover" />
          <Image source={{ uri: circle.avatar_url }} style={styles.avatar} />
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>{circle.name}</Text>
          <Text style={styles.meta}>
            {circle.members_count.toLocaleString('de-DE')} members{'  ·  '}
            {circle.activities_count} activities
          </Text>
          <Text style={styles.description}>{circle.description}</Text>

          {/* Membership button */}
          <TouchableOpacity
            style={[styles.membershipButton, !isMember && styles.membershipButtonJoin]}
            onPress={() => setIsMember((v) => !v)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={isMember ? 'person' : 'person-add-outline'}
              size={18}
              color={isMember ? colors.text.primary : colors.white}
            />
            <Text style={[styles.membershipText, !isMember && styles.membershipTextJoin]}>
              {isMember ? "You're a member" : 'Join circle'}
            </Text>
          </TouchableOpacity>

          {/* Join conversation */}
          <TouchableOpacity style={styles.conversationButton} activeOpacity={0.85}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.white} />
            <Text style={styles.conversationText}>Join conversation</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Upcoming Activities */}
          <Text style={styles.sectionHeading}>Upcoming Activities</Text>
          {circle.upcomingActivities.map((activity) => (
            <CircleActivityCard key={activity.id} activity={activity} />
          ))}

          <View style={styles.divider} />

          {/* Members */}
          <Text style={styles.sectionHeading}>Members</Text>
          <View style={styles.membersRow}>
            {circle.membersPreview.map((member, i) => (
              <Image
                key={member.id}
                source={{ uri: member.avatar }}
                style={[styles.memberAvatar, i > 0 && styles.memberAvatarOverlap]}
              />
            ))}
            {hiddenMembers > 0 && (
              <Text style={styles.memberMore}>
                +{hiddenMembers.toLocaleString('de-DE')}
              </Text>
            )}
          </View>

          {/* From the community */}
          {circle.communityPosts.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionHeading}>From the community</Text>
              {circle.communityPosts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  <Text style={styles.postTitle}>{post.title}</Text>
                  <Text style={styles.postAuthor}>by {post.author}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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

  bannerWrap: {
    marginBottom: AVATAR_SIZE / 2,
  },
  cover: {
    width: '100%',
    height: COVER_HEIGHT,
    backgroundColor: colors.surface,
  },
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

  body: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },

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

  // Membership button — outlined when member, dark when not
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
  membershipButtonJoin: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
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

  // Members preview
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.surface,
  },
  memberAvatarOverlap: {
    marginLeft: -12,
  },
  memberMore: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginLeft: spacing.md,
  },

  // Community posts
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.sm,
    gap: 2,
  },
  postTitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  postAuthor: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: colors.text.tertiary,
  },
});
