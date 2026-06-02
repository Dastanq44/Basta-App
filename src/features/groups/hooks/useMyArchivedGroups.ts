import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { listMyArchivedGroups } from '../api';

export const myArchivedGroupsQueryKey = ['groups', 'archived'] as const;

export function useMyArchivedGroups() {
  const session = useSession();
  return useQuery({
    queryKey: myArchivedGroupsQueryKey,
    queryFn: listMyArchivedGroups,
    enabled: session.status === 'signedIn',
    staleTime: 60_000,
    retry: 1,
  });
}
