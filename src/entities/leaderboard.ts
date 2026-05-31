import type { UserId } from './user';

/**
 * One row of a group leaderboard. Server-authoritative (D-003) — produced by the
 * `group_leaderboard` RPC, ranked by verified-proof count. `rank` is assigned client-side
 * from the server's ordering (1-based).
 */
export type LeaderboardEntry = {
  userId: UserId;
  username?: string;
  displayName?: string;
  /** Number of verified proofs across the group's challenges. */
  verifiedCount: number;
  rank: number;
};
