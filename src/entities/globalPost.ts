import type { ChallengeId } from './challenge';
import type { GroupId } from './group';
import type { SubmissionId } from './submission';
import type { UserId } from './user';

/**
 * A single post in the Global feed — a public, verified submission joined with its author and
 * challenge/group context. Read-only projection returned by the `list_global_submissions` RPC
 * (Global v1, chronological public verified submissions only — no discovery/ranking). Distinct
 * from `Submission`: it always carries author + challenge identity and the social counts, and is
 * never written by the client.
 */
export type GlobalPost = {
  id: SubmissionId;
  challengeId: ChallengeId;
  authorId: UserId;
  title: string;
  comment?: string;
  /** Storage path in the private `proof-media` bucket — resolve via a signed URL to display. */
  mediaPath?: string;
  createdAt: string;
  /** Server-assigned day index from the challenge start (D-003). */
  challengeDay: number;
  authorUsername?: string;
  authorDisplayName?: string;
  /** Storage path in the public `user-avatars` bucket — resolve via `userAvatarUrl`. */
  authorAvatarPath?: string;
  challengeTitle: string;
  challengeCategory: string;
  /** Present only for group challenges. */
  groupId?: GroupId;
  groupName?: string;
  reactionCount: number;
  commentCount: number;
};
