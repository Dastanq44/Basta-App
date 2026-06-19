// Domain model — kept separate from API DTOs (DECISIONS.md D-002). Placeholder fields
// reflect the data model in docs/architecture/DATA_MODEL.md; refined when features land.

export type UserId = string;

export type User = {
  id: UserId;
  username: string;
  displayName: string;
  /** Stored as a storage path in `profiles.avatar_url` (the `user-avatars` bucket is public,
   *  so the client can compute the public URL on read). */
  avatarUrl?: string;
  /** Free-text profile bio shown on the Profile tab (T-032). Capped server-side at 280. */
  description?: string;
  /** Drives day-boundary math server-side (D-003). */
  timezone: string;
  onboarded: boolean;
  /** Version of T&S the user has accepted; compared against CURRENT_TERMS_VERSION (T-021). */
  termsVersion?: string;
  /** Whether the profile is public (posts eligible for Global; profile openable by others). Maps to
   *  `profiles.visibility` ('public' ⇒ true). Default public (the user can go private). */
  isPublic: boolean;
};
