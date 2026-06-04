import { useQuery } from '@tanstack/react-query';
import { getGroupOverview } from '../api';

export const groupOverviewQueryKey = (groupId: string) => ['groupOverview', groupId] as const;

/** Main-info extras for a group (description / avatar / created_at / member count). */
export function useGroupOverview(groupId?: string) {
  return useQuery({
    queryKey: groupOverviewQueryKey(groupId ?? ''),
    queryFn: () => getGroupOverview(groupId as string),
    enabled: !!groupId,
    staleTime: 60_000,
  });
}
