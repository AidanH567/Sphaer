import React, { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
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
    // NO backgroundColor on the wrapper. RN Web's <Image> renders the
    // picture as a `background-image` on an inner div at z-index: -1.
    // Inside an `position: absolute` parent (which creates a stacking
    // context), that z-index:-1 child renders BEHIND the wrapper's
    // background-color paint — meaning any colour we set here hides the
    // picture on cached / remounted images. The canvas's own black
    // background shows through during the brief load window instead.
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#1A1A1A',
  },
});
