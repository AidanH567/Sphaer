import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import type { PosterRect } from '@/hooks/useMuralLayout';
import { colors, motion } from '@/constants/theme';

interface MuralPosterProps {
  rect: PosterRect;
}

/**
 * A single positioned poster on the mural canvas.
 *
 * Dumb component — no gesture handlers. Tap hit-testing happens at the
 * canvas level so that pan/tap don't fight over the same touch sequence.
 * Positioning is `absolute` driven by the rect from useMuralLayout; the
 * parent canvas applies the global pan transform.
 *
 * Uses `expo-image` with `contentFit="cover"`. On web, expo-image renders
 * a real <img> rather than the `background-image: z-index -1` trick that
 * tripped us up on RN Web, so the canvas no longer has to fight a stacking
 * context to keep cached / remounted images visible.
 *
 * The tile carries its own placeholder tint. Without it an unloaded poster
 * was a transparent hole onto a white backdrop, so a wall of 50 posters
 * streaming in over mobile data looked like "lots of blank white screen"
 * until the last one landed. `cachePolicy="memory-disk"` means the second
 * visit to the Mural paints from disk instead of re-downloading, and
 * `recyclingKey` lets expo-image drop the old bitmap immediately when a
 * slot is reused by a different event (filter change / recycled slot).
 *
 * Memoised on rect geometry since the canvas re-renders rarely (pan is
 * driven by shared values, which never trigger React renders).
 */
function MuralPosterBase({ rect }: MuralPosterProps) {
  const { event, x, y, width, height } = rect;
  const hasPoster = !!event.poster_url;

  return (
    <View
      style={[
        styles.poster,
        {
          left: x,
          top: y,
          width,
          height,
        },
      ]}
    >
      {hasPoster ? (
        <Image
          source={{ uri: event.poster_url ?? undefined }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={rect.key}
          transition={motion.duration.swift}
        />
      ) : null}
    </View>
  );
}

export const MuralPoster = memo(MuralPosterBase, (prev, next) => {
  const a = prev.rect;
  const b = next.rect;
  return (
    a.key === b.key &&
    a.event.poster_url === b.event.poster_url &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height
  );
});

const styles = StyleSheet.create({
  poster: {
    position: 'absolute',
    overflow: 'hidden',
    // Placeholder tint — a poster-shaped block of wall, not a white hole.
    // Also what shows for an event with no poster_url at all.
    backgroundColor: colors.neutral.hiddenLines,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
