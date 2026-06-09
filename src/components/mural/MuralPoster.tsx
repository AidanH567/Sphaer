import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import type { PosterRect } from '@/hooks/useMuralLayout';

interface MuralPosterProps {
  rect: PosterRect;
}

/**
 * A single positioned poster on the mural canvas.
 *
 * Dumb component — no gesture handlers. Tap hit-testing happens at the
 * canvas level so that pan/pinch/tap don't fight over the same touch
 * sequence. Positioning is `absolute` driven by the rect from
 * useMuralLayout; the parent canvas applies the global pan/zoom transform.
 *
 * Uses `expo-image` with `contentFit="cover"`. On web, expo-image renders
 * a real <img> rather than the `background-image: z-index -1` trick that
 * tripped us up on RN Web, so the canvas no longer has to fight a stacking
 * context to keep cached / remounted images visible.
 *
 * Memoised on rect identity since the canvas re-renders rarely (layout
 * inputs change less often than the pan/zoom shared values, which never
 * trigger React renders).
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
        />
      ) : (
        <View style={[styles.image, styles.placeholder]} />
      )}
    </View>
  );
}

export const MuralPoster = memo(MuralPosterBase, (prev, next) => {
  const a = prev.rect;
  const b = next.rect;
  return (
    a.event.id === b.event.id &&
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
    // expo-image renders a real <img> on web, so unlike the RN Web era
    // we could now safely set a backgroundColor here as a placeholder
    // tint. Left transparent so the canvas's own black background shows
    // through during the brief load window — the wall reads as one
    // continuous surface rather than a grid of placeholder tiles.
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#1A1A1A',
  },
});
