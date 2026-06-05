import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { listMyRecentSubmissions } from '../api';

export const myRecentSubmissionsQueryKey = ['submissions', 'mine'] as const;

/** All of the current user's recent submissions across all challenges — feeds the
 *  Submissions tab on the Profile screen. */
export function useMyRecentSubmissions() {
  const session = useSession();
  return useQuery({
    queryKey: myRecentSubmissionsQueryKey,
    queryFn: () => listMyRecentSubmissions(50),
    enabled: session.status === 'signedIn',
    staleTime: 30_000,
    retry: 1,
  });
}
