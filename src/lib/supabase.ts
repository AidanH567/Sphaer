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
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const SecureStore = require('expo-secure-store');
      return {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };
    })();

export const supabase = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
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
