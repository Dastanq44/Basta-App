import { z } from 'zod';

export const CHALLENGE_CATEGORIES = [
  'fitness',
  'reading',
  'meditation',
  'creativity',
  'study',
  'language',
  'other',
] as const;
export type ChallengeCategory = (typeof CHALLENGE_CATEGORIES)[number];

export const createChallengeInput = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100, 'At most 100 characters'),
  category: z.enum(CHALLENGE_CATEGORIES, {
    errorMap: () => ({ message: 'Pick a category' }),
  }),
  mode: z.enum(['solo', 'group']),
  /** ISO date YYYY-MM-DD (local). */
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a start date'),
  durationDays: z
    .number()
    .int('Must be a whole number')
    .min(1, 'At least 1 day')
    .max(365, 'At most 365 days'),
  proofRequirement: z
    .string()
    .trim()
    .max(280, 'At most 280 characters')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  /** Required when mode === 'group'. */
  groupId: z.string().uuid().nullable().optional(),
});
export type CreateChallengeInput = z.infer<typeof createChallengeInput>;
