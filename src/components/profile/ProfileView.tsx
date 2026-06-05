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
const NAME = colors.neutral.ink;
const META = '#868579';
const CHOCOLATE = colors.neutral.chocolate;
const BODY = '#363530';
const DIVIDER = '#CFCEC9';
const TESTIMONIAL_BG = '#F1F3F6';
const TESTIMONIAL_BORDER = colors.neutral.neutral400;
const LINK = '#3572C7';
const SUCCESS = '#2A7E3B';
const BORDER = '#CCD0D7';

interface ProfileViewProps {
  profile: MockProfile;
  /** When true the Follow button is replaced by an Edit Profile button. */
  isOwnProfile?: boolean;
  /** Fires when the user taps Edit Profile (only shown when isOwnProfile). */
  onEditPress?: () => void;
  /**
   * Fires when the user taps Message (only rendered when not isOwnProfile
   * and a handler is provided). The handler is responsible for navigating
   * to the chat screen.
   */
  onMessagePress?: () => void;
  /** Tappable stat callbacks. Each stat becomes pressable when its handler
   * is provided; otherwise it renders as plain text. */
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onCirclesPress?: () => void;
  onActivitiesPress?: () => void;
  /**
   * Real follow state for non-own profiles. When provided alongside
   * onToggleFollow, the Follow button reflects + persists this value
   * instead of the legacy local-only toggle. Both must be provided for
   * the persistent path to activate.
   */
  isFollowing?: boolean;
  /** Fires when the user taps Follow / Following. Caller persists. */
  onToggleFollow?: () => void;
  /** Disables the Follow button (in-flight network call). */
  followBusy?: boolean;
  /**
   * Opens the saved events sheet. Rendered as a dedicated button below the
   * stats row, above Edit Profile — but only when isOwnProfile is true and
   * a handler is provided. Other users never see this button.
   */
  onSavedPress?: () => void;
  /**
   * Opens the tickets sheet — events the user has registered for. Same
   * own-profile-only treatment as onSavedPress; sits beside or near the
   * Saved button.
   */
  onTicketsPress?: () => void;
  /**
   * Trailing slot rendered after the Images section. Used to inject the
   * "Available for work" placeholder bar on the own-profile tab without
   * coupling that placeholder to this shared component.
   */
  trailingSlot?: React.ReactNode;
}

/**
 * Shared scrollable profile UI — used by both the bottom-nav profile tab
 * (own profile) and the /user/[id] route (other artists). Matches the Figma
 * "Profile" frame: hero, about, activity, experience, testimonials, images.
 */
