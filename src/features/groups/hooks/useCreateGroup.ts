import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createGroup } from '../api';
import { myGroupsQueryKey } from './useMyGroups';

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createGroup(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: myGroupsQueryKey }),
  });
}
