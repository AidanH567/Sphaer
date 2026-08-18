/**
 * The drawing surface, as the reporter uses it.
 *
 * These drive the real PanResponder through the rendered tree, so what is
 * asserted is the behaviour on the phone: a drag makes a mark, undo removes
 * exactly one, clear removes all, the colour you picked is the colour you get,
 * and Save hands back a flattened PNG.
 *
 * The two that matter most:
 *   * UNDO removing ONE stroke. Without it the only recovery from a bad line
 *     is Clear, and the realistic outcome of that is a reporter giving up and
 *     sending nothing — the exact failure this feature exists to fix.
 *   * SAVE emitting the capture canvas's bytes, not the preview's. The preview
 *     is phone-sized; shipping it would send a downscaled, unreadable
 *     screenshot with legible marks on top.
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';
import {
  ScreenshotAnnotator,
  ANNOTATION_COLORS,
} from '@/components/bug-report/ScreenshotAnnotator';
import { colors } from '@/constants/theme';

jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});

/**
 * The capture canvas is mocked at the CANVAS boundary rather than at
 * react-native-svg, so the annotator's real state, real PanResponder and real
 * geometry all run — only the native snapshot is faked, because there is no
 * native view under jest.
 *
 * `mockLastCaptureProps` records what the CAPTURE instance was rendered with,
 * which is how the "flattens at full resolution" assertion is made.
 */
const mockCapture = jest.fn(() => Promise.resolve('QU5OT1RBVEVE'));
let mockLastCaptureProps: Record<string, unknown> | null = null;
let mockAllRenderedProps: Record<string, unknown>[] = [];

jest.mock('@/components/bug-report/AnnotationCanvas', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    annotationCanvasHostStyle: { position: 'absolute', left: -10000, top: 0, opacity: 0 },
    AnnotationCanvas: ReactActual.forwardRef(function MockCanvas(
      props: Record<string, unknown>,
      ref: React.Ref<unknown>
    ) {
      mockAllRenderedProps.push(props);
      // Only the offscreen capture canvas is given a ref by the annotator.
      if (ref) mockLastCaptureProps = props;
      ReactActual.useImperativeHandle(ref, () => ({ capture: mockCapture }), []);
      return ReactActual.createElement(View, { testID: 'annotation-canvas' });
    }),
  };
});

const SOURCE = { width: 1170, height: 2532 };
const BOX = { width: 390, height: 700 };

function renderAnnotator(overrides: Record<string, unknown> = {}) {
  const onSave = jest.fn();
  const onCancel = jest.fn();
  const utils = render(
    <ScreenshotAnnotator
      visible
      uri="file:///tmp/shot.png"
      sourceWidth={SOURCE.width}
      sourceHeight={SOURCE.height}
      onSave={onSave}
      onCancel={onCancel}
      {...overrides}
    />
  );
  // The drawing surface only exists once the container has been measured.
  layoutCanvasArea();
  return { ...utils, onSave, onCancel };
}

/** Give the canvas area a size, as onLayout would on a device. */
function layoutCanvasArea(): void {
  const area = screen.UNSAFE_root.findAll(
    (node: { props?: Record<string, unknown> }) => typeof node.props?.onLayout === 'function'
  )[0];
  act(() => {
    area.props.onLayout({ nativeEvent: { layout: { ...BOX, x: 0, y: 0 } } });
  });
}

/** The View carrying the PanResponder handlers. */
function surface() {
  return screen.getByTestId('annotation-surface');
}

/**
 * A touch event shaped the way PanResponder actually consumes it.
 *
 * The component only reads `locationX/locationY`, but PanResponder computes
 * its gestureState from `touchHistory` BEFORE handing the event on — so a
 * bare `{ nativeEvent }` stub crashes inside RN rather than reaching any code
 * under test. Building the real shape means these tests drive the same
 * gesture pipeline the phone does.
 */
let clock = 1000;
function touchEvent(x: number, y: number, active: boolean) {
  clock += 16; // ~one frame
  const record = {
    touchActive: active,
    startPageX: x,
    startPageY: y,
    startTimeStamp: clock,
    currentPageX: x,
    currentPageY: y,
    currentTimeStamp: clock,
    previousPageX: x,
    previousPageY: y,
    previousTimeStamp: clock,
  };
  return {
    nativeEvent: {
      locationX: x,
      locationY: y,
      pageX: x,
      pageY: y,
      identifier: 0,
      target: 1,
      timestamp: clock,
      touches: active ? [{ identifier: 0, pageX: x, pageY: y, locationX: x, locationY: y }] : [],
      changedTouches: [],
    },
    touchHistory: {
      touchBank: [record],
      numberActiveTouches: active ? 1 : 0,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: clock,
    },
    persist: () => {},
  };
}

