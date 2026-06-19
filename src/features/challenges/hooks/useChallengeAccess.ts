import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { getChallengeAccess } from '../api';

export const challengeAccessQueryKey = (id: string) => ['challenge-access', id] as const;

/** How (if at all) the viewer can open a challenge: full member detail vs read-only public preview.
 *  `data === null` ⇒ not accessible. */
export function useChallengeAccess(challengeId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: challengeAccessQueryKey(challengeId ?? ''),
    queryFn: () => getChallengeAccess(challengeId!),
    enabled: session.status === 'signedIn' && !!challengeId,
    staleTime: 30_000,
    retry: 1,
  });
}
