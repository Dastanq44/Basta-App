import { useInfiniteQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import type { GlobalPost } from '@/entities';
import { GLOBAL_FEED_PAGE_SIZE, listGlobalSubmissions, type GlobalFeedCursor } from '../api';

export const globalFeedQueryKey = ['global-feed'] as const;

/**
 * Infinite, chronological Global feed. Cursor = the last post's `{ createdAt, id }` (stable
 * `(created_at, id)` keyset server-side, so equal timestamps never skip/duplicate). A short page
 * (< PAGE_SIZE) means we've reached the end. Server enforces visibility — no client-side filtering.
 */
export function useGlobalFeed() {
  const session = useSession();
  return useInfiniteQuery({
    queryKey: globalFeedQueryKey,
    queryFn: ({ pageParam }) => listGlobalSubmissions(pageParam),
    initialPageParam: undefined as GlobalFeedCursor | undefined,
    getNextPageParam: (lastPage: GlobalPost[]): GlobalFeedCursor | undefined => {
      if (lastPage.length < GLOBAL_FEED_PAGE_SIZE) return undefined;
      const last = lastPage[lastPage.length - 1];
      return last ? { createdAt: last.createdAt, id: last.id } : undefined;
    },
    enabled: session.status === 'signedIn',
    staleTime: 30_000,
  });
}
