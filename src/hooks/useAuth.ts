import { useState } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import * as authService from '@/services/auth.service';

export function useAuth() {
  const ctx = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signUp(email: string, password: string, username: string) {
    setIsLoading(true);
    setError(null);
    try {
      await authService.signUpWithEmail(email, password, username);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign up failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    setIsLoading(true);
    setError(null);
    try {
      await authService.signInWithEmail(email, password);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    setIsLoading(true);
    try {
      await authService.signOut();
    } finally {
      setIsLoading(false);
    }
  }

  return {
    session: ctx.session,
    user: ctx.user,
    profile: ctx.profile,
    isAuthLoading: ctx.isLoading,
    isLoading,
    error,
    signUp,
    signIn,
    signOut,
  };
}
