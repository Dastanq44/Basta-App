import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { getMyTodaySubmission } from '../api';

export const todaySubmissionQueryKey = (challengeId: string) =>
  ['submission', 'today', challengeId] as const;

export function useTodaySubmission(challengeId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: todaySubmissionQueryKey(challengeId ?? ''),
    queryFn: () => getMyTodaySubmission(challengeId!),
    enabled: session.status === 'signedIn' && !!challengeId,
    staleTime: 15_000,
    retry: 1,
  });
}
