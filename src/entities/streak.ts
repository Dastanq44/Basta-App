/**
 * A user's streak on a challenge. Server-authoritative (D-003) — computed by the
 * `challenge_streak` RPC from verified submissions, never derived or stored on the client.
 */
export type ChallengeStreak = {
  /** Consecutive verified days ending today (or yesterday as a one-day grace). */
  current: number;
  /** Best consecutive run of verified days ever on this challenge. */
  longest: number;
  /** Whether today's proof is already verified. */
  todayDone: boolean;
};

/**
 * Per-participant streak entry for the "other contestants" ribbon on the challenge
 * detail screen. One row per group member for group challenges (membership = participation
 * per T-027); just the caller for solo challenges. Produced by `list_challenge_streaks`.
 */
export type ContestantStreak = {
  userId: string;
  username?: string;
  displayName?: string;
  current: number;
  longest: number;
  todayDone: boolean;
};
