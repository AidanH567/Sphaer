import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '@/constants/theme';

/**
 * Reusable shell for legal documents (Privacy Policy, Terms of Service).
 *
 * Renders a topbar with a back chevron + the doc title, then a scrollable
 * body of structured sections. Each section is a {heading, body} pair —
 * keeps the legal copy readable on mobile without rolling our own
 * markdown renderer.
 *
 * Pages that mount this aren't gated on auth — App Store reviewers must
 * be able to read both docs without a session.
 */

export interface LegalSection {
  heading: string;
  /** Paragraph string or array of paragraphs / bullet lists. */
  body: string | (string | { bullets: string[] })[];
}

interface LegalScreenProps {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

export function LegalScreen({ title, lastUpdated, intro, sections }: LegalScreenProps) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.navButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>

        <Text style={styles.intro}>{intro}</Text>

        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {renderBody(section.body)}
          </View>
        ))}

        <Text style={styles.footer}>
          Questions or concerns? Email us at{' '}
          <Text style={styles.email}>privacy@sphaer.app</Text>.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function renderBody(body: LegalSection['body']) {
  if (typeof body === 'string') {
    return <Text style={styles.body}>{body}</Text>;
  }
  return body.map((block, i) => {
    if (typeof block === 'string') {
      return (
        <Text key={i} style={styles.body}>
          {block}
        </Text>
      );
    }
    return (
      <View key={i} style={styles.bullets}>
        {block.bullets.map((bullet, j) => (
          <View key={j} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}
      </View>
    );
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing['4xl'],
  },

  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 28,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  lastUpdated: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  intro: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    lineHeight: 22,
    color: colors.text.primary,
    marginBottom: spacing.xl,
  },

  section: {
    marginBottom: spacing.xl,
  },
  heading: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    lineHeight: 22,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  bullets: {
    marginVertical: spacing.xs,
    gap: spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    paddingLeft: spacing.sm,
  },
  bulletDot: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    width: 16,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    lineHeight: 22,
    color: colors.text.primary,
  },

  footer: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.lg,
    fontStyle: 'italic',
  },
  email: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
});
