/**
 * The circle-cover generator, as a hook. The landscape twin of
 * `useGeneratedPoster`, and deliberately a sibling rather than a mode on it.
 *
 * Owns everything between "the user tapped Generate a cover" and "there is a
 * PNG ready to attach": solving the layout, holding the ref to the offscreen
 * canvas, running the structural guard, and snapshotting. It does NOT upload —
 * the create-circle screen needs the bytes before a circle row exists (it
 * uploads after the insert, via `updateCircle`), and the edit screen uploads
 * immediately. So upload stays with the caller, exactly as on the event side.
 *
 * ── Why a separate hook and not a flag ───────────────────────────────────────
 * The two share no inputs. A poster is solved from a title, a start time, an
 * end time, a venue and an address; a cover is solved from a name and tags. The
 * only honest way to put them in one hook would be a union input type and a
 * branch in the memo, which is more code than this file and reads worse. What
 * they DO share — the canvas component, the guard, the capture handle — is
 * shared already, because a solved cover is a `PosterLayout`.
 *
 * ── The bar for `canGenerate` is one field ───────────────────────────────────
 * A poster needs a title AND a start time, because a poster without a date is a
 * poster missing its point. A circle has no date; the only thing a cover needs
 * is a name. That is a much lower bar and the UI should say so rather than
 * copying the event screen's two-item checklist.
 *
 * Usage, from a screen:
 *
 *     const cover = useGeneratedCover({ name, tags });
 *     …
 *     {cover.layout && (
 *       <View style={posterCanvasHostStyle} pointerEvents="none">
 *         <GeneratedPosterCanvas ref={cover.canvasRef} layout={cover.layout} />
 *       </View>
 *     )}
 *
 * The canvas must be MOUNTED before `generate()` is called — `toDataURL`
 * snapshots a live native view, so there is nothing to snapshot otherwise.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { PosterCanvasHandle } from '@/components/events/GeneratedPosterCanvas';
import { assertLayoutIsPaintable, PosterGenerationError } from '@/utils/poster-guard';
import { buildCoverLayout, type CoverInput, type CoverLayout } from '@/utils/cover-template';

/**
 * Tags arrive from the circle form as a live array rebuilt on every render.
 * Joining them into a string for the memo's dependency list means the layout is
 * re-solved when the TAGS change, not when React hands us a new array with the
 * same contents — which is every render.
 *
 * The separator is written as an ESCAPE SEQUENCE, never as a literal control
 * byte: a raw control character makes git treat the whole file as binary, which
 * commit 937a2b7 had to undo once already.
 *
 * And it is not a space, because "Social Movements" is a real tag — a
 * space-joined key would split back into two unrecognised tags and silently
 * drop the circle off its family shortlist.
 */
const TAG_SEP = '\u0001';

function tagKey(tags?: readonly string[] | null): string {
  return tags ? tags.join(TAG_SEP) : '';
}

export interface GeneratedCover {
  /** Bare base64 PNG — what `uploadGeneratedCircleCover` wants. */
  base64: string;
  /** The same bytes as a `data:` URI, for previewing through expo-image. */
  dataUri: string;
  /** True when the circle's name had to be shortened to fit the cover. */
  nameTruncated: boolean;
}

/** `null` when there is not enough on the form to make a cover yet. */
function toCoverInput(input: Partial<CoverInput>): CoverInput | null {
  const name = input.name?.trim();
  if (!name) return null;
  return {
    name,
    description: input.description ?? null,
    tags: input.tags ?? null,
    photoDataUri: input.photoDataUri ?? null,
    variant: input.variant ?? 0,
  };
}

export function useGeneratedCover(input: Partial<CoverInput>) {
  const canvasRef = useRef<PosterCanvasHandle>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  /**
   * Which shuffle step the user is on. 0 is the circle's canonical cover — the
   * one it regenerates to on its own — and Shuffle walks forward from there.
   *
   * Deliberately NOT persisted. What gets uploaded is the captured PNG, so
   * whatever the user shuffled to IS the cover.
   */
  const [variant, setVariant] = useState(0);

  const { name, description, photoDataUri, tags } = input;
  const tKey = tagKey(tags);

  // Solved synchronously from form state. Cheap (string maths, no I/O), so the
  // offscreen canvas re-renders only when a field that actually reaches the
  // cover changes.
  const layout: CoverLayout | null = useMemo(() => {
    const coverInput = toCoverInput({
      name,
      description,
      photoDataUri,
      tags: tKey ? tKey.split(TAG_SEP) : null,
      variant,
    });
    return coverInput ? buildCoverLayout(coverInput) : null;
    // `tKey` stands in for `tags` on purpose — see tagKey above.
  }, [name, description, photoDataUri, tKey, variant]);

  const generate = useCallback(async (): Promise<GeneratedCover> => {
    if (!layout) {
      throw new PosterGenerationError('Give your circle a name first — the cover is made from it.');
    }
    setIsGenerating(true);
    try {
      // Structural guard BEFORE rendering. A layout that clears this cannot
      // rasterise to a transparent image, because an opaque rect covers every
      // pixel and there is real text on top of it. It reads `layout.width` and
      // `layout.height`, so it needed no change for a landscape canvas.
      assertLayoutIsPaintable(layout);

      const canvas = canvasRef.current;
      if (!canvas) {
        throw new PosterGenerationError("The cover canvas wasn't ready. Please try again.");
      }
      const base64 = await canvas.capture();
      // The output guard runs in `uploadGeneratedCircleCover`, on the exact
      // bytes that go over the wire — not duplicated here, for the same reason
      // it is not duplicated on the event side.
      return {
        base64,
        dataUri: `data:image/png;base64,${base64}`,
        nameTruncated: layout.titleTruncated,
      };
    } finally {
      setIsGenerating(false);
    }
  }, [layout]);

  /**
   * Step to the next family/palette combination. Cheap enough to call on every
   * tap: the layout is pure string maths in a memo, so shuffling re-solves the
   * offscreen canvas and nothing else. It does NOT capture — the user shuffles
   * until they like the preview, then presses Generate once.
   */
  const shuffle = useCallback(() => setVariant((v) => v + 1), []);

  return {
    canvasRef,
    layout,
    /** Which family solved the current layout, e.g. 'ribbon'. Null before there is one. */
    family: layout?.family ?? null,
    variant,
    shuffle,
    /** True once the circle has a name — the only thing a cover needs. */
    canGenerate: layout !== null,
    isGenerating,
    generate,
  };
}
