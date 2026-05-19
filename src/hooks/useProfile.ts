import { useEffect, useState } from 'react';
import * as profileService from '@/services/profile.service';
import type { ProfileWithCounts } from '@/types/user.types';

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<ProfileWithCounts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    profileService
      .getProfile(userId)
      .then(setProfile)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load profile'))
      .finally(() => setIsLoading(false));
  }, [userId]);

  return { profile, isLoading, error };
}
