import { useMutation, useQueryClient } from '@tanstack/react-query';
import { blockUser } from '../api';
import { myBlocksQueryKey } from './useMyBlocks';

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => blockUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: myBlocksQueryKey }),
  });
}
