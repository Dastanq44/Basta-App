import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { getGroupLeaderboard } from '../api';

export const groupLeaderboardQueryKey = (groupId: string) => ['leaderboard', groupId] as const;

/** Server-authoritative group leaderboard (ranked by verified proofs). */
export function useGroupLeaderboard(groupId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: groupLeaderboardQueryKey(groupId ?? ''),
    queryFn: () => getGroupLeaderboard(groupId!),
    enabled: session.status === 'signedIn' && !!groupId,
    staleTime: 30_000,
    retry: 1,
  });
}
