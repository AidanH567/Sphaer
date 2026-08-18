/**
 * Screenshot annotation — the pure geometry.
 *
 * Everything in this file is maths on plain numbers: no React, no SVG, no
 * platform. That is deliberate, and it is the same discipline the poster
 * template follows. There are TWO renderers over these strokes —
 *
 *   1. the on-screen preview, sized to whatever fits on the phone, and
 *   2. the offscreen capture canvas, sized to the screenshot's real pixels
 *
 * — and the whole feature is worthless if they disagree, because the user
 * would circle one thing and send a picture with the circle somewhere else.
 * Neither renderer is allowed to compute a coordinate: both call
 * `strokeToPathData` with their own dimensions and draw exactly what comes
 * back.
 *
 * ── Why points are stored NORMALISED (0..1) ──────────────────────────────────
 * A stroke drawn on a 340pt-wide preview has to come out in the right place on
 * a 1170px-wide screenshot. Storing raw touch coordinates would mean carrying
 * the preview size around with every stroke and rescaling at capture time —
 * one more thing to get wrong, and invisible when it IS wrong (the picture
 * still renders; the circle is just in the wrong place). Normalised points are
 * resolution-free by construction: the same stroke is correct at any size, and
 * the preview and the capture differ only in the numbers they multiply by.
 */

export class AnnotationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnnotationError';
  }
}

/** A point in normalised image space. (0,0) is top-left, (1,1) bottom-right. */
export interface AnnotationPoint {
  x: number;
  y: number;
}

/** One continuous press-drag-release. */
export interface AnnotationStroke {
  /** Hex colour, from `colors.annotation`. */
  color: string;
  points: AnnotationPoint[];
}

/**
 * Stroke width as a fraction of the image's SHORTER side.
 *
 * A fraction, not a pixel count, because the two things this draws on differ
 * by roughly 3.5x: a 2px stroke that reads correctly on a 340pt preview is a
 * hairline on the 1170px screenshot it gets flattened into — visible on the
 * phone while drawing, effectively invisible in the report that gets sent.
 * That is the failure this constant exists to prevent.
 *
 * The SHORTER side rather than the width, so a landscape screenshot gets the
 * same visual weight as a portrait one instead of a stroke ~2x too heavy.
 *
 * 0.006 puts it at ~7px on a 1170px-wide phone screenshot and ~2px on the
 * preview — a confident marker-pen line at both sizes, which is what a circle
 * round a padding error needs to be.
 */
export const ANNOTATION_STROKE_RATIO = 0.006;

/** Floor, so a thumbnail-sized source still gets a line you can see. */
export const MIN_STROKE_WIDTH_PX = 2;

/**
 * Points closer together than this (in normalised units) are dropped.
 *
 * A finger drag fires move events far faster than the hand actually moves, and
 * without decimation a single slow circle arrives as ~600 points. That is a
 * path string measured in kilobytes, re-rendered on every frame of the drag.
 * 0.004 is well under the width of the stroke itself, so nothing visible is
 * lost — the line through the kept points is the same line.
 */
export const MIN_POINT_DISTANCE = 0.004;

/** How long to wait for the native snapshot before calling it a failure. */
export const ANNOTATION_CAPTURE_TIMEOUT_MS = 15000;

/**
 * The stroke width to draw at, for a canvas of the given pixel size.
 *
 * Both renderers call this. The preview passes its displayed size, the capture
 * canvas passes the screenshot's real size, and the line looks the same on
 * both — which is the only reason the preview is an honest preview.
 */
export function strokeWidthFor(width: number, height: number): number {
  const shortSide = Math.min(width, height);
  if (!Number.isFinite(shortSide) || shortSide <= 0) return MIN_STROKE_WIDTH_PX;
  return Math.max(MIN_STROKE_WIDTH_PX, shortSide * ANNOTATION_STROKE_RATIO);
}

/** Clamp to [0,1]. A drag that leaves the image must not draw outside it. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Turn a touch at (x, y) on a `width`x`height` view into a normalised point.
 *
 * Clamped, because a PanResponder keeps reporting coordinates after the finger
 * has slid off the edge of the image — without the clamp those become strokes
 * painted outside the canvas, which are invisible in the preview (clipped by
 * the view) but change the captured image's bounds on some platforms.
 */
export function toNormalizedPoint(
  x: number,
  y: number,
  width: number,
  height: number
): AnnotationPoint {
  if (width <= 0 || height <= 0) return { x: 0, y: 0 };
  return { x: clamp01(x / width), y: clamp01(y / height) };
}

