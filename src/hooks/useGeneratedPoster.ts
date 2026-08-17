/**
 * The poster generator, as a hook.
 *
 * Owns everything between "the user tapped Generate a poster" and "there is a
 * PNG ready to attach": solving the layout, holding the ref to the offscreen
 * canvas, running the structural guard, snapshotting, and running the output
 * guard. It does NOT upload — the create screen needs the bytes before an
 * event row exists, and the edit screen needs them uploaded immediately, so
 * upload stays with the caller (`uploadGeneratedEventPoster`).
 *
 * Usage, from a screen:
 *
 *     const poster = useGeneratedPoster({ title, startsAt, address });
 *     …
 *     {poster.canGenerate && (
 *       <View style={posterCanvasHostStyle}>
 *         <GeneratedPosterCanvas ref={poster.canvasRef} layout={poster.layout!} />
 *       </View>
 *     )}
 *
 * The canvas must be MOUNTED before `generate()` is called — `toDataURL`
 * snapshots a live native view, so there is nothing to snapshot otherwise.
 * `canGenerate` is exactly the condition under which the layout exists, so
 * gating both the offscreen host and the button on it keeps the two in step.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { PosterCanvasHandle } from '@/components/events/GeneratedPosterCanvas';
import { assertLayoutIsPaintable, PosterGenerationError } from '@/utils/poster-guard';
import { buildPosterLayout, type PosterInput, type PosterLayout } from '@/utils/poster-template';

export interface GeneratedPoster {
  /** Bare base64 PNG — what `uploadGeneratedEventPoster` wants. */
  base64: string;
  /** The same bytes as a `data:` URI, for previewing through expo-image. */
  dataUri: string;
  /** True when the event's title had to be shortened to fit the poster. */
  titleTruncated: boolean;
}

/**
 * `null` when there is not enough on the form to make a poster yet. The bar is
 * deliberately low — a title and a start time — because those are the two
 * fields the create form already requires before it will publish anything.
 */
function toPosterInput(input: Partial<PosterInput>): PosterInput | null {
  const title = input.title?.trim();
  const startsAt = input.startsAt;
  if (!title || !startsAt) return null;
  if (Number.isNaN(new Date(startsAt).getTime())) return null;
  return {
    title,
    startsAt,
    endsAt: input.endsAt ?? null,
    locationName: input.locationName ?? null,
    address: input.address ?? null,
    photoDataUri: input.photoDataUri ?? null,
  };
}

export function useGeneratedPoster(input: Partial<PosterInput>) {
  const canvasRef = useRef<PosterCanvasHandle>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { title, startsAt, endsAt, locationName, address, photoDataUri } = input;

  // Solved synchronously from form state. Cheap (string maths, no I/O), and
  // keeping it in a memo means the offscreen canvas re-renders only when a
  // field that actually reaches the poster changes — not on every keystroke
  // in, say, the description field.
  const layout: PosterLayout | null = useMemo(() => {
    const posterInput = toPosterInput({
      title,
      startsAt,
      endsAt,
      locationName,
      address,
      photoDataUri,
    });
    return posterInput ? buildPosterLayout(posterInput) : null;
  }, [title, startsAt, endsAt, locationName, address, photoDataUri]);

  const generate = useCallback(async (): Promise<GeneratedPoster> => {
    if (!layout) {
      throw new PosterGenerationError(
        'Add a title and a start time first — the poster is made from them.'
      );
    }
    setIsGenerating(true);
    try {
      // Structural guard BEFORE rendering. A layout that clears this cannot
      // rasterise to a transparent image, because an opaque rect covers every
      // pixel of the canvas and there is real text on top of it.
      assertLayoutIsPaintable(layout);

      const canvas = canvasRef.current;
      if (!canvas) {
        throw new PosterGenerationError(
          "The poster canvas wasn't ready. Please try again."
        );
      }
      const base64 = await canvas.capture();
      // The output guard runs in uploadGeneratedEventPoster, on the exact
      // bytes that go over the wire. Deliberately not duplicated here: two
      // decodes of the same base64 is wasted work on a phone, and a check
      // that runs anywhere other than the upload path can be bypassed.
      return {
        base64,
        dataUri: `data:image/png;base64,${base64}`,
        titleTruncated: layout.titleTruncated,
      };
    } finally {
      setIsGenerating(false);
    }
  }, [layout]);

  return {
    canvasRef,
    layout,
    /** True when the form has enough on it for a poster to exist. */
    canGenerate: layout !== null,
    isGenerating,
    generate,
  };
}
