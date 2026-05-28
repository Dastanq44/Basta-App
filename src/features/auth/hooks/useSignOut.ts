import { useMutation, useQueryClient } from '@tanstack/react-query';
import { signOut } from '../api';

/**
 * Signs the user out AND clears the server-cache. Without the clear, a different user signing
 * in next inherits cached entries (e.g. the previous user's `profile`) for up to `staleTime` —
 * a real data-leak surface. The auth state itself is purged by Supabase (SecureStore-backed).
 */
export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    // Always clear, even if signOut throws — the local session may still have been cleared.
    onSettled: () => qc.clear(),
  });
}
