// Feature: onboarding — terms acceptance, profile setup, completion gate.
// Implements T-021 (terms) and T-022 (profile). The onboarding navigation gate consumes
// `useProfile()` + `hasAcceptedCurrentTerms()` to decide where to send the user.

export {
  useProfile,
  useUpsertProfile,
  useCompleteOnboarding,
  profileQueryKey,
} from './hooks';

export {
  CURRENT_TERMS_VERSION,
  profileSetupInput,
  usernameSchema,
  displayNameSchema,
} from './model';
export type { ProfileSetupInput } from './model';

export { hasAcceptedCurrentTerms } from './api';
