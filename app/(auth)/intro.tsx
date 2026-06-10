import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '@/constants/theme';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

const { width } = Dimensions.get('window');

/**
 * First-time-user 3-screen intro. Triggers from the landing screen on
 * first launch (gated by a one-shot AsyncStorage flag), or directly via
 * `/intro`. After completion the flag is set and subsequent launches go
 * straight to the landing screen.
 */

export const INTRO_SEEN_KEY = 'sphaer:has-seen-intro';

interface IntroPage {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

const PAGES: IntroPage[] = [
  {
    icon: 'sparkles-outline',
    title: 'Discover Berlin',
    body: 'A community-first map of what is on right now — events, openings, jams, all in one place. No algorithms, no paid promotion, just what the scene is doing tonight.',
  },
  {
    icon: 'people-circle-outline',
    title: 'Follow artists & circles',
    body: 'Subscribe to the artists, collectives, and venues whose work you care about. Their upcoming activities surface chronologically — never ranked by engagement.',
  },
  {
    icon: 'bookmark-outline',
    title: 'Save & get reminded',
    body: 'Bookmark anything you want to attend. We will remind you before doors open and export your saved list straight to your calendar in one tap.',
  },
];

export default function IntroScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  async function finish() {
    try {
      await AsyncStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch {
      // Storage failures aren't fatal — worst case the user sees the intro
      // again on next launch.
    }
    router.replace('/(auth)');
  }

  function advance() {
    if (page < PAGES.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (page + 1), animated: true });
    } else {
      finish();
    }
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  }

  const isLast = page === PAGES.length - 1;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.skipRow}>
        {!isLast && (
          <TouchableOpacity
            onPress={finish}
            style={styles.skipButton}
            accessibilityLabel="Skip intro"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.pages}
        contentContainerStyle={{ width: width * PAGES.length }}
      >
        {PAGES.map((p) => (
          <View key={p.title} style={styles.page}>
            <View style={styles.iconWrap}>
              <Ionicons name={p.icon} size={56} color={colors.neutral.chocolate} />
            </View>
            <Text style={styles.title}>{p.title}</Text>
            <Text style={styles.body}>{p.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dotRow}>
        {PAGES.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.cta}>
        <TouchableOpacity
          onPress={advance}
          style={styles.button}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Get Started' : 'Next'}
        >
          <Text style={styles.buttonText}>{isLast ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const CHOCOLATE = '#2B2A27';
const META = '#5A5A5A';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  skipRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    height: 40,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: META,
    fontWeight: typography.fontWeight.medium,
  },

  pages: { flex: 1 },
  page: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.lg,
  },
  iconWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: typography.fontWeight.bold,
    color: CHOCOLATE,
    textAlign: 'center',
  },
  body: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    lineHeight: 24,
    color: META,
    textAlign: 'center',
    maxWidth: 320,
  },

  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: CHOCOLATE,
  },

  cta: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  button: {
    height: 52,
    borderRadius: 30,
    backgroundColor: CHOCOLATE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 17,
    fontWeight: typography.fontWeight.medium,
    color: colors.white,
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('auth-intro');
