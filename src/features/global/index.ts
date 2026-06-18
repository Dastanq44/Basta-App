// Feature: global — the Global feed (v1: chronological PUBLIC VERIFIED submissions only).
// No challenge/group/profile discovery, no ranking/trending. Server-enforced visibility.
export { useGlobalFeed, globalFeedQueryKey } from './hooks';
export { listGlobalSubmissions, GLOBAL_FEED_PAGE_SIZE } from './api';
export { GlobalFeedCard } from './ui';
export type { GlobalFeedCardProps } from './ui';
