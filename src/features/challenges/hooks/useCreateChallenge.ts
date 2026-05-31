import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createChallenge } from '../api';
import type { CreateChallengeInput } from '../model';
import { challengesQueryKey } from './useChallenges';

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChallengeInput) => createChallenge(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: challengesQueryKey });
    },
  });
}
