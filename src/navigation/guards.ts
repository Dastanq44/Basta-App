// Navigation guards. Routing decisions live HERE, not inside layouts/screens, so the gate
// can be reasoned about in one place and (later) unit-tested independently of expo-router.
//
// Redirect matrix (server profile is the source of truth — D-003):
//
//   sessionStatus | profile             | terms_version vs CURRENT | onboarded | target
//   ------------- | ------------------- | ------------------------ | --------- | ------------------------------
//   loading       | -                   | -                        | -         | (no redirect — show loader)
//   signedOut     | -                   | -                        | -         | /(auth)/sign-in
//   signedIn      | loading             | -                        | -         | (no redirect — show loader)
//   signedIn      | error (no cache)    | -                        | -         | /(onboarding)/profile-setup *
//   signedIn      | null (no row)       | -                        | -         | /(onboarding)/profile-setup
//   signedIn      | present             | mismatch                 | -         | /(onboarding)/profile-setup
//   signedIn      | present             | match                    | false     | /(onboarding)/join-or-create-group
//   signedIn      | present             | match                    | true      | /(tabs)
//
// * The error case routes to profile-setup so the user sees a real error from upsertProfile
//   rather than staring at an infinite loading splash. Common cause: W-010 (migration unapplied).
//
// The gate returns the *target* group/path; the layout compares against current segments
// and only navigates when they differ — preventing redirect loops.

import { useSegments } from 'expo-router';
import { useSession } from '@/features/auth';
import { hasAcceptedCurrentTerms, useProfile } from '@/features/onboarding';

export type GateTarget =
  | '/(auth)/sign-in'
  | '/(onboarding)/profile-setup'
  | '/(onboarding)/join-or-create-group'
  | '/(tabs)';

export type GateState =
  | { status: 'loading'; target: null }
  | { status: 'ready'; target: GateTarget };

export function useOnboardingGate(): GateState {
  const session = useSession();
  const profile = useProfile(); // disabled while signed-out, see useProfile

  if (session.status === 'loading') return { status: 'loading', target: null };
  if (session.status === 'signedOut') return { status: 'ready', target: '/(auth)/sign-in' };

  // Signed in. Wait until the profile query has either succeeded or definitively errored.
  if (profile.isPending) return { status: 'loading', target: null };

  // Profile fetch errored with nothing cached — most commonly because the migration hasn't been
  // applied yet (W-010), or RLS is misconfigured. Route the user to profile-setup so they see a
  // real error from the next mutation rather than staring at a loading spinner forever.
  if (profile.isError && !profile.data) {
    return { status: 'ready', target: '/(onboarding)/profile-setup' };
  }

  const user = profile.data ?? null;
  if (!user) return { status: 'ready', target: '/(onboarding)/profile-setup' };
  if (!hasAcceptedCurrentTerms(user)) return { status: 'ready', target: '/(onboarding)/profile-setup' };
  if (!user.onboarded) return { status: 'ready', target: '/(onboarding)/join-or-create-group' };
  return { status: 'ready', target: '/(tabs)' };
}

/**
 * Helper for layouts: returns true when the user is currently inside the target group.
 * Used to avoid redirecting to a route the user is already on.
 */
export function isAtTarget(segments: string[], target: GateTarget): boolean {
  const group = segments[0]; // expo-router group segment, e.g. "(auth)" | "(onboarding)" | "(tabs)"
  if (target === '/(auth)/sign-in') return group === '(auth)';
  if (target === '/(onboarding)/profile-setup') {
    return group === '(onboarding)' && segments[1] === 'profile-setup';
  }
  if (target === '/(onboarding)/join-or-create-group') {
    return group === '(onboarding)' && segments[1] === 'join-or-create-group';
  }
  if (target === '/(tabs)') return group === '(tabs)';
  return false;
}

/** Hook variant of isAtTarget for screens that want to know live segments. */
export function useIsAtTarget(target: GateTarget): boolean {
  const segments = useSegments();
  return isAtTarget(segments as string[], target);
}
