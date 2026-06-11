import type { SubmissionId } from './submission';
import type { UserId } from './user';

/** A short comment on a submission (≤280 chars). */
export type SubmissionComment = {
  id: string;
  submissionId: SubmissionId;
  authorId: UserId;
  /** Raw username (for @handle fallback) and displayName, resolved at the data boundary. */
  authorUsername?: string;
  authorDisplayName?: string;
  /** displayName || @username, resolved at the data boundary. */
  authorName?: string;
  body: string;
  createdAt: string;
  /** Per-row like aggregate populated by `list_submission_comments` (W-035). */
  likesCount: number;
  likedByMe: boolean;
};

/** A row from `list_comment_likers` — who liked a comment. */
export type CommentLiker = {
  userId: UserId;
  username?: string;
  displayName?: string;
  likedAt: string;
};
