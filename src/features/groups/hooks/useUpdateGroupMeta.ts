import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateGroupMeta } from '../api';
import { myGroupsQueryKey } from './useMyGroups';
import { myArchivedGroupsQueryKey } from './useMyArchivedGroups';
import { groupOverviewQueryKey } from './useGroupOverview';

/** Owner updates name + description + avatar. Invalidates the group lists + this group's overview. */
export function useUpdateGroupMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      name,
      description,
      avatarPath,
      isPublic,
    }: {
      groupId: string;
      name: string;
      description?: string | null;
      avatarPath?: string | null;
      isPublic?: boolean;
    }) => updateGroupMeta(groupId, { name, description, avatarPath, isPublic }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: myGroupsQueryKey });
      qc.invalidateQueries({ queryKey: myArchivedGroupsQueryKey });
      qc.invalidateQueries({ queryKey: groupOverviewQueryKey(v.groupId) });
    },
  });
}