/** Squared distance — avoids a sqrt on every single move event. */
function distanceSquared(a: AnnotationPoint, b: AnnotationPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Append `point` unless it is too close to the last one to matter.
 *
 * Returns the SAME array reference when the point is dropped, so a caller
 * using this in React state gets no re-render for a movement that would not
 * have changed a pixel.
 */
export function appendPoint(
  points: AnnotationPoint[],
  point: AnnotationPoint
): AnnotationPoint[] {
  const last = points[points.length - 1];
  if (last && distanceSquared(last, point) < MIN_POINT_DISTANCE * MIN_POINT_DISTANCE) {
    return points;
  }
  return [...points, point];
}

function fixed(value: number): string {
  // Two decimals of a pixel is far below anything renderable, and keeps the
  // path string short enough to be cheap to diff and re-render.
  return (Math.round(value * 100) / 100).toString();
}

/**
 * SVG path data for one stroke, in the pixel space of a `width`x`height` canvas.
 *
 * ── Why quadratics rather than a polyline ────────────────────────────────────
 * The obvious `M … L … L …` is correct and looks wrong: a hand-drawn circle
 * decimated to ~30 points renders as a visible polygon, which reads as a
 * clumsy shape rather than a deliberate mark. Curving through the MIDPOINTS of
 * consecutive segments (each original point becomes a control point) is the
 * standard freehand smoothing trick — it costs one extra multiply per point
 * and turns the same 30 points into a smooth loop.
 *
 * The degenerate cases are both real and both must draw something:
 *   * one point  — a tap. Emitted as a zero-length line, which with
 *                  `stroke-linecap: round` paints a dot. Users tap to point at
 *                  things, and a tap that drew nothing would read as broken.
 *   * two points — a flick. No midpoint to curve through; a straight line is
 *                  exactly right.
 */
export function strokeToPathData(
  stroke: AnnotationStroke,
  width: number,
  height: number
): string {
  const points = stroke.points;
  if (points.length === 0) return '';

  const px = (p: AnnotationPoint) => `${fixed(p.x * width)} ${fixed(p.y * height)}`;

  if (points.length === 1) {
    // Zero-length line → a round dot. `M x y` alone paints nothing.
    return `M ${px(points[0])} L ${px(points[0])}`;
  }
  if (points.length === 2) {
    return `M ${px(points[0])} L ${px(points[1])}`;
  }

  let d = `M ${px(points[0])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const midpoint: AnnotationPoint = {
      x: (current.x + next.x) / 2,
      y: (current.y + next.y) / 2,
    };
    d += ` Q ${px(current)} ${px(midpoint)}`;
  }
  // Finish on the real last point rather than a midpoint, so the stroke ends
  // where the finger lifted.
  d += ` L ${px(points[points.length - 1])}`;
  return d;
}

/** Drop the most recent stroke. Undo. */
export function dropLastStroke(strokes: AnnotationStroke[]): AnnotationStroke[] {
  if (strokes.length === 0) return strokes;
  return strokes.slice(0, -1);
}

/** Is there anything drawn? Gates Save — flattening a bare screenshot is a
 *  round trip through the rasteriser for no change at all. */
export function hasInk(strokes: AnnotationStroke[]): boolean {
  return strokes.some((stroke) => stroke.points.length > 0);
}

/**
 * Web only: refuse to capture a canvas whose painted box is not its real size.
 *
 * ── Inherited from the poster generator, which found it in a real browser ────
 * On web, react-native-svg's `toDataURL` does not snapshot the element. It
 * clones it into a NEW `<svg>` whose viewBox it computes from
 * `getBoundingClientRect`. So any `transform: scale()` anywhere above the
 * canvas makes the capture a magnified corner of the content — in a file that
 * is the right dimensions, fully opaque, and passes every byte-level check.
 * That is how eight blank tiles reached the Mural: valid file, wrong content.
 *
 * For annotation the stakes are the same shape. A scaled host would flatten to
 * a close-up of the screenshot's top-left corner with the circle nowhere near
 * whatever it was drawn around — and the reporter would never know, because
 * they saw the correct preview.
 *
 * Native returns no rect and is skipped: there, `toDataURL(w, h)` allocates its
 * own bitmap and fits the viewBox to it, so the on-screen box is irrelevant.
 *
 * Written here rather than reused from `GeneratedPosterCanvas` because that
 * one's messages talk about posters, and a reporter annotating a screenshot
 * should not be told their poster canvas is the wrong size.
 */
const MAX_BOX_DRIFT_PX = 1;

export function assertAnnotationBoxIsUntransformed(
  host: unknown,
  expectedWidth: number,
  expectedHeight: number,
  isWeb: boolean
): void {
  if (!isWeb) return;
  const el = host as { getBoundingClientRect?: () => { width: number; height: number } };
  if (typeof el?.getBoundingClientRect !== 'function') return;
  const rect = el.getBoundingClientRect();
  // A zero box means the host is not laid out; capturing it produces an empty
  // image.
  if (rect.width === 0 || rect.height === 0) {
    throw new AnnotationError("The annotation canvas wasn't ready. Please try again.");
  }
  if (
    Math.abs(rect.width - expectedWidth) > MAX_BOX_DRIFT_PX ||
    Math.abs(rect.height - expectedHeight) > MAX_BOX_DRIFT_PX
  ) {
    throw new AnnotationError(
      `The annotation canvas is being displayed at ${Math.round(rect.width)}×${Math.round(
        rect.height
      )} instead of ${expectedWidth}×${expectedHeight}, which would misplace your marks. ` +
        'Remove any scaling from the container that holds it.'
    );
  }
}

/**
 * The displayed rectangle of an image letterboxed ("contain") into a box.
 *
 * The drawing surface must be exactly the image's displayed rect, not the
 * container: if the responder covers the letterbox bars too, a touch in a bar
 * normalises to a coordinate the image never occupied, and the stroke lands
 * somewhere else entirely in the flattened output. Computing the fit here —
 * and sizing both the preview canvas and the touch target from it — makes that
 * whole class of misplacement impossible.
 */
export function fitContain(
  sourceWidth: number,
  sourceHeight: number,
  boxWidth: number,
  boxHeight: number
): { width: number; height: number } {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    boxWidth <= 0 ||
    boxHeight <= 0
  ) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  return { width: sourceWidth * scale, height: sourceHeight * scale };
}

// ─── Did the capture actually capture the screenshot? ────────────────────────

/**
 * Sampled comparison of the flattened capture against its source screenshot.
 *
 * `sourceOpaqueCells` — grid cells where the SOURCE has visible pixels.
 * `matchedCells`      — of those, how many the CAPTURE also has pixels in.
 *
 * Expressed as counts rather than a ratio so the assertion below can tell
 * "nothing to compare" (a fully transparent source) apart from "compared, and
 * it failed" — those deserve different behaviour, and a bare ratio loses the
 * distinction.
 */
export interface CaptureFidelity {
  sourceOpaqueCells: number;
  matchedCells: number;
}

/**
 * How much of the screenshot has to survive into the capture.
 *
 * Not 1.0: the strokes themselves are drawn over the image, sampling is on a
 * coarse grid, and a stroke laid across a sampled cell can legitimately change
 * it. 0.9 is far above what a real annotation removes (a marker circle covers
 * a percent or two of the frame) and far below the failure being guarded
 * against, which scores ~0.
 */
export const CAPTURE_FIDELITY_MIN = 0.9;

/**
 * Grid resolution for the fidelity sample. 32×32 = 1024 probes — plenty to
 * tell "the screenshot is there" from "the screenshot is not", at the cost of
 * one tiny draw of each image.
 */
export const FIDELITY_GRID = 32;

/** Alpha at or below this counts as "nothing here". */
export const FIDELITY_TRANSPARENT_ALPHA = 8;

/**
 * Compare two RGBA buffers by PRESENCE, not colour.
 *
 * Colour matching would flag the strokes (which are supposed to differ) and
 * every antialiasing difference between two rasterisers. Presence isolates
 * the single failure that matters: the background going missing entirely.
 *
 * Pure and buffer-shaped so the browser path and the offline QA harness run
 * THIS function rather than two lookalikes that can drift — the drift being
 * how a verifier ends up certifying something it never actually checked.
 */
export function compareAlphaGrids(
  source: ArrayLike<number>,
  capture: ArrayLike<number>
): CaptureFidelity {
  let sourceOpaqueCells = 0;
  let matchedCells = 0;
  for (let i = 3; i < source.length; i += 4) {
    if (source[i] <= FIDELITY_TRANSPARENT_ALPHA) continue;
    sourceOpaqueCells += 1;
    if (capture[i] > FIDELITY_TRANSPARENT_ALPHA) matchedCells += 1;
  }
  return { sourceOpaqueCells, matchedCells };
}

/**
 * Refuse a capture whose background is missing.
 *
 * ── The failure this exists for ──────────────────────────────────────────────
 * `Svg.toDataURL()` returns a perfectly valid PNG, of exactly the requested
 * dimensions, whether or not the screenshot underneath the strokes rendered.
 * When it did not, the output is a circle drawn round nothing — and every
 * check short of looking at the pixels passes it. That shipped (report
 * 97398534: "the photo is blank and you can only see what users draw on a
 * blank page"), and it is the fourth time in this codebase that a file was
 * valid and its contents were wrong — after the blank posters, the mural, and
 * the icons.
 *
 * So: compare the output against the input and refuse the ones that lost it.
 * A file being well-formed is not evidence that it contains anything.
 *
 * `null` means the platform could not sample the pixels (see
 * `measureCaptureFidelity`) — the caller has already enforced the readiness
 * invariant that makes the failure impossible there, so this is not a
 * silent pass on the path where the bug lives.
 */
export function assertCaptureFidelity(fidelity: CaptureFidelity | null): void {
  if (fidelity === null) return;
  // A source with nothing opaque in it gives nothing to verify against.
  // Vacuous rather than failing: the user picked that image on purpose.
  if (fidelity.sourceOpaqueCells === 0) return;

  const ratio = fidelity.matchedCells / fidelity.sourceOpaqueCells;
  if (ratio < CAPTURE_FIDELITY_MIN) {
    throw new AnnotationError(
      "Your marks saved but the screenshot behind them didn't, so the report " +
        'would have shown drawings on a blank page. Nothing was sent — please ' +
        'try attaching the screenshot again.'
    );
  }
}
