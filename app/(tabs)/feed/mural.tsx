import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useAppContext } from '@/context/AppContext';
import { FeedHeader } from '@/components/feed/FeedHeader';
import { MuralCanvas } from '@/components/mural/MuralCanvas';
import { useEvents } from '@/hooks/useEvents';
import { useMuralDimensions } from '@/hooks/useMuralDimensions';
import { useMuralLayout } from '@/hooks/useMuralLayout';
import { eventMatchesLocationFilter } from '@/constants/berlinNeighborhoods';
import { colors, spacing, typography } from '@/constants/theme';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

/**
 * Mural — the third view of the feed, alongside list (index.tsx) and map.
 *
 * Visual: a 2D pan-and-pinch canvas of poster thumbnails laid out as
 * horizontal bands. Tap a poster → event detail. Pinch zooms between
 * fit-whole-wall and 2×.
 *
 * Data shape parity with Feed: same useEvents call, same feedFilters
 * applied (categories pre-filter at the service; search + neighbourhood
 * applied client-side here exactly like feed/index.tsx). useFocusEffect
 * refetches so a freshly-created event lands on the wall when the user
 * comes back. Cap MURAL_MAX_EVENTS keeps the wall responsive in the
 * worst case (a re-seeded DB or stress test).
 */

const MURAL_MAX_EVENTS = 200;

export default function MuralScreen() {
  const router = useRouter();
  const { setFeedView, feedFilters, setFeedFilters } = useAppContext();

  const searchText = feedFilters.search ?? '';
  const neighborhood = feedFilters.neighborhood ?? '';

  const { events, isLoading, refetch } = useEvents({
    categories: feedFilters.categories,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Newest-first + same client-side search/neighbourhood filtering as Feed.
  // Mirrors feed/index.tsx so the three views never disagree on what
  // events are visible for a given filter set.
  const visibleEvents = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const hood = neighborhood.toLowerCase();
    const base = [...events].sort(
      (a, b) => +new Date(b.created_at ?? 0) - +new Date(a.created_at ?? 0)
    );
    const filtered = base.filter((e) => {
      if (q.length > 0) {
        const haystack = [
          e.title,
          e.description ?? '',
          e.location_name ?? '',
          e.address ?? '',
          (e.categories ?? []).join(' '),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (hood.length > 0) {
        const structured = eventMatchesLocationFilter(neighborhood, {
          borough: e.borough ?? null,
          neighbourhood: e.neighbourhood ?? null,
        });
        if (structured === true) {
          // pass
        } else if (structured === false) {
          return false;
        } else {
          const locHaystack = `${e.address ?? ''} ${e.location_name ?? ''}`.toLowerCase();
          if (!locHaystack.includes(hood)) return false;
        }
      }
      return true;
    });
    // Safety cap — see MURAL_MAX_EVENTS comment.
    return filtered.slice(0, MURAL_MAX_EVENTS);
  }, [events, searchText, neighborhood]);

  // Pre-fetch poster dimensions for everything we plan to render.
  const posterUrls = useMemo(
    () =>
      visibleEvents
        .map((e) => e.poster_url)
        .filter((u): u is string => !!u),
    [visibleEvents]
  );
  // Embedded dimensions (figma-seed events have these baked in). Lets
  // useMuralDimensions skip the Image.getSize() round-trip — Mural mounts
  // instantly for the demo set instead of waiting 10–15s for 32MB of PNGs
  // to download just so we can read their width/height.
  const presetDimensions = useMemo(() => {
    const map = new Map<string, { width: number; height: number }>();
    for (const e of visibleEvents) {
      // poster_width / poster_height are MockEvent extensions — real
      // EventWithRelations rows from Supabase don't have them yet, so the
      // cast keeps both code paths typesafe.
      const me = e as typeof e & {
        poster_width?: number;
        poster_height?: number;
      };
      if (
        e.poster_url &&
        typeof me.poster_width === 'number' &&
        typeof me.poster_height === 'number'
      ) {
        map.set(e.poster_url, {
          width: me.poster_width,
          height: me.poster_height,
        });
      }
    }
    return map;
  }, [visibleEvents]);
  const { dimensions, ready: dimensionsReady } = useMuralDimensions(
    posterUrls,
    presetDimensions
  );

  // Measure the canvas slot below the header. Dynamic so tablets / future
  // layouts get correct bounds without manual height calc.
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const onViewportLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== viewport.width || height !== viewport.height) {
      setViewport({ width, height });
    }
  };

  const layout = useMuralLayout({
    events: visibleEvents,
    dimensions,
    screenWidth: viewport.width || 1,
    screenHeight: viewport.height || 1,
  });

  function toggleCategory(cat: string) {
    const current = feedFilters.categories ?? [];
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    setFeedFilters({ ...feedFilters, categories: next.length ? next : undefined });
  }

  function setSearch(text: string) {
    setFeedFilters({ ...feedFilters, search: text || undefined });
  }

  function setNeighborhood(n: string | null) {
    setFeedFilters({ ...feedFilters, neighborhood: n ?? undefined });
  }

  const handlePosterTap = useCallback(
    (eventId: string) => {
      router.push(`/event/${eventId}`);
    },
    [router]
  );

  const viewportReady = viewport.width > 0 && viewport.height > 0;
  const showSkeleton = !viewportReady || !dimensionsReady || isLoading;
  const showEmpty =
    !isLoading && dimensionsReady && visibleEvents.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <FeedHeader
          activeView="mural"
          onViewChange={(v) => {
            setFeedView(v);
            if (v === 'list') router.push('/(tabs)/feed');
            else if (v === 'map') router.push('/(tabs)/feed/map');
          }}
          selectedCategories={feedFilters.categories ?? []}
          onToggleCategory={toggleCategory}
          onSearchChange={setSearch}
          selectedNeighborhood={feedFilters.neighborhood ?? null}
          onNeighborhoodChange={setNeighborhood}
        />
      </View>

      <View style={styles.canvasSlot} onLayout={onViewportLayout}>
        {viewportReady && !showSkeleton && !showEmpty && (
          <MuralCanvas
            layout={layout}
            viewportWidth={viewport.width}
            viewportHeight={viewport.height}
            onPosterTap={handlePosterTap}
          />
        )}

        {showSkeleton && viewportReady && (
          <SkeletonWall
            viewportWidth={viewport.width}
            viewportHeight={viewport.height}
          />
        )}

        {showEmpty && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {searchText
                ? `No posters match "${searchText}"`
                : 'No posters on the wall yet'}
            </Text>
          </View>
        )}

        {isLoading && !viewportReady && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.white} />
          </View>
        )}
      </View>
    </View>
  );
}

