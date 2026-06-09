import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { MotiView } from 'moti';

interface SkeletonBlockProps {
  width: number | `${number}%`;
  height: number;
  /** Border radius. Defaults to 4. Use the same number as the real element. */
  radius?: number;
  /**
   * Stagger this block's pulse against siblings — keeps grids feeling alive
   * rather than every block flashing in lockstep. Pass the item's index.
   */
  delay?: number;
  /** Override the base shade (e.g. for dark backgrounds). */
  tint?: string;
  /** Compose with the parent layout — margin, alignment, etc. */
  style?: ViewStyle;
}

/**
 * Single shimmer block — the building block for every screen-level skeleton.
 *
 * Reuses the Moti opacity-pulse pattern from `app/(tabs)/feed/mural.tsx`'s
 * SkeletonWall, so the wall, feed-card, profile, and circle skeletons all
 * share one cadence. Pulse runs from opacity 0.55 → 1 over 900ms, repeating
 * forever in both directions.
 *
 * Pass `delay` to stagger neighbours: a grid of 6 cards looks alive when each
 * pulses ~120ms offset from the previous, dead when they all flash together.
 */
export function SkeletonBlock({
  width,
  height,
  radius = 4,
  delay = 0,
  tint = '#E7E2D5',
  style,
}: SkeletonBlockProps) {
  return (
    <MotiView
      from={{ opacity: 0.55 }}
      animate={{ opacity: 1 }}
      transition={{
        type: 'timing',
        duration: 900,
        loop: true,
        repeatReverse: true,
        delay: delay * 120,
      }}
      style={[
        styles.block,
        { width, height, borderRadius: radius, backgroundColor: tint },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    // Hint at content via shape; the pulse does the rest.
  },
});
