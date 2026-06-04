import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { listChallengeStreaks } from '../api';

export const challengeStreaksQueryKey = (challengeId: string) =>
  ['challenge-streaks', challengeId] as const;

/** Per-participant streaks for a challenge (group members for group; just self for solo).
 *  Backs the "other contestants" ribbon on the challenge detail screen. */
export function useChallengeStreaks(challengeId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: challengeStreaksQueryKey(challengeId ?? ''),
    queryFn: () => listChallengeStreaks(challengeId!),
    enabled: session.status === 'signedIn' && !!challengeId,
    staleTime: 30_000,
    retry: 1,
  });
}
