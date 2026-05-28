// Domain model — kept separate from API DTOs (DECISIONS.md D-002). Placeholder fields
// reflect the data model in docs/architecture/DATA_MODEL.md; refined when features land.

export type UserId = string;

export type User = {
  id: UserId;
  username: string;
  displayName: string;
  avatarUrl?: string;
  /** Drives day-boundary math server-side (D-003). */
  timezone: string;
  onboarded: boolean;
  /** Version of T&S the user has accepted; compared against CURRENT_TERMS_VERSION (T-021). */
  termsVersion?: string;
};
