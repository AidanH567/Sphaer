import { supabase } from '@/lib/supabase';

/**
 * Permanently delete the current user's account: data + auth row.
 *
 * Invokes the `delete-account` edge function, which uses the service role to:
 *   1. Best-effort delete the caller's storage objects (avatars, gallery
 *      images, posters on events they created, circle images on circles they
 *      created).
 *   2. Call `auth.admin.deleteUser(userId)`. The schema cascades that single
 *      auth-row delete down through `profiles` and every table that references
 *      `profiles(id)` ON DELETE CASCADE (events, registrations, follows,
 *      circle membership, messages, message-read state, notifications,
 *      profile_images — see the edge function for the full list).
 *
 * Returns void on success; throws on failure so the UI can surface the error
 * via the ConfirmSheet's built-in error alert.
 *
 * The caller is responsible for `signOut()` + redirecting after this resolves.
 * The local session is no longer valid once the auth row is gone — any
 * follow-up Supabase call will reject with "JWT expired".
 */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{
    success?: boolean;
    error?: string;
  }>('delete-account', {
    method: 'POST',
  });

  if (error) {
    // FunctionsHttpError / FunctionsRelayError / FunctionsFetchError — surface
    // the response body's `error` field when present (the edge function
    // returns structured JSON errors), else fall back to error.message.
    const bodyError =
      data && typeof data === 'object' && 'error' in data
        ? (data as { error?: string }).error
        : undefined;
    throw new Error(bodyError || error.message || 'Account deletion failed.');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Account deletion did not complete.');
  }
}
