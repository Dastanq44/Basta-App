import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveGroup } from '../api';
import { myGroupsQueryKey } from './useMyGroups';

export function useLeaveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => leaveGroup(groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: myGroupsQueryKey }),
  });
}
