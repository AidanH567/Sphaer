import { useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';
import { useAppContext, type PosterSize } from '@/context/AppContext';

interface UseMuralDimensionsResult {
  /** Map from poster_url → measured size. Includes preset (caller-supplied)
   *  sizes, cache hits, and freshly resolved entries. URLs whose getSize()
   *  fails are entered with a fallback 2:3 portrait size so the layout
   *  never blocks on a bad URL. */
  dimensions: Map<string, PosterSize>;
  /** Number of URLs whose dimensions are known (preset/cache/fresh). */
  resolvedCount: number;
  /** Total URLs requested this pass. */
  totalCount: number;
  /** True once ≥95% of URLs have resolved — the threshold MuralCanvas waits
   *  on before fading in. Tail-end stragglers (slow CDN responses) don't
   *  hold up first paint forever. When every URL has a preset, this is
   *  true on the first render. */
  ready: boolean;
}

const READY_THRESHOLD = 0.95;
const FALLBACK_SIZE: PosterSize = { width: 600, height: 900 }; // 2:3 portrait

/**
 * Batch-resolve poster image dimensions for the Mural layout.
 *
 * Strategy (in order):
 *   1. **Presets** — if the caller supplies a preset entry for a URL (e.g.
 *      a figma-seed event whose dims are embedded in mockEvents.ts), use
 *      it directly. No network round-trip. Hot-path for the demo data.
 *   2. **AppContext cache** — persists across screen mounts, so repeated
 *      navigations into Mural don't re-measure.
 *   3. **Image.getSize()** — last resort. Fires in parallel for whatever
 *      URLs neither preset nor cache could answer.
 *
 * Failed fetches fall back to a 2:3 portrait default so a single broken
 * URL can't block the wall from rendering.
 */
export function useMuralDimensions(
  urls: string[],
  presets?: Map<string, PosterSize>
): UseMuralDimensionsResult {
  const { getPosterSize, setPosterSize } = useAppContext();

  // Identity-stable empty preset so the deps array below is sound even
  // when the caller doesn't supply one.
  const presetMap = presets ?? EMPTY_PRESETS;

  // Seed: start with whatever the presets give us. Render-time, zero async.
  const [dimensions, setDimensions] = useState<Map<string, PosterSize>>(
    () => seedDimensionsFromPresets(urls, presetMap, getPosterSize)
  );

  // Stable join key so we re-run only when the URL set actually changes.
  // Sorted so [a, b] and [b, a] collapse to the same run — order doesn't
  // matter for the cache and the layout sorts its own inputs.
  const key = useMemo(() => [...urls].sort().join('|'), [urls]);

  useEffect(() => {
    let cancelled = false;

    // Re-seed on URL-set change (e.g. filter applied) so stale entries
    // from a previous render don't leak into the new layout.
    const initial = seedDimensionsFromPresets(urls, presetMap, getPosterSize);
    setDimensions(initial);

    const missing = urls.filter((u) => !initial.has(u));
    if (missing.length === 0) return;

    // Fire all misses in parallel. Each promise either writes the measured
    // size or the fallback; either way it resolves so Promise.all never
    // rejects the batch.
    const tasks = missing.map(
      (url) =>
        new Promise<void>((resolve) => {
          Image.getSize(
            url,
            (width, height) => {
              if (cancelled) return resolve();
              const size: PosterSize = { width, height };
              setPosterSize(url, size);
              setDimensions((prev) => {
                const next = new Map(prev);
                next.set(url, size);
                return next;
              });
              resolve();
            },
            () => {
              if (cancelled) return resolve();
              setPosterSize(url, FALLBACK_SIZE);
              setDimensions((prev) => {
                const next = new Map(prev);
                next.set(url, FALLBACK_SIZE);
                return next;
              });
              resolve();
            }
          );
        })
    );

    void Promise.all(tasks);
    return () => {
      cancelled = true;
    };
    // presetMap is read inside but its identity should be stable; gating
    // on `key` alone matches the "URL set changed" intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const resolvedCount = dimensions.size;
  const totalCount = urls.length;
  const ready =
    totalCount === 0 || resolvedCount / totalCount >= READY_THRESHOLD;

  return { dimensions, resolvedCount, totalCount, ready };
}

const EMPTY_PRESETS: Map<string, PosterSize> = new Map();

function seedDimensionsFromPresets(
  urls: string[],
  presets: Map<string, PosterSize>,
  getPosterSize: (url: string) => PosterSize | undefined
): Map<string, PosterSize> {
  const out = new Map<string, PosterSize>();
  for (const url of urls) {
    const preset = presets.get(url);
    if (preset) {
      out.set(url, preset);
      continue;
    }
    const cached = getPosterSize(url);
    if (cached) out.set(url, cached);
  }
  return out;
}
