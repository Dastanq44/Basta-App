import { useMutation } from '@tanstack/react-query';
import { requestAccountDeletion } from '../api';

/**
 * Marks the user's account for deletion. Server is idempotent — if a pending request already
 * exists, the same id is returned (no duplicate). Hard deletion of `auth.users` + Storage
 * objects is a follow-up Edge Function with service-role; the mobile app does NOT have access.
 */
export function useRequestAccountDeletion() {
  return useMutation({ mutationFn: () => requestAccountDeletion() });
}
