import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import type { PosterRect } from '@/hooks/useMuralLayout';

const MAP_WIDTH = 100;
const MAP_HEIGHT = 80;
const MAP_PADDING = 4; // inner padding inside the map's outline
const MAP_BG = 'rgba(0, 0, 0, 0.55)';
const MAP_BORDER = 'rgba(255, 255, 255, 0.35)';
const DOT_COLOR = 'rgba(255, 255, 255, 0.55)';
const VIEWPORT_COLOR = 'rgba(255, 255, 255, 0.95)';

interface MuralMinimapProps {
  posters: PosterRect[];
  canvasWidth: number;
  canvasHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
  /** Called with canvas coordinates (in unscaled canvas pixels) when the
   *  user taps somewhere on the minimap. Parent should animate the
   *  viewport to center on that point. */
  onTeleport: (canvasX: number, canvasY: number) => void;
  /** Subtle fade signal — true during active pan/pinch so the map bumps
   *  to full opacity. Idle = 70% opacity. */
  isInteracting: SharedValue<boolean>;
}

/**
 * Mural mini-map: a fixed bottom-right overlay showing the wall's overall
 * shape, poster positions, and the current viewport rectangle. Tapping
 * anywhere on the minimap teleports the viewport to that canvas position.
 *
 * Design notes (locked during grilling):
 *   - 100×80, bottom-right corner with safe-area padding
 *   - Outline + poster dots (no scaled thumbnails — those look like noise
 *     at 6px and add nothing)
 *   - Tap-to-teleport (premium feel, ~10 extra lines)
 *   - Fades 70%→100% during active pan/pinch (`isInteracting`)
 */
export function MuralMinimap({
  posters,
  canvasWidth,
  canvasHeight,
  viewportWidth,
  viewportHeight,
  translateX,
  translateY,
  scale,
  onTeleport,
  isInteracting,
}: MuralMinimapProps) {
  // Map-space scale: how many display pixels in the minimap represent
  // one canvas pixel. We fit the canvas inside the inner padded area and
  // pick the smaller axis so neither dimension overflows.
  const innerW = MAP_WIDTH - MAP_PADDING * 2;
  const innerH = MAP_HEIGHT - MAP_PADDING * 2;
  const mapScale = useMemo(
    () => Math.min(innerW / canvasWidth, innerH / canvasHeight),
    [canvasWidth, canvasHeight, innerW, innerH]
  );

  // Center the canvas-shape inside the minimap (it may not fill both axes).
  const offsetX = MAP_PADDING + (innerW - canvasWidth * mapScale) / 2;
  const offsetY = MAP_PADDING + (innerH - canvasHeight * mapScale) / 2;

  // Tap-to-teleport: read the touch position in minimap coords, convert to
  // canvas coords, hand to the parent.
  function handlePress(e: { nativeEvent: { locationX: number; locationY: number } }) {
    const tapX = e.nativeEvent.locationX - offsetX;
    const tapY = e.nativeEvent.locationY - offsetY;
    if (tapX < 0 || tapY < 0) return;
    const canvasX = tapX / mapScale;
    const canvasY = tapY / mapScale;
    onTeleport(canvasX, canvasY);
  }

  // Container fade. 0.7 idle, 1.0 active.
  const containerStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(isInteracting.value ? 1 : 0.7, { duration: 180 }),
    }),
    [isInteracting]
  );

  // Viewport rectangle position and size. The viewport sees canvas coords
  //   x_canvas ∈ [-translateX / scale, (viewport - translateX) / scale]
  // Scale that range by mapScale and offset to mini-map pixels.
  const viewportStyle = useAnimatedStyle(
    () => {
      const s = scale.value;
      const rectLeft = (-translateX.value / s) * mapScale + offsetX;
      const rectTop = (-translateY.value / s) * mapScale + offsetY;
      const rectW = (viewportWidth / s) * mapScale;
      const rectH = (viewportHeight / s) * mapScale;
      return {
        left: rectLeft,
        top: rectTop,
        width: rectW,
        height: rectH,
      };
    },
    [translateX, translateY, scale, mapScale, offsetX, offsetY, viewportWidth, viewportHeight]
  );

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="box-none">
      <Pressable
        onPress={handlePress}
        style={styles.tapTarget}
        accessibilityRole="button"
        accessibilityLabel="Mural minimap"
        accessibilityHint="Jumps to the tapped spot on the mural"
        // Web only: opt out of focus ring so the mini-map looks clean
        // when tabbed-into via keyboard.
        {...(Platform.OS === 'web' ? { tabIndex: -1 } : {})}
      >
        {/* Background frame with outline */}
        <View style={styles.frame}>
          {/* One small dot per poster at its scaled canvas position */}
          {posters.map((p) => (
            <View
              key={p.event.id}
              pointerEvents="none"
              style={[
                styles.dot,
                {
                  left: offsetX + p.x * mapScale,
                  top: offsetY + p.y * mapScale,
                  width: Math.max(1.5, p.width * mapScale),
                  height: Math.max(1.5, p.height * mapScale),
                },
              ]}
            />
          ))}
          {/* The viewport rectangle, animated via shared values */}
          <Animated.View
            pointerEvents="none"
            style={[styles.viewportRect, viewportStyle]}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    bottom: 80, // clear of the bottom tab nav
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    zIndex: 20,
  },
  tapTarget: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
  },
  frame: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    backgroundColor: MAP_BG,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: MAP_BORDER,
    overflow: 'hidden',
  },
  dot: {
    position: 'absolute',
    backgroundColor: DOT_COLOR,
    borderRadius: 0.5,
  },
  viewportRect: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: VIEWPORT_COLOR,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});

