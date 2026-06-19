import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { getPublicGroupLeaderboard } from '../api';

export const publicGroupLeaderboardQueryKey = (groupId: string) =>
  ['public-leaderboard', groupId] as const;

/** Group leaderboard for the public group preview (gated on `get_group_access`, member or public). */
export function usePublicGroupLeaderboard(groupId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: publicGroupLeaderboardQueryKey(groupId ?? ''),
    queryFn: () => getPublicGroupLeaderboard(groupId!),
    enabled: session.status === 'signedIn' && !!groupId,
    staleTime: 30_000,
    retry: 1,
  });
}
