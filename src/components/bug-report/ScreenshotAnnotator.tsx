/**
 * Circle what's wrong — the drawing surface for report screenshots.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Lara and Rabon are designers, on phones, and they file reports but never see
 * the triage screen. So the picture IS the report. "This padding is wrong" is
 * nearly useless on its own; the same sentence with a circle round the padding
 * is actionable immediately. Converting the first into the second is the
 * entire value of this component (Aidan, 2026-08-18: "he can circle particular
 * things, making it obvious for us what the bug is").
 *
 * ── Deliberately freehand only ───────────────────────────────────────────────
 * A pen, three colours, undo, clear. No arrows, no text labels, no shapes, no
 * pinch-zoom. A circle round the thing answers "where", and the form's own
 * questions already answer "what" — the drawing tools that would add real
 * expressiveness beyond that (text, especially) are a much larger build for a
 * gain nobody has yet asked for. If freehand proves not to be enough, that is
 * a later decision with evidence behind it.
 *
 * ── Undo is not optional ─────────────────────────────────────────────────────
 * A bad stroke on a phone is a certainty, not a risk. Without undo the only
 * recovery is Clear — throw away the good marks with the bad one — and the
 * realistic outcome of that is a reporter giving up and sending nothing, which
 * is precisely the failure this feature exists to fix.
 *
 * ── Two canvases, one renderer ───────────────────────────────────────────────
 * The visible canvas is sized to fit the phone; a second one is parked
 * offscreen at the screenshot's REAL pixel size and is what gets flattened.
 * Both are `AnnotationCanvas` with the same strokes, so the preview cannot
 * promise something the saved image does not contain. The offscreen one is
 * mounted for the whole session rather than created at save time — see
 * IMAGE_READY_GRACE_MS in AnnotationCanvas for why that matters.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  AnnotationCanvas,
  annotationCanvasHostStyle,
  type AnnotationCanvasHandle,
} from '@/components/bug-report/AnnotationCanvas';
import {
  AnnotationError,
  appendPoint,
  dropLastStroke,
  fitContain,
  hasInk,
  toNormalizedPoint,
  type AnnotationStroke,
} from '@/utils/annotation';
import { colors, radius, spacing, typography } from '@/constants/theme';

/**
 * Swatch fills as REGISTERED styles rather than inline objects.
 *
 * Not a preference — `style={{ backgroundColor: someVariable }}` makes
 * NativeWind's babel transform wrap the value in a
 * `require('react-native-reanimated').getUseOfValueInStyleWarning()` guard (it
 * is checking for a shared value used in a plain style). That drags the whole
 * worklets runtime into this component, which then throws "Native part of
 * Worklets doesn't seem to be initialized" under jest and pulls an animation
 * library into a screen that animates nothing. The colours are a closed set of
 * three, so there is no reason for them to be dynamic at all.
 */
const swatchStyles = StyleSheet.create({
  red: { backgroundColor: colors.annotation.red },
  yellow: { backgroundColor: colors.annotation.yellow },
  cyan: { backgroundColor: colors.annotation.cyan },
});

/** The marker colours, in picker order. Red first — it is what people reach
 *  for, and the other two exist for when red is what they are drawing ON. */
export const ANNOTATION_COLORS = [
  { value: colors.annotation.red, label: 'Red', swatch: swatchStyles.red },
  { value: colors.annotation.yellow, label: 'Yellow', swatch: swatchStyles.yellow },
  { value: colors.annotation.cyan, label: 'Blue', swatch: swatchStyles.cyan },
] as const;

export interface AnnotationResult {
  /** Bare base64 PNG of the flattened image — screenshot plus marks. */
  base64: string;
  /** The same bytes as a data: URI, for showing back on the form. */
  dataUri: string;
}

interface Props {
  visible: boolean;
  /** Local URI of the screenshot to annotate. */
  uri: string;
  /** The screenshot's real pixel size — what the flattened output is rendered
   *  at, and what makes the stroke width scale correctly. */
  sourceWidth: number;
  sourceHeight: number;
  onCancel: () => void;
  onSave: (result: AnnotationResult) => void;
}

