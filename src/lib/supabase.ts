import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { config } from '@/constants/config';
import type { Database } from '@/types/supabase';

// expo-secure-store is native-only; fall back to localStorage on web
const storage = Platform.OS === 'web'
  ? {
      getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
      setItem: (key: string, value: string) => {
        localStorage.setItem(key, value);
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        localStorage.removeItem(key);
        return Promise.resolve();
      },
    }
  : (() => {
      // Deliberate lazy require — expo-secure-store must not be imported on
      // web (no native module). Rule name updated for typescript-eslint v8.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const SecureStore = require('expo-secure-store');
      return {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };
    })();

/**
 * Hard timeout for every Supabase REST/auth/storage request. Without it a
 * request that hits a dead network (cellular handoff, captive portal,
 * backgrounded socket) can hang indefinitely — supabase-js never rejects,
 * so any `isSubmitting` flag guarding a button stays true forever. 15s is
 * generous for mobile latency while still unsticking the UI within one
 * "is this broken?" moment.
 */
const FETCH_TIMEOUT_MS = 15_000;

/**
 * fetch wrapper passed to createClient via `global.fetch`. Aborts the
 * request after FETCH_TIMEOUT_MS, while still honouring any caller-supplied
 * AbortSignal (e.g. `.abortSignal()` on a PostgREST builder) — whichever
 * fires first wins.
 */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  // Forward an upstream abort (caller's own signal) into our controller so
  // both cancellation paths funnel through the single signal we pass down.
  const upstream = init?.signal ?? undefined;
  const forwardAbort = () => controller.abort();
  if (upstream) {
    if (upstream.aborted) controller.abort();
    else upstream.addEventListener('abort', forwardAbort);
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    upstream?.removeEventListener('abort', forwardAbort);
  });
};

export const supabase = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
  global: {
    fetch: fetchWithTimeout,
  },
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    // On web, this tells supabase-js to look at window.location for OAuth
    // tokens after a provider redirect, store them via `storage`, fire
    // SIGNED_IN through onAuthStateChange, and clean the hash out of the
    // URL. Without it (i.e. set to false), Google's #access_token=... hash
    // would just sit there and the user would never appear signed-in.
    // On native this flag is effectively a no-op (no URL to parse) — the
    // signInWithGoogle service uses WebBrowser + setSession() directly.
    detectSessionInUrl: true,
  },
});
