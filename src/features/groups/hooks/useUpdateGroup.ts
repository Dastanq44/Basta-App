import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateGroup } from '../api';
import { myGroupsQueryKey } from './useMyGroups';
import { myArchivedGroupsQueryKey } from './useMyArchivedGroups';

/** Rename an active group. Invalidates both active + archived lists so the new name
 *  shows up everywhere the group is referenced. */
export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, name }: { groupId: string; name: string }) =>
      updateGroup(groupId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: myGroupsQueryKey });
      qc.invalidateQueries({ queryKey: myArchivedGroupsQueryKey });
    },
  });
}
