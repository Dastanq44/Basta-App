import type { ChallengeId } from './challenge';
import type { UserId } from './user';

export type SubmissionId = string;

/**
 * Lifecycle of a submission. Local-only states (`draft`, `uploading`) precede the
 * server-owned ones; transport states (`failed`, `offline_retry`) are orthogonal.
 * Lives in the domain layer; the offline queue (infra) imports it from here, never
 * the other way around. See docs/architecture/OFFLINE_SYNC.md.
 */
export type SyncStatus =
  | 'draft'
  | 'uploading'
  | 'pending_verification'
  | 'verified'
  | 'rejected'
  | 'failed'
  | 'offline_retry';

export type Submission = {
  /** Client-generated UUID (idempotency key) — see DECISIONS.md D-004. */
  id: SubmissionId;
  challengeId: ChallengeId;
  authorId: UserId;
  /** Server-assigned day index from startDate in the author's timezone (D-003). */
  challengeDay: number;
  comment?: string;
  /** Local sandbox URI while offline. */
  mediaLocalUri?: string;
  /** Remote Storage path once uploaded. */
  mediaRemotePath?: string;
  status: SyncStatus;
  createdAt: string;
};
