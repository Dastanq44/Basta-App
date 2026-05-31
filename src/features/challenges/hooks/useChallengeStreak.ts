import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { getChallengeStreak } from '../api';

export const challengeStreakQueryKey = (challengeId: string) =>
  ['challenge-streak', challengeId] as const;

/** Current user's server-authoritative streak on a challenge. */
export function useChallengeStreak(challengeId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: challengeStreakQueryKey(challengeId ?? ''),
    queryFn: () => getChallengeStreak(challengeId!),
    enabled: session.status === 'signedIn' && !!challengeId,
    staleTime: 15_000,
    retry: 1,
  });
}
