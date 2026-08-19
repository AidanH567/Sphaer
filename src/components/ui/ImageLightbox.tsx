/**
 * Fullscreen image viewer — tap an image, see it big, swipe between them.
 *
 * Serves two of Lara's reports with one component:
 *   c02664cd  "on the personal profile page there is no way to preview a
 *              users pictures … press on a image it makes it full screen and
 *              then you can swipe to browse a users photos"
 *   e0d339c6  "the screenshot that they uploaded can be previewed in full
 *              screen when pressed on. And if edits like drawing a circle …
 *              those should also appear"
 *
 * ── Why one component and not two ───────────────────────────────────────────
 * They are the same interaction on different data. The bug-report case is the
 * profile case with a single item and no paging, which falls out of the same
 * code rather than needing its own. The second report's "edits should also
 * appear" needs nothing special here: annotations are burned into the stored
 * PNG at capture time, so showing the stored image IS showing the edits. That
 * is worth stating, because the obvious reading — that this component has to
 * re-render strokes — would be a day of work solving a problem that does not
 * exist.
 *
 * ── contentFit is `contain`, never `cover` ──────────────────────────────────
 * The grid tiles crop to a square. A viewer that also cropped would show a
 * bigger version of the same crop, which answers none of "let me see the
 * picture". `contain` is the whole point of the feature.
 *
 * ── Paging without a gesture library ────────────────────────────────────────
 * A horizontal paging ScrollView, not PanResponder and not
 * react-native-gesture-handler. Paging is the one gesture this needs, RN gives
 * it for free on all three platforms, and it behaves correctly in mobile
 * Safari — which is where Lara actually reported this from (her screenshot
 * carries the Safari toolbar). A gesture library would add a dependency and a
 * web edge case for a swipe the platform already implements.
 *
 * Pinch-to-zoom is deliberately NOT here. It needs a real gesture dependency
 * and neither report asked for it; `contain` on a full screen is already the
 * whole image. Add it when someone asks.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

export interface ImageLightboxProps {
  /** Every image in the set, in display order. */
  images: readonly string[];
  /** Which one to open on. Out-of-range is clamped, never a blank screen. */
  startIndex?: number;
  visible: boolean;
  onClose: () => void;
  /** Optional caption under the counter — used by the bug-report screen. */
  label?: string;
}

export function ImageLightbox({
  images,
  startIndex = 0,
  visible,
  onClose,
  label,
}: ImageLightboxProps) {
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  // Clamped, because `startIndex` comes from a caller's list index and an
  // empty or shorter list would otherwise scroll to a page that is not there
  // and show black — which reads exactly like the bug this fixes.
  const safeStart = Math.min(Math.max(0, Math.trunc(startIndex)), Math.max(0, images.length - 1));
  const [index, setIndex] = useState(safeStart);

  // Re-seek whenever it is (re)opened on a different tile. Without this the
  // viewer reopens wherever the last swipe left it, so tapping the third photo
  // shows the first.
  useEffect(() => {
    if (!visible) return;
    setIndex(safeStart);
    // The ScrollView has to exist and be laid out before it can be scrolled;
    // a frame's delay is the cheapest reliable way to get after layout.
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: safeStart * width, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [visible, safeStart, width]);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex(Math.min(Math.max(0, next), Math.max(0, images.length - 1)));
    },
    [width, images.length]
  );

  if (!visible || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      // Android's hardware back closes it via onRequestClose; iOS and web use
      // the button. Both paths land on the same handler on purpose.
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          style={styles.pager}
          testID="lightbox-pager"
        >
          {images.map((uri, i) => (
            <View key={`${uri}-${i}`} style={{ width, height }}>
              <Image
                source={{ uri }}
                style={styles.image}
                contentFit="contain"
                accessibilityLabel={
                  images.length > 1 ? `Image ${i + 1} of ${images.length}` : 'Image'
                }
              />
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity
          onPress={onClose}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Close image"
          testID="lightbox-close"
          // A generous target: this is the only way out on iOS and web, and a
          // 24px icon is not a 24px button.
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {(images.length > 1 || label) && (
          <View style={styles.footer} pointerEvents="none">
            {images.length > 1 && (
              <Text style={styles.counter} testID="lightbox-counter">
                {index + 1} / {images.length}
              </Text>
            )}
            {!!label && <Text style={styles.label}>{label}</Text>}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Black, not the theme background: a photo viewer wants the surround to
  // disappear, and every palette in the app is light.
  backdrop: { flex: 1, backgroundColor: '#000000' },
  pager: { flex: 1 },
  image: { width: '100%', height: '100%' },
  close: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  footer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  counter: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  label: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 6, paddingHorizontal: 24 },
});
