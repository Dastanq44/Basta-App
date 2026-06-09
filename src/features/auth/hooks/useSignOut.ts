import { useMutation, useQueryClient } from '@tanstack/react-query';
import { push } from '@/services/notifications';
import { signOut } from '../api';

/**
 * Signs the user out AND clears the server-cache. Without the clear, a different user signing
 * in next inherits cached entries (e.g. the previous user's `profile`) for up to `staleTime` —
 * a real data-leak surface. The auth state itself is purged by Supabase (SecureStore-backed).
 *
 * Also unregisters the cached push token (T-050A) so the server stops dispatching to a
 * device whose user just signed out. The unregister MUST run before `supabase.auth.signOut()`
 * because the RPC's `auth.uid()` resolves to the signed-in identity at call time.
 */
export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Best-effort revoke of the cached token before tearing down the session. If the
      // RPC fails (offline, server down) the cache is still cleared inside
      // `push.unregisterCurrent`, so the next sign-in path can register a fresh token.
      await push.unregisterCurrent();
      await signOut();
    },
    // Always clear, even if signOut throws — the local session may still have been cleared.
    onSettled: () => qc.clear(),
  });
}
