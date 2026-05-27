export type { SyncStatus, MutationType, QueuedMutation, QueueStore } from './types';
export { backoffDelay } from './types';
// Processor implementation lands in Phase 2 (critical path), once D-007 chooses the store.
