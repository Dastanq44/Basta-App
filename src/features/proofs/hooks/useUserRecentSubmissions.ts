import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { listUserRecentSubmissions } from '../api';

export const userRecentSubmissionsQueryKey = (userId: string) =>
  ['submissions', 'user', userId] as const;

/** Recent submissions of ANY user — for the read-only user profile route (T-053-D).
 *  RLS limits the rows to challenges the caller participates in. */
export function useUserRecentSubmissions(userId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: userRecentSubmissionsQueryKey(userId ?? ''),
    queryFn: () => listUserRecentSubmissions(userId!, 50),
    enabled: session.status === 'signedIn' && !!userId,
    staleTime: 30_000,
    retry: 1,
  });
}
