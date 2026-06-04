import { useQuery } from '@tanstack/react-query';
import { getHomeOverview, listPendingVerifications } from '../api';

export const homeOverviewQueryKey = ['homeOverview'] as const;
export const pendingVerificationsQueryKey = ['pendingVerifications'] as const;

/** Home summary (streak, week progress, today's tasks, pending-verify count). */
export function useHomeOverview() {
  return useQuery({ queryKey: homeOverviewQueryKey, queryFn: getHomeOverview });
}

/** The "Verify a friend" inbox list. */
export function usePendingVerifications() {
  return useQuery({ queryKey: pendingVerificationsQueryKey, queryFn: listPendingVerifications });
}
