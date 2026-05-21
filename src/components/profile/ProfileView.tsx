import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography, spacing } from '@/constants/theme';
import { ProfileActivityCard } from './ProfileActivityCard';
import type { MockProfile } from '@/data/mockProfiles';

// Figma design tokens (node 3637:4767)
const NAME = '#1B1B18';
const META = '#868579';
const CHOCOLATE = '#2B2A27';
const BODY = '#363530';
const DIVIDER = '#CFCEC9';
const TESTIMONIAL_BG = '#F1F3F6';
const TESTIMONIAL_BORDER = '#9E9D94';
const LINK = '#3572C7';
const SUCCESS = '#2A7E3B';
const BORDER = '#CCD0D7';

interface ProfileViewProps {
  profile: MockProfile;
  /** When true the Follow button is hidden (you can't follow yourself). */
  isOwnProfile?: boolean;
}

/**
 * Shared scrollable profile UI — used by both the bottom-nav profile tab
 * (own profile) and the /user/[id] route (other artists). Matches the Figma
 * "Profile" frame: hero, about, activity, experience, testimonials, images.
 */
export function ProfileView({ profile, isOwnProfile = false }: ProfileViewProps) {
  const [following, setFollowing] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero ─────────────────────────────────────────── */}
      <View style={styles.hero}>
        <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />

        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile.displayName}</Text>
          {profile.verified && (
            <MaterialCommunityIcons name="check-decagram" size={18} color={SUCCESS} />
          )}
        </View>

        <Text style={styles.metaText}>{profile.role}</Text>
        <Text style={styles.metaText}>{profile.location}</Text>

        <TouchableOpacity
          style={styles.websiteRow}
          onPress={() => Linking.openURL(`https://${profile.website}`)}
          activeOpacity={0.7}
        >
          <Ionicons name="link-outline" size={13} color={LINK} />
          <Text style={styles.website}>{profile.website}</Text>
        </TouchableOpacity>

        {/* Stats */}
        <View style={styles.stats}>
          <Stat label="Followers" value={profile.followersCount} />
          <View style={styles.statDivider} />
          <Stat label="Circles" value={profile.circlesCount} />
          <View style={styles.statDivider} />
          <Stat label="Activities" value={profile.activitiesCount} />
        </View>

        {!isOwnProfile && (
          <TouchableOpacity
            style={[styles.followButton, following && styles.followButtonActive]}
            onPress={() => {
              setFollowing((v) => !v);
              console.log('[Profile] toggle follow', profile.id);
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.followText, following && styles.followTextActive]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── About ────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionHeader title="About" />
        <Text style={styles.bodyText} numberOfLines={aboutExpanded ? undefined : 5}>
          {profile.about}
        </Text>
        <TouchableOpacity onPress={() => setAboutExpanded((v) => !v)} activeOpacity={0.7}>
          <Text style={styles.readMore}>
            {aboutExpanded ? 'Read less' : 'Read more >'}
          </Text>
        </TouchableOpacity>
      </View>

      <Divider />

      {/* ── Activity ─────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionHeader title="Activity" />
        <View style={styles.activityList}>
          {profile.activities.map((activity) => (
            <ProfileActivityCard key={activity.id} activity={activity} />
          ))}
        </View>
      </View>

      <Divider />

      {/* ── Experience ───────────────────────────────────── */}
      <View style={styles.section}>
        <SectionHeader title="Experience" />
        <View style={styles.experienceList}>
          {profile.experience.map((item) => (
            <View key={item.id} style={styles.experienceItem}>
              <Text style={styles.experienceTitle}>{item.title}</Text>
              <Text style={styles.bodyText}>{item.description}</Text>
            </View>
          ))}
        </View>
      </View>

      <Divider />

      {/* ── Testimonials ─────────────────────────────────── */}
      <View style={styles.section}>
        <SectionHeader
          title="Testimonials"
          action={
            <TouchableOpacity
              onPress={() => console.log('[Profile] add testimonial')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="add-circle-outline" size={26} color={CHOCOLATE} />
            </TouchableOpacity>
          }
        />
        <View style={styles.testimonialList}>
          {profile.testimonials.map((item) => (
            <View key={item.id} style={styles.testimonialCard}>
              <Text style={styles.testimonialAuthor}>{item.author}</Text>
              <Text style={styles.testimonialQuote}>{`“${item.quote}”`}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Images ───────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionHeader
          title="Images"
          action={
            <TouchableOpacity
              onPress={() => console.log('[Profile] view all images')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-forward" size={22} color={CHOCOLATE} />
            </TouchableOpacity>
          }
        />
        {profile.images[0] && (
          <Image source={{ uri: profile.images[0] }} style={styles.image} resizeMode="cover" />
        )}
      </View>
    </ScrollView>
  );
}

/* ── Small building blocks ──────────────────────────────── */

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value.toLocaleString('en-US')}</Text>
    </View>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.white },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
    gap: spacing.base,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.surface,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    color: NAME,
  },
  metaText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    fontWeight: typography.fontWeight.medium,
    color: META,
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  websiteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: -spacing.sm,
  },
  website: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    fontWeight: typography.fontWeight.medium,
    color: LINK,
  },

  // Stats
  stats: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  stat: {
    alignItems: 'center',
    gap: 5,
    minWidth: 60,
  },
  statLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    fontWeight: typography.fontWeight.medium,
    color: META,
  },
  statValue: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 17,
    fontWeight: typography.fontWeight.semibold,
    color: CHOCOLATE,
  },
  statDivider: {
    width: 1,
    height: 38,
    backgroundColor: DIVIDER,
  },

  // Follow button
  followButton: {
    width: '100%',
    height: 48,
    borderRadius: 30,
    backgroundColor: CHOCOLATE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  followButtonActive: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  followText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 17,
    fontWeight: typography.fontWeight.medium,
    color: colors.white,
  },
  followTextActive: {
    color: CHOCOLATE,
  },

  // Sections
  section: {
    paddingVertical: spacing.base,
    gap: spacing.base,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 17,
    fontWeight: typography.fontWeight.semibold,
    color: CHOCOLATE,
  },
  divider: {
    height: 1,
    backgroundColor: DIVIDER,
  },

  bodyText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: BODY,
    lineHeight: 20,
  },
  readMore: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 12,
    fontWeight: typography.fontWeight.bold,
    color: CHOCOLATE,
  },

  // Activity
  activityList: {
    gap: spacing.base,
  },

  // Experience
  experienceList: {
    gap: spacing.md,
  },
  experienceItem: {
    gap: spacing.sm,
  },
  experienceTitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.bold,
    color: BODY,
  },

  // Testimonials
  testimonialList: {
    gap: spacing.md,
  },
  testimonialCard: {
    backgroundColor: TESTIMONIAL_BG,
    borderRadius: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: TESTIMONIAL_BORDER,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  testimonialAuthor: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    fontWeight: typography.fontWeight.bold,
    color: BODY,
  },
  testimonialQuote: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: BODY,
    lineHeight: 20,
  },

  // Images
  image: {
    width: '100%',
    height: 238,
    borderRadius: 7,
    backgroundColor: colors.surface,
  },
});
