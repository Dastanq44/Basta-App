import { useMutation, useQueryClient } from '@tanstack/react-query';
import { completeOnboarding } from '../api';
import { profileQueryKey } from './useProfile';

/**
 * Flips `profiles.onboarded` to true. Called from group create/join after that succeeds.
 * Server is the source of truth — we update the local cache from the returned row, not
 * from optimistic state.
 */
export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: completeOnboarding,
    onSuccess: (user) => {
      qc.setQueryData(profileQueryKey, user);
    },
  });
}