/** Drag a stroke across the drawing surface. */
function draw(points: [number, number][]): void {
  const view = surface();
  act(() => {
    view.props.onStartShouldSetResponder?.(touchEvent(points[0][0], points[0][1], true));
    view.props.onResponderGrant(touchEvent(points[0][0], points[0][1], true));
    for (const [x, y] of points.slice(1)) {
      view.props.onResponderMove(touchEvent(x, y, true));
    }
    const [lastX, lastY] = points[points.length - 1];
    view.props.onResponderRelease(touchEvent(lastX, lastY, false));
  });
}

/** The strokes currently on the offscreen capture canvas. */
function captureStrokes(): { color: string; points: unknown[] }[] {
  return (mockLastCaptureProps?.strokes ?? []) as { color: string; points: unknown[] }[];
}

const A_CIRCLE: [number, number][] = [
  [100, 200],
  [200, 220],
  [210, 400],
  [110, 390],
  [100, 200],
];

beforeEach(() => {
  jest.clearAllMocks();
  mockLastCaptureProps = null;
  mockAllRenderedProps = [];
  mockCapture.mockResolvedValue('QU5OT1RBVEVE');
});

describe('ScreenshotAnnotator — drawing', () => {
  it('turns a drag into a stroke', () => {
    renderAnnotator();
    expect(captureStrokes()).toHaveLength(0);
    draw(A_CIRCLE);
    expect(captureStrokes()).toHaveLength(1);
    expect(captureStrokes()[0].points.length).toBeGreaterThan(1);
  });

  it('records a tap as a stroke too, so pointing at something works', () => {
    renderAnnotator();
    draw([[150, 300]]);
    expect(captureStrokes()).toHaveLength(1);
    expect(captureStrokes()[0].points).toHaveLength(1);
  });

  it('keeps each drag as its own stroke', () => {
    renderAnnotator();
    draw(A_CIRCLE);
    draw([[300, 500], [320, 520]]);
    expect(captureStrokes()).toHaveLength(2);
  });

  it('stores points normalised, so they survive the change of scale', () => {
    // The capture canvas is 1170x2532 while the drawing happened on a ~323pt
    // preview. Raw touch coordinates would put every mark near the top-left
    // corner of the flattened image.
    renderAnnotator();
    draw([[100, 200]]);
    const [point] = captureStrokes()[0].points as { x: number; y: number }[];
    expect(point.x).toBeGreaterThan(0);
    expect(point.x).toBeLessThanOrEqual(1);
    expect(point.y).toBeGreaterThan(0);
    expect(point.y).toBeLessThanOrEqual(1);
  });
});

describe('ScreenshotAnnotator — undo and clear', () => {
  it('undo removes exactly one stroke, keeping the rest', () => {
    // The single most important control here. A bad stroke on a phone is a
    // certainty, and losing the good marks with it is what makes people give
    // up and send nothing.
    renderAnnotator();
    draw(A_CIRCLE);
    draw([[300, 500], [320, 520]]);
    draw([[50, 50], [60, 60]]);
    expect(captureStrokes()).toHaveLength(3);

    fireEvent.press(screen.getByLabelText('Undo last mark'));
    expect(captureStrokes()).toHaveLength(2);

    fireEvent.press(screen.getByLabelText('Undo last mark'));
    expect(captureStrokes()).toHaveLength(1);
  });

  it('clear removes everything at once', () => {
    renderAnnotator();
    draw(A_CIRCLE);
    draw([[300, 500], [320, 520]]);
    fireEvent.press(screen.getByLabelText('Clear all marks'));
    expect(captureStrokes()).toHaveLength(0);
  });

  it('disables undo and clear until there is something to remove', () => {
    renderAnnotator();
    expect(screen.getByLabelText('Undo last mark').props.accessibilityState.disabled).toBe(
      true
    );
    expect(screen.getByLabelText('Clear all marks').props.accessibilityState.disabled).toBe(
      true
    );
    draw(A_CIRCLE);
    expect(screen.getByLabelText('Undo last mark').props.accessibilityState.disabled).toBe(
      false
    );
  });
});

describe('ScreenshotAnnotator — colour', () => {
  it('offers three colours, so a red mark on a red error is avoidable', () => {
    // The actual argument for more than one: Sphaer paints error states in
    // badge.red, and a red circle round a red error is invisible.
    renderAnnotator();
    for (const option of ANNOTATION_COLORS) {
      expect(screen.getByLabelText(`${option.label} pen`)).toBeTruthy();
    }
    expect(ANNOTATION_COLORS).toHaveLength(3);
  });

  it('draws in red by default', () => {
    renderAnnotator();
    draw(A_CIRCLE);
    expect(captureStrokes()[0].color).toBe(colors.annotation.red);
  });

  it('draws in the colour picked AFTER the picker was created', () => {
    // The PanResponder is built once and closes over state. Reading the colour
    // from stale closure state would silently draw every stroke red — a bug
    // invisible until someone tries the second colour.
    renderAnnotator();
    fireEvent.press(screen.getByLabelText('Blue pen'));
    draw(A_CIRCLE);
    expect(captureStrokes()[0].color).toBe(colors.annotation.cyan);
  });

  it('keeps earlier strokes in the colour they were drawn with', () => {
    renderAnnotator();
    draw(A_CIRCLE);
    fireEvent.press(screen.getByLabelText('Yellow pen'));
    draw([[300, 500], [320, 520]]);
    expect(captureStrokes()[0].color).toBe(colors.annotation.red);
    expect(captureStrokes()[1].color).toBe(colors.annotation.yellow);
  });
});

