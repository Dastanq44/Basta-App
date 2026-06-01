import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email');
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters');

export const signUpInput = z.object({ email: emailSchema, password: passwordSchema });
export const signInInput = z.object({ email: emailSchema, password: passwordSchema });
// Supabase's signup OTP length is configurable in Project → Auth → Settings (4–10 digits).
// We accept the full configurable range here so the client adapts to whatever the project is
// set to, rather than pinning a length that won't match the email the user actually receives.
export const OTP_MIN_LENGTH = 4;
export const OTP_MAX_LENGTH = 10;
export const verifyOtpInput = z.object({
  email: emailSchema,
  token: z
    .string()
    .trim()
    .regex(
      new RegExp(`^\\d{${OTP_MIN_LENGTH},${OTP_MAX_LENGTH}}$`),
      `Enter the code from your email (${OTP_MIN_LENGTH}–${OTP_MAX_LENGTH} digits)`,
    ),
});

export const forgotPasswordInput = z.object({ email: emailSchema });
export const resetPasswordInput = z.object({ password: passwordSchema });

export type SignUpInput = z.infer<typeof signUpInput>;
export type SignInInput = z.infer<typeof signInInput>;
export type VerifyOtpInput = z.infer<typeof verifyOtpInput>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInput>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInput>;