interface SkeletonWallProps {
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Placeholder wall while poster dimensions are being measured.
 *
 * Renders a few band-shaped grey blocks that pulse subtly via Moti — close
 * enough to the eventual layout that the transition into real posters feels
 * like content arriving on a surface, not a screen swap.
 */
function SkeletonWall({ viewportWidth, viewportHeight }: SkeletonWallProps) {
  const bandHeight = viewportHeight / 2;
  // Three placeholder posters per visible band — narrow / wide / narrow to
  // hint at the varied-width rhythm without claiming specific sizes.
  const posters = [
    { x: 0, w: viewportWidth * 0.3 },
    { x: viewportWidth * 0.3, w: viewportWidth * 0.45 },
    { x: viewportWidth * 0.75, w: viewportWidth * 0.3 },
  ];
  const bands = [0, bandHeight];

  return (
    <View style={styles.skeletonContainer}>
      {bands.map((y) =>
        posters.map((p, i) => (
          <MotiView
            key={`${y}-${i}`}
            from={{ opacity: 0.35 }}
            animate={{ opacity: 0.6 }}
            transition={{
              type: 'timing',
              duration: 900,
              loop: true,
              repeatReverse: true,
              delay: (i + y / bandHeight) * 120,
            }}
            style={[
              styles.skeletonPoster,
              { left: p.x, top: y, width: p.w, height: bandHeight },
            ]}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  // Header is a flex item, not an absolute overlay. The earlier overlay
  // design caused the canvas's top posters to render UNDER the search bar /
  // category chips because canvasSlot's flex:1 extended to y=0. With the
  // header as a flex item, canvasSlot only fills the space *below* it,
  // which is what the user sees as "the mural component fitting inside the
  // screen."
  header: {
    backgroundColor: colors.appleMail,
  },
  // canvasSlot fills the remaining space below the (now flex) header.
  // Small bottom margin so the wall doesn't sit flush against the
  // BottomNav border — gives a "framed" feel instead of "clipped at the
  // edge of the screen."
  canvasSlot: { flex: 1, marginBottom: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  skeletonContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.black,
  },
  skeletonPoster: {
    position: 'absolute',
    backgroundColor: '#2A2A2A',
  },
});

export const ErrorBoundary = makeRouteErrorBoundary('feed-mural');