describe('ScreenshotAnnotator — saving', () => {
  it('flattens at the screenshot’s real resolution, not the preview size', () => {
    // Capturing the preview would send a ~390px-wide image: legible marks over
    // an unreadable screenshot, which is a worse report than no picture.
    renderAnnotator();
    expect(mockLastCaptureProps?.width).toBe(SOURCE.width);
    expect(mockLastCaptureProps?.height).toBe(SOURCE.height);
  });

  it('sizes the preview to fit the box while keeping the aspect ratio', () => {
    renderAnnotator();
    const preview = mockAllRenderedProps.find((p) => p.width !== SOURCE.width);
    expect(preview).toBeTruthy();
    const ratio = (preview!.width as number) / (preview!.height as number);
    expect(ratio).toBeCloseTo(SOURCE.width / SOURCE.height, 4);
    expect(preview!.width as number).toBeLessThanOrEqual(BOX.width);
    expect(preview!.height as number).toBeLessThanOrEqual(BOX.height);
  });

  it('hands back the flattened bytes and a data URI', async () => {
    const { onSave } = renderAnnotator();
    draw(A_CIRCLE);
    fireEvent.press(screen.getByLabelText('Save annotation'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(mockCapture).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith({
      base64: 'QU5OT1RBVEVE',
      dataUri: 'data:image/png;base64,QU5OT1RBVEVE',
    });
  });

  it('will not save an untouched screenshot', () => {
    // Flattening with no marks is a round trip through the rasteriser for no
    // change — and it would replace the original with a re-encoded copy.
    const { onSave } = renderAnnotator();
    expect(screen.getByLabelText('Save annotation').props.accessibilityState.disabled).toBe(
      true
    );
    fireEvent.press(screen.getByLabelText('Save annotation'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('surfaces a failed capture instead of closing on a lie', async () => {
    // A silently-dropped annotation would send the un-marked screenshot and
    // look like it worked.
    const { onSave } = renderAnnotator();
    mockCapture.mockRejectedValueOnce(new Error('native snapshot died'));
    draw(A_CIRCLE);
    fireEvent.press(screen.getByLabelText('Save annotation'));
    await waitFor(() => expect(screen.getByText(/Couldn't save your marks/)).toBeTruthy());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('still works on a small phone, where this will actually be used', () => {
    // iPhone SE, minus header and toolbar. A tall screenshot on a short phone
    // is HEIGHT-constrained, so the drawing surface ends up narrow — the thing
    // that must not happen is it collapsing to zero, or overflowing the box
    // and putting part of the image under the toolbar where it cannot be
    // drawn on.
    render(
      <ScreenshotAnnotator
        visible
        uri="file:///tmp/shot.png"
        sourceWidth={SOURCE.width}
        sourceHeight={SOURCE.height}
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    const small = { width: 320, height: 460 };
    const area = screen.UNSAFE_root.findAll(
      (node: { props?: Record<string, unknown> }) => typeof node.props?.onLayout === 'function'
    )[0];
    act(() => {
      area.props.onLayout({ nativeEvent: { layout: { ...small, x: 0, y: 0 } } });
    });

    const preview = mockAllRenderedProps
      .filter((p) => p.width !== SOURCE.width)
      .pop();
    expect(preview!.width as number).toBeGreaterThan(0);
    expect(preview!.width as number).toBeLessThanOrEqual(small.width);
    expect(preview!.height as number).toBeLessThanOrEqual(small.height);
    // Aspect ratio survives the squeeze — a stretched preview would put marks
    // somewhere other than where the finger went.
    expect((preview!.width as number) / (preview!.height as number)).toBeCloseTo(
      SOURCE.width / SOURCE.height,
      4
    );
    // And the controls are still reachable.
    expect(screen.getByLabelText('Undo last mark')).toBeTruthy();
    expect(screen.getByLabelText('Clear all marks')).toBeTruthy();
    expect(screen.getByLabelText('Save annotation')).toBeTruthy();
  });

  it('cancel discards the marks without saving', () => {
    const { onCancel, onSave } = renderAnnotator();
    draw(A_CIRCLE);
    fireEvent.press(screen.getByLabelText('Cancel annotation'));
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
