import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { getChallenge } from '../api';

export const challengeQueryKey = (id: string) => ['challenge', id] as const;

export function useChallenge(id: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: challengeQueryKey(id ?? ''),
    queryFn: () => getChallenge(id!),
    enabled: session.status === 'signedIn' && !!id,
    staleTime: 60_000,
    retry: 1,
  });
}
