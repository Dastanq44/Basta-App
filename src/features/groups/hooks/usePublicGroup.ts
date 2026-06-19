import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { getGroupAccess, listPublicGroupChallenges, listPublicGroupSubmissions } from '../api';

export const groupAccessQueryKey = (id: string) => ['group-access', id] as const;
export const publicGroupChallengesQueryKey = (id: string) => ['public-group-challenges', id] as const;
export const publicGroupSubmissionsQueryKey = (id: string) => ['public-group-submissions', id] as const;

/** How (if at all) the viewer can open a group: full member detail vs read-only public preview.
 *  `data === null` ⇒ not accessible. */
export function useGroupAccess(groupId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: groupAccessQueryKey(groupId ?? ''),
    queryFn: () => getGroupAccess(groupId!),
    enabled: session.status === 'signedIn' && !!groupId,
    staleTime: 30_000,
    retry: 1,
  });
}

export function usePublicGroupChallenges(groupId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: publicGroupChallengesQueryKey(groupId ?? ''),
    queryFn: () => listPublicGroupChallenges(groupId!),
    enabled: session.status === 'signedIn' && !!groupId,
    staleTime: 30_000,
    retry: 1,
  });
}

export function usePublicGroupSubmissions(groupId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: publicGroupSubmissionsQueryKey(groupId ?? ''),
    queryFn: () => listPublicGroupSubmissions(groupId!),
    enabled: session.status === 'signedIn' && !!groupId,
    staleTime: 30_000,
    retry: 1,
  });
}
