// Fixed, motivational reaction set (one per user per submission). Keep it small.
export const REACTION_EMOJIS = ['🔥', '👏', '💪', '❤️'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** Aggregated reactions for a submission, plus the current user's own choice (if any). */
export type ReactionSummary = {
  counts: Record<string, number>;
  total: number;
  mine?: string;
};
