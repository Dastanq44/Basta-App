// Feature: auth — email registration/login (PKCE), session, profile setup, terms gate.
// Public surface only. Internals (api/, hooks/, model/) MUST NOT be imported directly.
export {
  useSession,
  SessionProvider,
  useSignIn,
  useSignUp,
  useVerifyOtp,
  useSignOut,
  useRequestPasswordReset,
  useUpdatePassword,
  type SessionState,
} from './hooks';
export {
  signInInput,
  signUpInput,
  verifyOtpInput,
  forgotPasswordInput,
  resetPasswordInput,
  OTP_MIN_LENGTH,
  OTP_MAX_LENGTH,
} from './model';
export type {
  SignInInput,
  SignUpInput,
  VerifyOtpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from './model';
