import { useEffect, useState } from 'react';

/**
 * Returns `value` delayed by `delayMs`. Each new value resets the timer, so
 * a rapidly-changing input (e.g. someone typing into a search bar) only
 * propagates once they pause.
 *
 * Use case: avoid hammering Supabase with an `ilike` query on every keystroke.
 * 300ms is a common default — long enough to swallow a normal typing burst,
 * short enough that the result still feels live.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
