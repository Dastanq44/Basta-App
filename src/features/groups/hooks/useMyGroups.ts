import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { listMyGroups } from '../api';

export const myGroupsQueryKey = ['groups', 'mine'] as const;

export function useMyGroups() {
  const session = useSession();
  return useQuery({
    queryKey: myGroupsQueryKey,
    queryFn: listMyGroups,
    enabled: session.status === 'signedIn',
    staleTime: 60_000,
    retry: 1,
  });
}
