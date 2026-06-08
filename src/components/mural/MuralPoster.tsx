import React, { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { PosterRect } from '@/hooks/useMuralLayout';
import { colors } from '@/constants/theme';

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
 * Uses RN's <Image> with resizeMode="cover". The wrapper carries the
 * fallback background colour (NOT the Image itself) — RN Web renders the
 * actual picture as a backgroundImage on a child div at z-index -1, and
 * putting a backgroundColor on the Image style would paint the placeholder
 * div opaque and hide the picture on cached / remounted images.
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
          resizeMode="cover"
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
    // Fallback colour shown while the picture decodes or if it fails. Sits
    // behind the <Image>, so when the picture arrives it covers this
    // entirely on native, and on web RN's backgroundImage layer paints
    // over it once the source loads.
    backgroundColor: colors.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#1A1A1A',
  },
});
