// Feature: onboarding — terms acceptance, profile setup, completion gate.
// Implements T-021 (terms) and T-022 (profile). The onboarding navigation gate consumes
// `useProfile()` + `hasAcceptedCurrentTerms()` to decide where to send the user.

export {
  useProfile,
  useUpsertProfile,
  useCompleteOnboarding,
  useUpdateMyProfile,
  usePublicProfile,
  profileQueryKey,
  publicProfileQueryKey,
} from './hooks';

export {
  CURRENT_TERMS_VERSION,
  profileSetupInput,
  profileDescriptionSchema,
  usernameSchema,
  displayNameSchema,
} from './model';
export type { ProfileSetupInput } from './model';

export {
  hasAcceptedCurrentTerms,
  uploadMyAvatar,
  deleteMyAvatar,
  userAvatarUrl,
} from './api';
export type { UpdateMyProfilePayload, PublicProfile } from './api';
