import { useMutation, useQueryClient } from '@tanstack/react-query';
import { archiveGroup } from '../api';
import { myGroupsQueryKey } from './useMyGroups';

export function useArchiveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => archiveGroup(groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: myGroupsQueryKey }),
  });
}
