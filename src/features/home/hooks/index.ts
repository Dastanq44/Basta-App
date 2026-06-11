import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { getHomeOverview, getMyStreakAggregate, listPendingVerifications } from '../api';

export const homeOverviewQueryKey = ['homeOverview'] as const;
export const pendingVerificationsQueryKey = ['pendingVerifications'] as const;
export const myStreakAggregateQueryKey = ['my-streak-aggregate'] as const;

/** Home summary (streak, week progress, today's tasks, pending-verify count). */
export function useHomeOverview() {
  return useQuery({ queryKey: homeOverviewQueryKey, queryFn: getHomeOverview });
}

/** The "Verify a friend" inbox list. */
export function usePendingVerifications() {
  return useQuery({ queryKey: pendingVerificationsQueryKey, queryFn: listPendingVerifications });
}

/** Current + best streak across all the caller's challenges — for the Profile tiles (T-053-E). */
export function useMyStreakAggregate() {
  const session = useSession();
  return useQuery({
    queryKey: myStreakAggregateQueryKey,
    queryFn: getMyStreakAggregate,
    enabled: session.status === 'signedIn',
    staleTime: 30_000,
    retry: 1,
  });
}
