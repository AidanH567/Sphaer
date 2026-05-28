import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '@/lib/supabase';

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  // The DB trigger `handle_new_user` reads `display_name` out of the auth
  // user's raw_user_meta_data and inserts the matching profiles row.
  // See: supabase/migrations/20260527000000_profile_v2.sql
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

/* ── Google OAuth ───────────────────────────────────────── */

// Required for the OAuth browser redirect to close cleanly on iOS.
WebBrowser.maybeCompleteAuthSession();

/**
 * Start a Google sign-in flow. Cross-platform:
 *   - Web: hands off to Supabase's full-page redirect — Supabase brings the
 *     user back to the app with a session already populated.
 *   - Native: opens an in-app browser tab via expo-web-browser. After the
 *     user finishes the Google flow, the redirect URL carries access &
 *     refresh tokens in the URL fragment which we feed into setSession.
 *
 * Requires (one-time dashboard work, see commit message):
 *   - Google Cloud OAuth client + Client ID/Secret in Supabase Auth
 *   - The platform-appropriate redirect URL in Supabase Auth → URL
 *     Configuration → Redirect URLs allowlist:
 *       web: http://localhost:8081 (dev) + production web URL
 *       native: sphaer://auth/callback
 */
export async function signInWithGoogle(): Promise<void> {
  // Force Google to always show the account chooser, even if the user is
  // already signed in to a single Google account in this browser session.
  // Without `prompt=select_account`, Google silently re-authorizes the
  // most-recent account — that's "correct" OAuth behavior, but during
  // testing (and for users with multiple Google accounts) it's confusing.
  const googleQueryParams = { prompt: 'select_account' };

  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        queryParams: googleQueryParams,
      },
    });
    if (error) throw error;
    // The browser is now navigating to Google. When it returns to
    // redirectTo with `#access_token=...&refresh_token=...` in the URL,
    // supabase-js (with `detectSessionInUrl: true` in src/lib/supabase.ts)
    // parses the hash, stores the session, fires SIGNED_IN through
    // onAuthStateChange, and clears the hash from the URL. The
    // app/(auth)/_layout.tsx redirect then sends the user to /(tabs)/feed.
    // Nothing else for us to do here.
    return;
  }

  // Native: build a deep-link redirect, ask Supabase for the OAuth URL,
  // open it in an in-app browser, parse the tokens out of the return URL,
  // then explicitly set the session on the supabase client.
  const redirectUrl = AuthSession.makeRedirectUri({
    scheme: 'sphaer',
    path: 'auth/callback',
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
      queryParams: googleQueryParams,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Google sign-in could not start (no OAuth URL).');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
  if (result.type !== 'success' || !result.url) {
    // User dismissed the sheet
    throw new Error('Google sign-in cancelled.');
  }

  const tokens = parseAuthTokensFromUrl(result.url);
  if (!tokens) {
    throw new Error('Google sign-in did not return a session.');
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
  if (sessionError) throw sessionError;
}

/**
 * Pull the access_token + refresh_token out of an OAuth return URL. The
 * tokens come back in the URL fragment (after #), not the query string.
 */
function parseAuthTokensFromUrl(url: string): { access_token: string; refresh_token: string } | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;
  const fragment = url.slice(hashIndex + 1);
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}
