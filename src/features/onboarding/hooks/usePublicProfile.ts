import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { fetchPublicProfile } from '../api';

export const publicProfileQueryKey = (userId: string) =>
  ['profile', 'public', userId] as const;

/** Another user's public profile fields (avatar / name / bio). T-053-D. */
export function usePublicProfile(userId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: publicProfileQueryKey(userId ?? ''),
    queryFn: () => fetchPublicProfile(userId!),
    enabled: session.status === 'signedIn' && !!userId,
    staleTime: 60_000,
    retry: 1,
  });
}
