import type { ChallengeId } from './challenge';
import type { UserId } from './user';

export type SubmissionId = string;

/**
 * Lifecycle of a submission. Client-only states (`draft`, `queued`, `uploading`, `failed`,
 * `offline_retry`, `synced`) precede / surround the server-owned ones (`pending_verification`,
 * `verified`, `rejected`). See docs/architecture/OFFLINE_SYNC.md and the SyncBadge UI.
 *
 * `synced` is a transient bridge: the client has had its upload acknowledged but the cache
 * hasn't yet reconciled to the server-side `pending_verification`.
 */
export type SyncStatus =
  | 'draft'
  | 'queued'
  | 'uploading'
  | 'synced'
  | 'pending_verification'
  | 'verified'
  | 'rejected'
  | 'failed'
  | 'offline_retry';

/** Server-owned status as stored in `submissions.status`. */
export type ServerSubmissionStatus = 'pending_verification' | 'verified' | 'rejected';

export type Submission = {
  /** Client-generated UUID (idempotency key) — see DECISIONS.md D-004. */
  id: SubmissionId;
  challengeId: ChallengeId;
  authorId: UserId;
  /** Server-assigned day index from startDate in the author's timezone (D-003). */
  challengeDay: number;
  /** User-supplied short title shown as the row's primary line. 1..80 chars; required since W-034. */
  title: string;
  comment?: string;
  /** Local sandbox URI while offline. */
  mediaLocalUri?: string;
  /** Remote Storage path once uploaded. */
  mediaRemotePath?: string;
  status: SyncStatus;
  createdAt: string;
  /**
   * Author display fields. Present when the submission was read via a server RPC that
   * joins `profiles` (list_challenge_submissions / get_submission_with_author).
   * Absent on locally-queued submissions and on read paths that don't need the name
   * (e.g. getMyTodaySubmission, where the author is always the current user).
   */
  authorUsername?: string;
  authorDisplayName?: string;
  /**
   * Joined challenge / group context. Present when the submission was read via a path
   * that joins the parent challenge (`listMyRecentSubmissions` does PostgREST resource
   * expansion). `challengeGroupName` is only set when the parent challenge is a group
   * challenge (otherwise the challenge has no host group).
   */
  challengeTitle?: string;
  challengeGroupName?: string;
};
