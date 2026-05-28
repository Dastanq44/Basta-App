import { useMutation } from '@tanstack/react-query';
import { createGroup } from '../api';

export function useCreateGroup() {
  return useMutation({ mutationFn: (name: string) => createGroup(name) });
}
