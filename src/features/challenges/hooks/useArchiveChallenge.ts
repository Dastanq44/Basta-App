import { useMutation, useQueryClient } from '@tanstack/react-query';
import { archiveChallenge } from '../api';
import { challengesQueryKey } from './useChallenges';
import { challengeQueryKey } from './useChallenge';

export function useArchiveChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) => archiveChallenge(challengeId),
    onSuccess: (_data, challengeId) => {
      qc.invalidateQueries({ queryKey: challengesQueryKey });
      qc.invalidateQueries({ queryKey: challengeQueryKey(challengeId) });
    },
  });
}
