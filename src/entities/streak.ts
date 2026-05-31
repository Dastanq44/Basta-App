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
