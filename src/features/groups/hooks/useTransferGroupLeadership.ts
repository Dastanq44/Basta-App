import { useMutation, useQueryClient } from '@tanstack/react-query';
import { transferGroupLeadership } from '../api';
import { myGroupsQueryKey } from './useMyGroups';

/** Transfer group leadership to another member. Invalidates `useMyGroups` so the new
 *  `ownerId` (and therefore the crown badge + owner-only affordances) refreshes
 *  immediately on the previous owner's device. */
export function useTransferGroupLeadership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, newOwnerId }: { groupId: string; newOwnerId: string }) =>
      transferGroupLeadership(groupId, newOwnerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: myGroupsQueryKey });
    },
  });
}
