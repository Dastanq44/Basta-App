import { useInfiniteQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import type { GlobalPost } from '@/entities';
import { GLOBAL_FEED_PAGE_SIZE, listGlobalSubmissions } from '../api';

export const globalFeedQueryKey = ['global-feed'] as const;

/**
 * Infinite, chronological Global feed. Cursor = the `createdAt` of the last loaded post
 * (`created_at < before` server-side). A short page (< PAGE_SIZE) means we've reached the end.
 * Server enforces visibility — there is no client-side privacy filtering here.
 */
export function useGlobalFeed() {
  const session = useSession();
  return useInfiniteQuery({
    queryKey: globalFeedQueryKey,
    queryFn: ({ pageParam }) => listGlobalSubmissions(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: GlobalPost[]) =>
      lastPage.length < GLOBAL_FEED_PAGE_SIZE ? undefined : lastPage[lastPage.length - 1]?.createdAt,
    enabled: session.status === 'signedIn',
    staleTime: 30_000,
  });
}
