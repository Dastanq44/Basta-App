// Navigation guards — separated from feature implementation (DECISIONS.md D-002).
// Auth/onboarding redirects happen at the layout level, not inside screens.

export type SessionState = 'loading' | 'signedIn' | 'signedOut';

/**
 * Placeholder until auth lands (Phase 1, T-020). The foundation renders the app shell,
 * so this returns 'signedIn'. Real implementation reads the Supabase session.
 */
export function useSessionState(): SessionState {
  return 'signedIn';
}
