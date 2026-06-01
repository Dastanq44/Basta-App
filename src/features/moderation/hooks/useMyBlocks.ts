import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { listMyBlocks } from '../api';

export const myBlocksQueryKey = ['blocks', 'mine'] as const;

/** Full list of blocked-user rows. Used by the blocked-users screen. */
export function useMyBlocks() {
  const session = useSession();
  return useQuery({
    queryKey: myBlocksQueryKey,
    queryFn: listMyBlocks,
    enabled: session.status === 'signedIn',
    staleTime: 30_000,
    retry: 1,
  });
}

/**
 * Memoized `Set<userId>` of users blocked by the current viewer — convenient for
 * O(1) `has()` lookups when client-filtering submission/comment authors.
 * Returns an empty set while loading or signed-out (fail-open: don't hide content
 * we can't yet confirm is blocked).
 */
export function useBlockedUserIds(): Set<string> {
  const q = useMyBlocks();
  return useMemo(() => new Set((q.data ?? []).map((b) => b.blockedId)), [q.data]);
}