export function ScreenshotAnnotator({
  visible,
  uri,
  sourceWidth,
  sourceHeight,
  onCancel,
  onSave,
}: Props) {
  const captureRef = useRef<AnnotationCanvasHandle>(null);
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<AnnotationStroke | null>(null);
  const [color, setColor] = useState<string>(ANNOTATION_COLORS[0].value);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The PanResponder closes over state, and RN creates it once. Both the
   * colour and the in-progress stroke are therefore read through refs — a
   * responder capturing the FIRST render's `color` would draw every stroke in
   * red no matter what the user picked, which is the classic version of this
   * bug and is invisible until someone tries the second colour.
   */
  const colorRef = useRef(color);
  colorRef.current = color;
  const activeRef = useRef<AnnotationStroke | null>(null);
  const displayRef = useRef({ width: 0, height: 0 });

  /**
   * The screenshot's displayed rectangle. The touch surface is exactly this —
   * never the container — so a touch always normalises against the pixels the
   * image actually occupies. See `fitContain`.
   */
  const display = useMemo(
    () => fitContain(sourceWidth, sourceHeight, box.width, box.height),
    [sourceWidth, sourceHeight, box.width, box.height]
  );
  displayRef.current = display;

  const onBoxLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox({ width, height });
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Keep the gesture even if a parent ScrollView wants it — a drawing
        // stroke that turns into a scroll halfway through is unusable.
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (event) => {
          const { width, height } = displayRef.current;
          const point = toNormalizedPoint(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
            width,
            height
          );
          const stroke: AnnotationStroke = { color: colorRef.current, points: [point] };
          activeRef.current = stroke;
          setActiveStroke(stroke);
        },

        onPanResponderMove: (event) => {
          const current = activeRef.current;
          if (!current) return;
          const { width, height } = displayRef.current;
          const point = toNormalizedPoint(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
            width,
            height
          );
          const points = appendPoint(current.points, point);
          // `appendPoint` returns the same array when the movement was too
          // small to matter — skipping the setState there is what keeps a slow
          // circle from re-rendering the canvas a few hundred times.
          if (points === current.points) return;
          const next: AnnotationStroke = { ...current, points };
          activeRef.current = next;
          setActiveStroke(next);
        },

        onPanResponderRelease: () => {
          const finished = activeRef.current;
          activeRef.current = null;
          setActiveStroke(null);
          if (finished && finished.points.length > 0) {
            setStrokes((prev) => [...prev, finished]);
          }
        },

        // A terminated gesture (an incoming call, a parent stealing the
        // responder) still commits what was drawn. Discarding it would lose a
        // mark the user watched themselves make.
        onPanResponderTerminate: () => {
          const finished = activeRef.current;
          activeRef.current = null;
          setActiveStroke(null);
          if (finished && finished.points.length > 0) {
            setStrokes((prev) => [...prev, finished]);
          }
        },
      }),
    []
  );

  const reset = useCallback(() => {
    setStrokes([]);
    setActiveStroke(null);
    activeRef.current = null;
    setError(null);
    setIsSaving(false);
  }, []);

  const handleCancel = useCallback(() => {
    reset();
    onCancel();
  }, [reset, onCancel]);

  const handleSave = useCallback(async () => {
    setError(null);
    setIsSaving(true);
    try {
      const canvas = captureRef.current;
      if (!canvas) {
        throw new AnnotationError("The annotation canvas wasn't ready. Please try again.");
      }
      const base64 = await canvas.capture();
      const result = { base64, dataUri: `data:image/png;base64,${base64}` };
      reset();
      onSave(result);
    } catch (err) {
      setIsSaving(false);
      setError(
        err instanceof AnnotationError
          ? err.message
          : "Couldn't save your marks. Please try again."
      );
    }
  }, [reset, onSave]);

  const canUndo = strokes.length > 0;
  const canSave = hasInk(strokes) && !isSaving;
  const hasSource = sourceWidth > 0 && sourceHeight > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleCancel}
      // Full-screen: the drawing target should be as large as the device can
      // make it. Circling a 4pt padding error on a thumbnail is not possible.
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleCancel}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel annotation"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Circle what&apos;s wrong</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!canSave}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Save annotation"
            accessibilityState={{ disabled: !canSave }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.text.primary} />
            ) : (
              <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.canvasArea} onLayout={onBoxLayout}>
          {hasSource && display.width > 0 && (
            <View
              testID="annotation-surface"
              style={{ width: display.width, height: display.height }}
              {...panResponder.panHandlers}
            >
              {/* The Svg takes no touches (`pointerEvents="none"` inside
                  AnnotationCanvas) so the responder View is always the touch
                  target. Otherwise a drawn Path can become the target mid-
                  stroke and `locationX` starts arriving relative to THAT
                  path's bounds — the line jumps to a different part of the
                  image the moment it crosses an earlier mark. */}
              <AnnotationCanvas
                uri={uri}
                width={display.width}
                height={display.height}
                strokes={strokes}
                activeStroke={activeStroke}
              />
            </View>
          )}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.badge.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.toolbar}>
          <View style={styles.colorRow}>
            {ANNOTATION_COLORS.map((option) => {
              const selected = color === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setColor(option.value)}
                  style={[styles.colorDot, option.swatch, selected && styles.colorDotSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label} pen`}
                  accessibilityState={{ selected }}
                />
              );
            })}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={() => setStrokes(dropLastStroke)}
              disabled={!canUndo}
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel="Undo last mark"
              accessibilityState={{ disabled: !canUndo }}
            >
              <Ionicons
                name="arrow-undo-outline"
                size={22}
                color={canUndo ? colors.text.primary : colors.text.tertiary}
              />
              <Text style={[styles.actionText, !canUndo && styles.actionTextDisabled]}>
                Undo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setStrokes([])}
              disabled={!canUndo}
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel="Clear all marks"
              accessibilityState={{ disabled: !canUndo }}
            >
              <Ionicons
                name="trash-outline"
                size={22}
                color={canUndo ? colors.text.primary : colors.text.tertiary}
              />
              <Text style={[styles.actionText, !canUndo && styles.actionTextDisabled]}>
                Clear
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* The capture canvas: the screenshot's REAL size, parked offscreen,
            mounted for the whole session. This is what gets flattened. */}
        {hasSource && (
          <View style={annotationCanvasHostStyle} pointerEvents="none">
            <AnnotationCanvas
              ref={captureRef}
              uri={uri}
              width={sourceWidth}
              height={sourceHeight}
              strokes={strokes}
            />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Dark ground: a screenshot is usually a light app screen, and a white
  // surround makes its edges impossible to find. It also keeps the eye on the
  // image rather than the chrome.
  container: { flex: 1, backgroundColor: colors.black },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerButton: {
    minWidth: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  cancelText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    color: colors.white,
  },
  saveText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  saveTextDisabled: { color: colors.text.tertiary },

  canvasArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  colorRow: { flexDirection: 'row', gap: spacing.sm },
  // 36pt with generous spacing — comfortably over the 44pt touch target once
  // the gap is counted, and these get tapped with a thumb mid-drawing.
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: colors.white,
    // A white ring alone vanishes on the yellow dot; the offset ring of dark
    // ground around it is what makes the selection readable on all three.
    transform: [{ scale: 1.15 }],
  },

  actionRow: { flexDirection: 'row', gap: spacing.base },
  action: { alignItems: 'center', minWidth: 56, gap: 2 },
  actionText: {
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.xs,
    color: colors.white,
  },
  actionTextDisabled: { color: colors.text.tertiary },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginHorizontal: spacing.base,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  errorText: {
    flex: 1,
    fontFamily: typography.fontFamily.ui,
    fontSize: typography.fontSize.sm,
    color: colors.badge.red,
  },
});
