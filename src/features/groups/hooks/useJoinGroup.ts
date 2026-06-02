import { useMutation, useQueryClient } from '@tanstack/react-query';
import { joinGroupByInvite } from '../api';
import { myGroupsQueryKey } from './useMyGroups';

export function useJoinGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => joinGroupByInvite(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: myGroupsQueryKey }),
  });
}
