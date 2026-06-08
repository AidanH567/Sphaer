import { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { useAppContext, type PosterSize } from '@/context/AppContext';

interface UseMuralDimensionsResult {
  /** Map from poster_url → measured size. Includes cache hits and freshly
   *  resolved entries. URLs whose getSize() fails are entered with a
   *  fallback 2:3 portrait size so the layout never blocks on a bad URL. */
  dimensions: Map<string, PosterSize>;
  /** Number of URLs whose dimensions are known (cache or fresh). */
  resolvedCount: number;
  /** Total URLs requested this pass. */
  totalCount: number;
  /** True once ≥95% of URLs have resolved — the threshold MuralCanvas waits
   *  on before fading in. Tail-end stragglers (slow CDN responses) don't
   *  hold up first paint forever. */
  ready: boolean;
}

const READY_THRESHOLD = 0.95;
const FALLBACK_SIZE: PosterSize = { width: 600, height: 900 }; // 2:3 portrait

/**
 * Batch-resolve poster image dimensions for the Mural layout.
 *
 * Strategy: for each URL we first consult the AppContext cache (which
 * persists across screen mounts). Cache misses fire `Image.getSize()` in
 * parallel; results are written back to the cache and reflected locally so
 * the consuming screen can re-render. We expose a `ready` flag (95%
 * threshold) so the skeleton fades out without waiting on slow stragglers.
 */
export function useMuralDimensions(urls: string[]): UseMuralDimensionsResult {
  const { getPosterSize, setPosterSize } = useAppContext();
  const [dimensions, setDimensions] = useState<Map<string, PosterSize>>(
    () => new Map()
  );

  // Stable join key so we re-run only when the URL set actually changes.
  // Sorted so [a, b] and [b, a] collapse to the same run — order doesn't
  // matter for the cache and the layout sorts its own inputs.
  const key = [...urls].sort().join('|');

  useEffect(() => {
    let cancelled = false;

    // Seed with cache hits immediately — no flicker for previously-loaded URLs.
    const initial = new Map<string, PosterSize>();
    const missing: string[] = [];
    for (const url of urls) {
      const cached = getPosterSize(url);
      if (cached) {
        initial.set(url, cached);
      } else {
        missing.push(url);
      }
    }
    setDimensions(initial);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const resolvedCount = dimensions.size;
  const totalCount = urls.length;
  const ready =
    totalCount === 0 || resolvedCount / totalCount >= READY_THRESHOLD;

  return { dimensions, resolvedCount, totalCount, ready };
}
