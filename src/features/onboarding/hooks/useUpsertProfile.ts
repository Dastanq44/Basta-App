import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertProfile, type UpsertProfilePayload } from '../api';
import { profileQueryKey } from './useProfile';

export function useUpsertProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertProfilePayload) => upsertProfile(payload),
    onSuccess: (user) => {
      qc.setQueryData(profileQueryKey, user);
    },
  });
}
