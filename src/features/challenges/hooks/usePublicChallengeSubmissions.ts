import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { listPublicChallengeSubmissions } from '../api';

export const publicChallengeSubmissionsQueryKey = (id: string) =>
  ['public-challenge-submissions', id] as const;

/** Public-preview submissions for a challenge (the globally-visible verified ones for non-members). */
export function usePublicChallengeSubmissions(challengeId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: publicChallengeSubmissionsQueryKey(challengeId ?? ''),
    queryFn: () => listPublicChallengeSubmissions(challengeId!),
    enabled: session.status === 'signedIn' && !!challengeId,
    staleTime: 30_000,
    retry: 1,
  });
}
