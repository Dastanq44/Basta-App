import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateChallenge } from '../api';
import type { UpdateChallengeInput } from '../model';
import { challengesQueryKey } from './useChallenges';
import { challengeQueryKey } from './useChallenge';

/** Edit a challenge's mutable fields. Invalidates list + detail so the new metadata
 *  shows up wherever the challenge is referenced. */
export function useUpdateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, input }: { challengeId: string; input: UpdateChallengeInput }) =>
      updateChallenge(challengeId, input),
    onSuccess: (_data, { challengeId }) => {
      qc.invalidateQueries({ queryKey: challengesQueryKey });
      qc.invalidateQueries({ queryKey: challengeQueryKey(challengeId) });
    },
  });
}
