import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteChallenge } from '../api';
import { challengesQueryKey } from './useChallenges';

/** Creator permanently deletes a challenge. Invalidates the challenges list on success. */
export function useDeleteChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) => deleteChallenge(challengeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: challengesQueryKey }),
  });
}
