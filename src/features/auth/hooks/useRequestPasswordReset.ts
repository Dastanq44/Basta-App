import { useMutation } from '@tanstack/react-query';
import { resetPasswordForEmail } from '../api';

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: (email: string) => resetPasswordForEmail(email) });
}