export function ProfileView({
  profile,
  isOwnProfile = false,
  onEditPress,
  onMessagePress,
  onFollowersPress,
  onFollowingPress,
  onCirclesPress,
  onActivitiesPress,
  onSavedPress,
  onTicketsPress,
  isFollowing,
  onToggleFollow,
  followBusy,
  trailingSlot,
}: ProfileViewProps) {
  // Legacy local-only toggle. Only used when the caller didn't pass real
  // isFollowing + onToggleFollow props (e.g. some embedded preview).
  const [localFollowing, setLocalFollowing] = useState(false);
  const persistent = typeof isFollowing === 'boolean' && typeof onToggleFollow === 'function';
  const following = persistent ? (isFollowing as boolean) : localFollowing;
  const [aboutExpanded, setAboutExpanded] = useState(false);

  // Empty-state helpers — for a real, just-signed-up user most arrays will be
  // empty. We hide whole sections when there's nothing to render rather than
  // leaving lonely section headers floating in space.
  const hasAbout = Boolean(profile.about && profile.about.trim().length > 0);
  const hasActivities = profile.activities.length > 0;
  const hasExperience = profile.experience.length > 0;
  const hasImages = profile.images.length > 0;

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
          <Stat label="Followers" value={profile.followersCount} onPress={onFollowersPress} />
          <View style={styles.statDivider} />
          <Stat label="Following" value={profile.followingCount} onPress={onFollowingPress} />
          <View style={styles.statDivider} />
          <Stat label="Circles" value={profile.circlesCount} onPress={onCirclesPress} />
          <View style={styles.statDivider} />
          <Stat label="Activities" value={profile.activitiesCount} onPress={onActivitiesPress} />
        </View>

        {isOwnProfile ? (
          <>
            {(onSavedPress || onTicketsPress) && (
              <View style={styles.ownActionsRow}>
                {onSavedPress && (
                  <TouchableOpacity
                    style={[styles.followButton, styles.savedButton, styles.ownActionItem]}
                    onPress={onSavedPress}
                    activeOpacity={0.85}
                    accessibilityLabel="View saved activities"
                  >
                    <Ionicons name="bookmark-outline" size={16} color={CHOCOLATE} />
                    <Text style={[styles.followText, styles.editText]}>Saved</Text>
                  </TouchableOpacity>
                )}
                {onTicketsPress && (
                  <TouchableOpacity
                    style={[styles.followButton, styles.savedButton, styles.ownActionItem]}
                    onPress={onTicketsPress}
                    activeOpacity={0.85}
                    accessibilityLabel="View tickets"
                  >
                    <Ionicons name="ticket-outline" size={16} color={CHOCOLATE} />
                    <Text style={[styles.followText, styles.editText]}>Tickets</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <TouchableOpacity
              style={[styles.followButton, styles.editButton]}
              onPress={onEditPress}
              activeOpacity={0.85}
            >
              <Ionicons name="pencil-outline" size={16} color={CHOCOLATE} />
              <Text style={[styles.followText, styles.editText]}>Edit Profile</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.followButton,
                styles.actionButton,
                following && styles.followButtonActive,
                followBusy && styles.followButtonBusy,
              ]}
              onPress={() => {
                if (persistent) {
                  onToggleFollow?.();
                } else {
                  setLocalFollowing((v) => !v);
                }
              }}
              activeOpacity={0.85}
              disabled={followBusy}
            >
              <Text style={[styles.followText, following && styles.followTextActive]}>
                {following ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
            {onMessagePress && (
              <TouchableOpacity
                style={[styles.followButton, styles.actionButton, styles.messageButton]}
                onPress={onMessagePress}
                activeOpacity={0.85}
              >
                <Ionicons name="chatbubble-outline" size={16} color={CHOCOLATE} />
                <Text style={[styles.followText, styles.editText]}>Message</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* ── About ────────────────────────────────────────── */}
      {hasAbout ? (
        <>
          <View style={styles.section}>
            <SectionHeader title="About" />
            <Text style={styles.bodyText} numberOfLines={aboutExpanded ? undefined : 5}>
              {profile.about}
            </Text>
            {profile.about.length > 200 && (
              <TouchableOpacity onPress={() => setAboutExpanded((v) => !v)} activeOpacity={0.7}>
                <Text style={styles.readMore}>
                  {aboutExpanded ? 'Read less' : 'Read more >'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <Divider />
        </>
      ) : isOwnProfile ? (
        <>
          <View style={styles.section}>
            <SectionHeader title="About" />
            <TouchableOpacity onPress={onEditPress} activeOpacity={0.7}>
              <Text style={styles.emptyHint}>
                Tell people about your work — tap Edit Profile to add an About section.
              </Text>
            </TouchableOpacity>
          </View>
          <Divider />
        </>
      ) : null}

      {/* ── Activity ─────────────────────────────────────── */}
      {hasActivities && (
        <>
          <View style={styles.section}>
            <SectionHeader title="Activity" />
            <View style={styles.activityList}>
              {profile.activities.map((activity) => (
                <ProfileActivityCard key={activity.id} activity={activity} />
              ))}
            </View>
          </View>
          <Divider />
        </>
      )}

      {/* ── Experience ───────────────────────────────────── */}
      {hasExperience ? (
        <>
          <View style={styles.section}>
            <SectionHeader title="Experience" />
            <View style={styles.experienceList}>
              {profile.experience.map((item) => (
                <View key={item.id} style={styles.experienceItem}>
                  <Text style={styles.experienceTitle}>{item.title}</Text>
                  {item.description ? (
                    <Text style={styles.bodyText}>{item.description}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
          <Divider />
        </>
      ) : isOwnProfile ? (
        <>
          <View style={styles.section}>
            <SectionHeader title="Experience" />
            <TouchableOpacity onPress={onEditPress} activeOpacity={0.7}>
              <Text style={styles.emptyHint}>
                Add roles, residencies, and projects from Edit Profile.
              </Text>
            </TouchableOpacity>
          </View>
          <Divider />
        </>
      ) : null}

      {/* ── Testimonials ─────────────────────────────────── */}
      <View style={styles.section}>
        <SectionHeader title="Testimonials" />
        {profile.testimonials.length > 0 ? (
          <View style={styles.testimonialList}>
            {profile.testimonials.map((item) => (
              <View key={item.id} style={styles.testimonialCard}>
                <Text style={styles.testimonialAuthor}>{item.author}</Text>
                <Text style={styles.testimonialQuote}>{`“${item.quote}”`}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyHint}>No testimonials yet</Text>
        )}
      </View>

      {/* ── Images ───────────────────────────────────────── */}
      {hasImages && (
        <View style={styles.section}>
          <SectionHeader title="Images" />
          <View style={styles.imageGrid}>
            {profile.images.slice(0, 6).map((src, i) => (
              <Image
                key={`${src}-${i}`}
                source={{ uri: src }}
                style={styles.imageTile}
                resizeMode="cover"
              />
            ))}
          </View>
        </View>
      )}

      {trailingSlot}
    </ScrollView>
  );
}

/* ── Small building blocks ──────────────────────────────── */

function Stat({
  label,
  value,
  onPress,
}: {
  label: string;
  value: number;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value.toLocaleString('en-US')}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {body}
    </TouchableOpacity>
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
    // Smaller gap (was spacing.lg / 24) so 4 stats + 3 dividers fit
    // comfortably in the content width without crowding.
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  stat: {
    alignItems: 'center',
    gap: 5,
    minWidth: 54,
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

  // Action row (Follow + Message side-by-side on other people's profiles)
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionButton: {
    flex: 1,
    marginTop: 0,
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
  followButtonBusy: { opacity: 0.55 },
  followText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 17,
    fontWeight: typography.fontWeight.medium,
    color: colors.white,
  },
  followTextActive: {
    color: CHOCOLATE,
  },
  editButton: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: BORDER,
    flexDirection: 'row',
    gap: 8,
  },
  // Saved / Tickets row — own-profile only, sits above Edit Profile.
  ownActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    marginTop: spacing.xs,
  },
  ownActionItem: {
    flex: 1,
    marginTop: 0,
  },
  // Saved/Tickets button — secondary (white + border) treatment.
  savedButton: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: BORDER,
    flexDirection: 'row',
    gap: 8,
  },
  // Message button styled like editButton (white bg + border) so it reads
  // as the secondary action next to the primary Follow.
  messageButton: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: BORDER,
    flexDirection: 'row',
    gap: 8,
  },
  editText: {
    color: CHOCOLATE,
  },
  emptyHint: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    color: META,
    fontStyle: 'italic',
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

  // Images — grid of up to 6 thumbnails
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  imageTile: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 7,
    backgroundColor: colors.surface,
  },
});
