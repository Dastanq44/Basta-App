import type { GroupId } from './group';
import type { UserId } from './user';

export type ChallengeId = string;
export type ChallengeMode = 'solo' | 'group';

export type Challenge = {
  id: ChallengeId;
  /** null for solo challenges. */
  groupId: GroupId | null;
  creatorId: UserId;
  title: string;
  category: string;
  mode: ChallengeMode;
  startDate: string; // ISO date
  durationDays: number;
  proofRequirement?: string;
  verificationThreshold: number;
  /** Set when the creator archives the challenge; consumers exclude archived from active lists. */
  archivedAt?: string;
  /** Whether the challenge is publicly discoverable (Global). Maps to `challenges.visibility`
   *  ('public' ⇒ true). Default private. */
  isPublic: boolean;
};
