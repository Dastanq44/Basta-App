import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateMyProfile, type UpdateMyProfilePayload } from '../api';
import { profileQueryKey } from './useProfile';

/** Update the editable parts of the current user's profile (name, username, description,
 *  avatar). Invalidates the profile query so the new values are immediately reflected. */
export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateMyProfilePayload) => updateMyProfile(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}
