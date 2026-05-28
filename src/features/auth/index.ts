// Feature: auth — email registration/login (PKCE), session, profile setup, terms gate.
// Public surface only. Internals (api/, hooks/, model/) MUST NOT be imported directly.
export {
  useSession,
  useSignIn,
  useSignUp,
  useVerifyOtp,
  useSignOut,
  type SessionState,
} from './hooks';
export { signInInput, signUpInput, verifyOtpInput } from './model';
export type { SignInInput, SignUpInput, VerifyOtpInput } from './model';
