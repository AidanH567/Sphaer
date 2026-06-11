export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  berlin: {
    lat: 52.52,
    lng: 13.405,
    latitudeDelta: 0.12,
    longitudeDelta: 0.06,
  },
} as const;

/** Required EXPO_PUBLIC_* vars and the config values they populate. */
const REQUIRED_ENV: Record<string, string> = {
  EXPO_PUBLIC_SUPABASE_URL: config.supabaseUrl,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: config.supabaseAnonKey,
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: config.googleMapsApiKey,
};

// Jest (jest-expo) runs without .env.local — never enforce there.
const isTestEnv =
  process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

// `__DEV__` is a React Native global; guard so plain Node (tsx scripts)
// can import this module too.
const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

let hasReportedMissingEnv = false;

/**
 * Checks that every required EXPO_PUBLIC_* variable is set and returns the
 * names of any that are missing.
 *
 * - In development, throws a descriptive Error so a misconfigured env
 *   surfaces immediately (red box) instead of as cryptic network failures.
 * - In production, logs a single console.error — crashing a shipped app
 *   over config would be worse than degraded features.
 * - Under Jest, only reports; never throws or logs.
 */
export function validateConfig(): string[] {
  const missing = Object.entries(REQUIRED_ENV)
    .filter(([, value]) => value === '')
    .map(([key]) => key);

  if (missing.length === 0 || isTestEnv) {
    return missing;
  }

  const message =
    `[Sphaer] Missing required environment variable${missing.length > 1 ? 's' : ''}: ` +
    `${missing.join(', ')}. ` +
    'Copy .env.example to .env.local, fill in the values, and restart the dev server ' +
    '(env vars are inlined at bundle time).';

  if (isDev) {
    throw new Error(message);
  }

  if (!hasReportedMissingEnv) {
    hasReportedMissingEnv = true;
    console.error(message);
  }

  return missing;
}

// Run at module scope so any import of `config` surfaces a bad env.
validateConfig();
