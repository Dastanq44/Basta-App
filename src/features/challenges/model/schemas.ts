import { z } from 'zod';

export const CHALLENGE_CATEGORIES = [
  'fitness',
  'reading',
  'meditation',
  'creativity',
  'study',
  'language',
  'work',
  'other',
] as const;
export type ChallengeCategory = (typeof CHALLENGE_CATEGORIES)[number];

// Reusable field schemas — shared between create and edit so validation can't drift.
const challengeTitle = z.string().trim().min(1, 'Title is required').max(100, 'At most 100 characters');
const challengeCategory = z.enum(CHALLENGE_CATEGORIES, {
  errorMap: () => ({ message: 'Pick a category' }),
});
const challengeDurationDays = z
  .number()
  .int('Must be a whole number')
  .min(1, 'At least 1 day')
  .max(365, 'At most 365 days');
const challengeProofRequirement = z
  .string()
  .trim()
  .max(280, 'At most 280 characters')
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const createChallengeInput = z.object({
  title: challengeTitle,
  category: challengeCategory,
  mode: z.enum(['solo', 'group']),
  /** ISO date YYYY-MM-DD (local). */
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a start date'),
  durationDays: challengeDurationDays,
  proofRequirement: challengeProofRequirement,
  /** Required when mode === 'group'. */
  groupId: z.string().uuid().nullable().optional(),
});
export type CreateChallengeInput = z.infer<typeof createChallengeInput>;

/** Editable subset of a challenge. start_date / mode / group_id / threshold are intentionally
 *  out of scope: changing them would invalidate `submissions.challenge_day` or shift the
 *  challenge between groups, which would require migration of existing proofs. */
export const updateChallengeInput = z.object({
  title: challengeTitle,
  category: challengeCategory,
  durationDays: challengeDurationDays,
  proofRequirement: challengeProofRequirement,
});
export type UpdateChallengeInput = z.infer<typeof updateChallengeInput>;
