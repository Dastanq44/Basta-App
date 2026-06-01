import { useMutation } from '@tanstack/react-query';
import { exchangeCodeForSession, updatePassword } from '../api';

/**
 * Finishes a password-reset round-trip. If a `code` is passed (from the deep-link query
 * params), we exchange it for a recovery session first. Then we update the password.
 * Throws if neither a code is given nor a recovery session already exists.
 */
export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (input: { password: string; code?: string }) => {
      if (input.code) await exchangeCodeForSession(input.code);
      await updatePassword(input.password);
    },
  });
}
