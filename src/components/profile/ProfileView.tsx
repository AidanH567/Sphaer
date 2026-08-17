import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import type { RefreshControlProps } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography, spacing } from '@/constants/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import type { MockProfile } from '@/data/mockProfiles';

// Figma design tokens (node 3637:4767)
const NAME = colors.neutral.ink;
const META = '#868579';
const CHOCOLATE = colors.neutral.chocolate;
const BODY = colors.neutral.body;
const DIVIDER = colors.neutral.divider;
const TESTIMONIAL_BG = colors.appleMail; // matches Feed bg, already a Figma token
const TESTIMONIAL_BORDER = colors.neutral.neutral400;
const LINK = '#3572C7';
// Figma verified-badge green (frame 3637:4767) — no success/green token in
// src/constants/theme.ts yet; promote this there if a second consumer appears.
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
   * is provided; otherwise it renders as plain text.
   *
   * There is deliberately no `onActivitiesPress`. The Activities number is
   * social proof like the other three, but its CONTENT now lives in the
   * inline tab panel below — so it reads as a count and nothing more. That
   * removed one of the seven overlapping entry points Lara flagged.
   */
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onCirclesPress?: () => void;
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
   * Shares this profile. Sits beside Edit Profile on your own profile, so the
   * action row has two peers rather than one lonely full-width button.
   */
  onSharePress?: () => void;
  /**
   * The activity tab strip + inline list (ProfileActivityPanel), injected by
   * the screen so this shared component stays free of data fetching. Rendered
   * directly under the identity block — the "start of content" that has to be
   * visible without scrolling.
   */
  activityPanel?: React.ReactNode;
  /**
   * Trailing slot rendered after the Images section. Used to inject the
   * "Available for work" placeholder bar on the own-profile tab without
   * coupling that placeholder to this shared component.
   */
  trailingSlot?: React.ReactNode;
  /**
   * Optional RefreshControl forwarded to the internal ScrollView so the
   * /user/[id] screen can add pull-to-refresh without owning the scroll
   * container. Left undefined by the own-profile tab — no behaviour change
   * there.
   */
  refreshControl?: React.ReactElement<RefreshControlProps>;
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
  onSharePress,
  activityPanel,
  isFollowing,
  onToggleFollow,
  followBusy,
  trailingSlot,
  refreshControl,
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
  const hasExperience = profile.experience.length > 0;
  const hasImages = profile.images.length > 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {/* ── Identity block ───────────────────────────────────
          Instagram's own-profile shape: avatar and stats share ONE row, then
          name / bio / actions stack left-aligned beneath. The old layout
          centred everything in a tall column, which pushed the stats — and
          every route into the user's own content — below the fold. */}
      <View style={styles.hero}>
        <View style={styles.identityRow}>
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
          <View style={styles.stats}>
            <Stat label="Followers" value={profile.followersCount} onPress={onFollowersPress} />
            <Stat label="Following" value={profile.followingCount} onPress={onFollowingPress} />
            <Stat label="Circles" value={profile.circlesCount} onPress={onCirclesPress} />
            {/* Not tappable — the activities themselves are in the tab panel
                below, so this is a number, not a door. */}
            <Stat label="Activities" value={profile.activitiesCount} />
          </View>
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile.displayName}</Text>
          {/* SealCheck-style verified badge (Profile v2 #1). Real profiles
              get `verified` through adaptProfileToDisplay → isVerified();
              the flag is only ever true once migration 20260612060000 is
              applied and the team has vetted the artist. */}
          {profile.verified && (
            <MaterialCommunityIcons
              name="check-decagram"
              size={18}
              color={SUCCESS}
              accessible
              accessibilityLabel="Verified artist"
            />
          )}
        </View>

        {!!profile.role && <Text style={styles.metaText}>{profile.role}</Text>}
        {!!profile.location && <Text style={styles.metaText}>{profile.location}</Text>}

        {/* Bio sits in the identity block now (Instagram again) rather than in
            its own "About" section further down — it is who you are, and it
            costs two lines. */}
        {hasAbout && (
          <>
            <Text style={styles.bioText} numberOfLines={aboutExpanded ? undefined : 2}>
              {profile.about}
            </Text>
            {profile.about.length > 120 && (
              <TouchableOpacity
                onPress={() => setAboutExpanded((v) => !v)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={aboutExpanded ? 'Read less' : 'Read more'}
              >
                <Text style={styles.readMore}>{aboutExpanded ? 'less' : 'more'}</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {!!profile.website && (
          <TouchableOpacity
            style={styles.websiteRow}
            onPress={() => Linking.openURL(buildSocialUrl(profile.website, 'https://'))}
            activeOpacity={0.7}
            accessibilityRole="link"
          >
            <Ionicons name="link-outline" size={13} color={LINK} />
            <Text style={styles.website}>{profile.website}</Text>
          </TouchableOpacity>
        )}
        {!!profile.instagram && (
          <TouchableOpacity
            style={styles.websiteRow}
            onPress={() =>
              Linking.openURL(buildSocialUrl(profile.instagram!, 'https://instagram.com/'))
            }
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel="Instagram profile"
          >
            <Ionicons name="logo-instagram" size={13} color={LINK} />
            <Text style={styles.website}>{profile.instagram}</Text>
          </TouchableOpacity>
        )}
        {!!profile.linkedin && (
          <TouchableOpacity
            style={styles.websiteRow}
            onPress={() =>
              Linking.openURL(buildSocialUrl(profile.linkedin!, 'https://linkedin.com/in/'))
            }
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel="LinkedIn profile"
          >
            <Ionicons name="logo-linkedin" size={13} color={LINK} />
            <Text style={styles.website}>{profile.linkedin}</Text>
          </TouchableOpacity>
        )}

        {isOwnProfile ? (
          // Edit + Share, side by side — the two peers Instagram puts here.
          // Saved and Tickets used to live in this row as buttons; they are
          // tabs now, so the row is down to genuine profile-level actions.
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.followButton, styles.actionButton, styles.editButton]}
              onPress={onEditPress}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Ionicons name="pencil-outline" size={16} color={CHOCOLATE} />
              <Text style={[styles.followText, styles.editText]}>Edit profile</Text>
            </TouchableOpacity>
            {onSharePress && (
              <TouchableOpacity
                style={[styles.followButton, styles.actionButton, styles.editButton]}
                onPress={onSharePress}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Share profile"
              >
                <Ionicons name="share-outline" size={16} color={CHOCOLATE} />
                <Text style={[styles.followText, styles.editText]}>Share profile</Text>
              </TouchableOpacity>
            )}
          </View>
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
              accessibilityRole="button"
              accessibilityState={{ selected: following }}
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
                accessibilityRole="button"
              >
                <Ionicons name="chatbubble-outline" size={16} color={CHOCOLATE} />
                <Text style={[styles.followText, styles.editText]}>Message</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* ── Prompt to write a bio (own profile, nothing written) ──
          The bio itself renders up in the identity block; this is the only
          case that still needs its own row, because there is nothing to show
          up there and the user should be nudged to fix that. */}
      {!hasAbout && isOwnProfile && (
        <View style={styles.bioPrompt}>
          <EmptyState
            body="Tell people about your work — tap Edit profile to add a bio."
            onPress={onEditPress}
          />
        </View>
      )}

      <Divider />

      {/* ── Activities: tab strip + inline list ──────────────
          This replaced the Saved / Activities / Tickets buttons and the two
          bottom sheets behind them. Injected by the screen (see
          ProfileActivityPanel) so this component does no fetching. */}
      {activityPanel}

      {activityPanel ? <Divider /> : null}

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
            <EmptyState
              body="Add roles, residencies, and projects from Edit Profile."
              onPress={onEditPress}
            />
          </View>
          <Divider />
        </>
      ) : (
        <>
          <View style={styles.section}>
            <SectionHeader title="Experience" />
            <EmptyState
              body={`${profile.displayName} hasn't added any experience yet.`}
            />
          </View>
          <Divider />
        </>
      )}

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
        ) : isOwnProfile ? (
          <EmptyState body="No testimonials yet — these arrive as people you've worked with leave them." />
        ) : (
          <EmptyState body={`${profile.displayName} hasn't received any testimonials yet.`} />
        )}
      </View>

      {/* ── Images ───────────────────────────────────────── */}
      {hasImages ? (
        <View style={styles.section}>
          <SectionHeader title="Images" />
          <View style={styles.imageGrid}>
            {profile.images.slice(0, 6).map((src, i) => (
              <Image
                key={`${src}-${i}`}
                source={{ uri: src }}
                style={styles.imageTile}
                contentFit="cover"
              />
            ))}
          </View>
        </View>
      ) : isOwnProfile ? (
        <View style={styles.section}>
          <SectionHeader title="Images" />
          <EmptyState
            body="Show your work — add photos from Edit Profile."
            onPress={onEditPress}
            centered
          />
        </View>
      ) : (
        <View style={styles.section}>
          <SectionHeader title="Images" />
          <EmptyState
            body={`${profile.displayName} hasn't uploaded any photos yet.`}
            centered
          />
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
  // Number first, label under it — the value is what the eye scans for, and
  // it keeps all four stats optically aligned regardless of label length.
  const body = (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value.toLocaleString('en-US')}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
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

// Build a tappable URL from a social value that may be a full URL or a bare
// handle (e.g. "@studio" → instagram.com/studio). Real URLs pass through.
function buildSocialUrl(value: string, base: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return base + v.replace(/^@/, '');
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.white },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },

  // Identity block — left-aligned column; the avatar + stats share one row.
  hero: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  avatar: {
    // 72 rather than the old 90: the avatar now shares its row with four
    // stats, and 90 crowded them at 390px.
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bioText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: BODY,
    lineHeight: 19,
  },
  bioPrompt: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.base,
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
    // Left-aligned now, and the negative top margin is gone: the identity
    // block uses a real `gap`, so pulling rows upward is no longer needed.
    marginTop: -spacing.xs,
  },
  websiteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  website: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 13,
    fontWeight: typography.fontWeight.medium,
    color: LINK,
  },

  // Stats — share the avatar's row, spread across the remaining width.
  stats: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 11,
    fontWeight: typography.fontWeight.medium,
    color: META,
  },
  // Value above label, Instagram-style — the number is what you scan for.
  statValue: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 17,
    fontWeight: typography.fontWeight.bold,
    color: CHOCOLATE,
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
