import type { SubmissionId } from './submission';
import type { UserId } from './user';

/** A short comment on a submission (≤280 chars). */
export type SubmissionComment = {
  id: string;
  submissionId: SubmissionId;
  authorId: UserId;
  /** displayName || username, resolved at the data boundary. */
  authorName?: string;
  body: string;
  createdAt: string;
};
