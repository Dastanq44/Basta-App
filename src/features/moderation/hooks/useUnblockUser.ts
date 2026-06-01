import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unblockUser } from '../api';
import { myBlocksQueryKey } from './useMyBlocks';

export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => unblockUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: myBlocksQueryKey }),
  });
}
