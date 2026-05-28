import { useMutation } from '@tanstack/react-query';
import { joinGroupByInvite } from '../api';

export function useJoinGroup() {
  return useMutation({ mutationFn: (code: string) => joinGroupByInvite(code) });
}
