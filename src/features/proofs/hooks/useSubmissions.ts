import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { listSubmissionsForChallenge } from '../api';

export const submissionsQueryKey = (challengeId: string) =>
  ['submissions', challengeId] as const;

export function useSubmissions(challengeId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: submissionsQueryKey(challengeId ?? ''),
    queryFn: () => listSubmissionsForChallenge(challengeId!),
    enabled: session.status === 'signedIn' && !!challengeId,
    staleTime: 30_000,
    retry: 1,
  });
}
