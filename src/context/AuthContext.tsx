import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/user.types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  setProfile: (profile: Profile | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  setProfile: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Bootstrap: read whatever session is persisted in storage and (if any)
    // fetch the matching profile. The finally inside fetchProfile flips
    // isLoading to false; the no-session branch flips it here.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        fetchProfile(data.session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Subsequent auth transitions. We discriminate on event type so a
    // SIGNED_IN flips isLoading back to true while the profile is being
    // refetched — without this, the (auth) layout's gate runs against a
    // stale `profile?.onboarding_completed` and routes a returning user
    // to /location for a frame before the real profile arrives.
    // TOKEN_REFRESHED leaves the profile alone (the row didn't change).
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      if (!newSession?.user) {
        // SIGNED_OUT or session went null for any other reason — clear
        // the profile so the gate can show the landing screen.
        setProfile(null);
        setIsLoading(false);
        return;
      }

      if (event === 'SIGNED_IN') {
        setIsLoading(true);
        fetchProfile(newSession.user.id);
        return;
      }

      // TOKEN_REFRESHED / USER_UPDATED / INITIAL_SESSION — session
      // changed but the profile row didn't. Leave it alone; the
      // bootstrap above already settled isLoading.
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    try {
      // `.maybeSingle()` returns data=null for 0 rows instead of throwing
      // a 406 like `.single()` does. We expect "row missing" as a valid
      // state for the safety-net path below.
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setProfile(data);
        return;
      }

      // Safety net: the handle_new_user DB trigger normally creates a
      // profile row on auth.users INSERT, but that can fail silently for
      // OAuth users whose row was created under an older trigger version,
      // or in any edge case where the trigger didn't run. Construct the
      // missing row here from auth user_metadata (Google supplies
      // full_name / name / picture; email signup supplies display_name).
      const { data: userData } = await supabase.auth.getUser();
      const meta = (userData.user?.user_metadata ?? {}) as Record<string, unknown>;
      const display_name =
        (meta.display_name as string | undefined) ??
        (meta.full_name as string | undefined) ??
        (meta.name as string | undefined) ??
        null;
      const avatar_url =
        (meta.avatar_url as string | undefined) ??
        (meta.picture as string | undefined) ??
        null;

      // `upsert + ignoreDuplicates` makes this safe against a trigger that
      // raced us — if the row got inserted between the select and the
      // insert, we don't error, we just re-fetch.
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          { id: userId, display_name, avatar_url },
          { onConflict: 'id', ignoreDuplicates: true },
        );
      if (upsertError) {
        console.warn('[AuthContext] safety-net profile upsert failed', upsertError);
        setProfile(null);
        return;
      }

      const { data: refetched } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      setProfile(refetched);
    } catch (e) {
      console.warn('[AuthContext] fetchProfile failed', e);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, isLoading, setProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
