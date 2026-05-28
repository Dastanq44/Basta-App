import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email');
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters');

export const signUpInput = z.object({ email: emailSchema, password: passwordSchema });
export const signInInput = z.object({ email: emailSchema, password: passwordSchema });
export const verifyOtpInput = z.object({
  email: emailSchema,
  token: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export type SignUpInput = z.infer<typeof signUpInput>;
export type SignInInput = z.infer<typeof signInInput>;
export type VerifyOtpInput = z.infer<typeof verifyOtpInput>;
