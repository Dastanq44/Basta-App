import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { fetchProfile } from '../api';

export const profileQueryKey = ['profile'] as const;

/**
 * Fetches the current user's profile. Only enabled when signed in — the gate switches the
 * query off for signed-out users so we don't spuriously hit RLS errors.
 *
 * `retry: 1` keeps the time-to-error short (initial + one retry ≈ 2s). The gate's error branch
 * routes the user to profile-setup as soon as `isError` flips, so the spinner doesn't linger.
 */
export function useProfile() {
  const session = useSession();
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: fetchProfile,
    enabled: session.status === 'signedIn',
    staleTime: 60_000,
    retry: 1,
  });
}
