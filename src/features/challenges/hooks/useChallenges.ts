import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { listMyChallenges } from '../api';

export const challengesQueryKey = ['challenges'] as const;

export function useChallenges() {
  const session = useSession();
  return useQuery({
    queryKey: challengesQueryKey,
    queryFn: listMyChallenges,
    enabled: session.status === 'signedIn',
    staleTime: 60_000,
    retry: 1,
  });
}
