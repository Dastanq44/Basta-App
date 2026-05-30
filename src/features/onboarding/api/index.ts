// Onboarding API — thin Supabase wrappers + the row → domain mapping.
// Domain entities (User) are kept separate from the snake_case row shape (D-002).
import { supabase } from '@/shared/lib/supabase';
import type { User } from '@/entities';
import { CURRENT_TERMS_VERSION } from '../model';

/** Raw row shape from the `profiles` table — internal to this module. */
type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  onboarded: boolean;
  terms_version: string | null;
};

function toUser(row: ProfileRow): User {
  return {
    id: row.id,
    username: row.username ?? '',
    displayName: row.display_name ?? '',
    avatarUrl: row.avatar_url ?? undefined,
    timezone: row.timezone,
    onboarded: row.onboarded,
    termsVersion: row.terms_version ?? undefined,
  };
}

/** Hard ceiling on a single profile fetch (network or RLS hang). */
const PROFILE_FETCH_TIMEOUT_MS = 10_000;

/**
 * Read the current user's profile. Returns null when no profile row exists yet.
 * Bounded by an AbortSignal timeout so the gate never hangs on a slow/dead request.
 * Errors are logged to the JS console so they appear in the Expo terminal during dev.
 */
export async function fetchProfile(): Promise<User | null> {
  const ctrl = new AbortController();
  const timeoutId = setTimeout(
    () => ctrl.abort(new Error(`fetchProfile timed out after ${PROFILE_FETCH_TIMEOUT_MS}ms`)),
    PROFILE_FETCH_TIMEOUT_MS,
  );
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, timezone, onboarded, terms_version')
      .abortSignal(ctrl.signal)
      .maybeSingle();
    if (error) throw error;
    return data ? toUser(data as ProfileRow) : null;
  } catch (e) {
    // Surface the real reason in the dev console — the gate alone shows only a loader,
    // and silent failures here are why "infinite loading" looks mysterious.
    console.error('[basta] fetchProfile failed:', e);
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export type UpsertProfilePayload = {
  username: string;
  displayName: string;
  timezone: string;
  /** Caller is responsible for passing CURRENT_TERMS_VERSION only after the user agreed. */
  termsVersion: string;
};

/**
 * Create-or-update the current user's profile. `onboarded` is intentionally NOT touched here —
 * it flips to true only after group setup (see `completeOnboarding`).
 */
export async function upsertProfile(payload: UpsertProfilePayload): Promise<User> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(new Error('upsertProfile timed out')), PROFILE_FETCH_TIMEOUT_MS);
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Not signed in');

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: uid,
          username: payload.username,
          display_name: payload.displayName,
          timezone: payload.timezone,
          terms_version: payload.termsVersion,
        },
        { onConflict: 'id' },
      )
      .select('id, username, display_name, avatar_url, timezone, onboarded, terms_version')
      .abortSignal(ctrl.signal)
      .single();
    if (error) throw error;
    return toUser(data as ProfileRow);
  } catch (e) {
    console.error('[basta] upsertProfile failed:', e);
    throw e;
  } finally {
    clearTimeout(tid);
  }
}

/** Mark onboarding complete. Called once the user has joined or created a group. */
export async function completeOnboarding(): Promise<User> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(new Error('completeOnboarding timed out')), PROFILE_FETCH_TIMEOUT_MS);
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Not signed in');

    const { data, error } = await supabase
      .from('profiles')
      .update({ onboarded: true })
      .eq('id', uid)
      .select('id, username, display_name, avatar_url, timezone, onboarded, terms_version')
      .abortSignal(ctrl.signal)
      .single();
    if (error) throw error;
    return toUser(data as ProfileRow);
  } catch (e) {
    console.error('[basta] completeOnboarding failed:', e);
    throw e;
  } finally {
    clearTimeout(tid);
  }
}

/** Pure check exposed for the navigation gate. */
export function hasAcceptedCurrentTerms(user: User | null): boolean {
  return !!user && user.termsVersion === CURRENT_TERMS_VERSION;
}
