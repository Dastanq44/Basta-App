import { z } from 'zod';

// Username: 3–30 chars, lowercase letters/digits/underscore. We trim+lowercase before validation
// so user typos in casing don't make different "users" of the same name.
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-z0-9_]+$/, 'Use letters, digits, and underscores only');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Display name is required')
  .max(50, 'Display name must be at most 50 characters');

/** Bio shown on the Profile tab — capped at 280 chars to match the server constraint. */
export const profileDescriptionSchema = z
  .string()
  .max(280, 'Description must be at most 280 characters');

export const profileSetupInput = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  timezone: z.string().min(1),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms to continue' }),
  }),
});
export type ProfileSetupInput = z.infer<typeof profileSetupInput>;
