import { Stack } from 'expo-router';
import { motion } from '@/constants/theme';

/**
 * Stack layout for the feed group (index / map / mural).
 *
 * Mural-specific config: shrink the iOS back-swipe response area to 20px on
 * the left edge so the Reanimated pan canvas owns the rest of the screen
 * (the "left-edge deadzone" decided during design). Without this, dragging
 * leftward starting near the left edge would be interpreted by React
 * Navigation as a back-swipe and steal the gesture from the canvas.
 *
 * The other screens keep the default full-width back-swipe.
 */
export default function FeedLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: motion.duration.standard,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="map" />
      <Stack.Screen
        name="mural"
        options={{
          gestureResponseDistance: { start: 20 },
        }}
      />
    </Stack>
  );
}
