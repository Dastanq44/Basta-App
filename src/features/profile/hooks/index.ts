import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { getProfileOverview, listViewableUserChallenges, listViewableUserGroups } from '../api';

export const profileOverviewQueryKey = (userId: string) => ['profile-overview', userId] as const;
export const userChallengesQueryKey = (userId: string) => ['user-challenges', userId] as const;
export const userGroupsQueryKey = (userId: string) => ['user-groups', userId] as const;

/** Stats row for a profile (streaks + visible challenge/group counts). `data === null` ⇒ private. */
export function useProfileOverview(userId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: profileOverviewQueryKey(userId ?? ''),
    queryFn: () => getProfileOverview(userId!),
    enabled: session.status === 'signedIn' && !!userId,
    staleTime: 30_000,
    retry: 1,
  });
}

/** Challenges the viewer may see for a profile (Challenges tab). */
export function useViewableUserChallenges(userId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: userChallengesQueryKey(userId ?? ''),
    queryFn: () => listViewableUserChallenges(userId!),
    enabled: session.status === 'signedIn' && !!userId,
    staleTime: 30_000,
    retry: 1,
  });
}

/** Groups the viewer may see for a profile (Groups tab). */
export function useViewableUserGroups(userId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: userGroupsQueryKey(userId ?? ''),
    queryFn: () => listViewableUserGroups(userId!),
    enabled: session.status === 'signedIn' && !!userId,
    staleTime: 30_000,
    retry: 1,
  });
}
