import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restoreGroup } from '../api';
import { myArchivedGroupsQueryKey } from './useMyArchivedGroups';
import { myGroupsQueryKey } from './useMyGroups';

export function useRestoreGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => restoreGroup(groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: myGroupsQueryKey });
      qc.invalidateQueries({ queryKey: myArchivedGroupsQueryKey });
    },
  });
}
