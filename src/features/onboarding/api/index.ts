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
  description: string | null;
  timezone: string;
  onboarded: boolean;
  terms_version: string | null;
  visibility: 'private' | 'public';
};

function toUser(row: ProfileRow): User {
  return {
    id: row.id,
    username: row.username ?? '',
    displayName: row.display_name ?? '',
    avatarUrl: row.avatar_url ?? undefined,
    description: row.description ?? undefined,
    timezone: row.timezone,
    onboarded: row.onboarded,
    termsVersion: row.terms_version ?? undefined,
    isPublic: row.visibility === 'public',
  };
}

const PROFILE_SELECT = 'id, username, display_name, avatar_url, description, timezone, onboarded, terms_version, visibility';
const USER_AVATAR_BUCKET = 'user-avatars';

/** Hard ceiling on a single profile fetch (network or RLS hang). */
const PROFILE_FETCH_TIMEOUT_MS = 10_000;

/**
 * Read the current user's profile. Returns null when no profile row exists yet.
 * Bounded by an AbortSignal timeout so the gate never hangs on a slow/dead request.
 * Errors are logged to the JS console so they appear in the Expo terminal during dev.
 *
 * Note on the explicit `.eq('id', uid)`: pre-W-031, RLS (`profiles_select_own`)
 * limited the result to your own row, so `.maybeSingle()` always got 0 or 1. W-031
 * widened SELECT to all authenticated users — an unfiltered query now returns every
 * profile and `.maybeSingle()` fails with PGRST116 "multiple rows returned". Filter
 * by `id = uid` explicitly so the behavior is independent of which policies are in
 * play.
 */
export async function fetchProfile(): Promise<User | null> {
  const ctrl = new AbortController();
  const timeoutId = setTimeout(
    () => ctrl.abort(new Error(`fetchProfile timed out after ${PROFILE_FETCH_TIMEOUT_MS}ms`)),
    PROFILE_FETCH_TIMEOUT_MS,
  );
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', uid)
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

/**
 * Read another user's PUBLIC profile fields (W-031 RLS widening lets any authenticated
 * user see `id, username, display_name, avatar_url, description` on any profile).
 * Used by the read-only `app/user/[id].tsx` route (T-053-D).
 */
export type PublicProfile = {
  id: string;
  username?: string;
  displayName: string;
  avatarUrl?: string;
  description?: string;
  /** Whether the viewed profile is itself public (true) or only visible to you because you
   *  share a group/challenge (false). Lets the UI show a "private" hint if desired. */
  isPublic: boolean;
};

/** Row shape returned by the `get_viewable_profile` RPC (safe identity columns only). */
type ViewableProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  description: string | null;
  visibility: 'private' | 'public';
};

/** Another user's profile, fetched via the `get_viewable_profile` SECURITY DEFINER RPC.
 *  Direct `profiles` SELECT no longer exposes other users (the broad `using (true)` policy was
 *  removed — D-014 privacy enforcement). The RPC returns ONLY safe identity columns and a row
 *  only when the viewer is allowed (self / public / shares a group or challenge). Returns null
 *  when the profile doesn't exist OR the viewer isn't allowed to see it (no existence leak). */
export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const ctrl = new AbortController();
  const timeoutId = setTimeout(
    () => ctrl.abort(new Error(`fetchPublicProfile timed out after ${PROFILE_FETCH_TIMEOUT_MS}ms`)),
    PROFILE_FETCH_TIMEOUT_MS,
  );
  try {
    const { data, error } = await supabase
      .rpc('get_viewable_profile', { p_user_id: userId })
      .abortSignal(ctrl.signal);
    if (error) throw error;
    const rows = (data ?? []) as ViewableProfileRow[];
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      username: row.username ?? undefined,
      displayName: row.display_name ?? row.username ?? 'Member',
      avatarUrl: row.avatar_url ?? undefined,
      description: row.description ?? undefined,
      isPublic: row.visibility === 'public',
    };
  } catch (e) {
    console.error('[basta] fetchPublicProfile failed:', e);
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
      .select(PROFILE_SELECT)
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
      .select(PROFILE_SELECT)
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

// ─────────────────────────────────────────────────────────────────────────────
// Profile editing — T-032 / W-031.
// ─────────────────────────────────────────────────────────────────────────────

/** Public URL for a user avatar (the bucket is public; supabase composes the URL). */
export function userAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(USER_AVATAR_BUCKET).getPublicUrl(path).data.publicUrl ?? null;
}

export type UpdateMyProfilePayload = {
  username: string;
  displayName: string;
  description?: string | null;
  /** `undefined` = leave avatar untouched; `null` = explicit removal; `string` = new path. */
  avatarPath?: string | null;
  /** `undefined` = leave visibility untouched; otherwise set public/private. */
  isPublic?: boolean;
};

/** Update the editable fields on the current user's profile row. RLS allows the user to
 *  update their own row (the existing profiles_update_own policy). */
export async function updateMyProfile(payload: UpdateMyProfilePayload): Promise<User> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(new Error('updateMyProfile timed out')), PROFILE_FETCH_TIMEOUT_MS);
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Not signed in');

    const patch: Record<string, string | null> = {
      username: payload.username,
      display_name: payload.displayName,
      description: payload.description ?? null,
    };
    if (payload.avatarPath !== undefined) {
      patch.avatar_url = payload.avatarPath; // string path, or null to remove
    }
    if (payload.isPublic !== undefined) {
      patch.visibility = payload.isPublic ? 'public' : 'private';
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', uid)
      .select(PROFILE_SELECT)
      .abortSignal(ctrl.signal)
      .single();
    if (error) throw error;
    return toUser(data as ProfileRow);
  } catch (e) {
    console.error('[basta] updateMyProfile failed:', e);
    throw e;
  } finally {
    clearTimeout(tid);
  }
}

/** Uploads a user avatar image to the public `user-avatars` bucket; returns the storage path.
 *  Path convention enforced server-side (RLS = first folder segment is the uid): `<uid>/...`.
 *
 *  The filename is UNIQUE per upload (`avatar-<ts>.jpg`). A fixed `<uid>/avatar.jpg` path kept
 *  producing the same public URL on every change, so the Supabase CDN (cacheControl) and the
 *  React Native <Image> cache would keep showing the PREVIOUS photo — even across reloads. A
 *  fresh filename changes the URL and busts both caches. Older files are cleaned up best-effort. */
export async function uploadMyAvatar(localUri: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('Not signed in');

  const res = await fetch(localUri);
  if (!res.ok) throw new Error(`Could not read image (${res.status})`);
  const buf = await res.arrayBuffer();

  const remotePath = `${uid}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(USER_AVATAR_BUCKET)
    .upload(remotePath, buf, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' });
  if (error) throw error;

  // Best-effort: remove the user's previous avatar files so they don't orphan in Storage.
  try {
    const { data: existing } = await supabase.storage.from(USER_AVATAR_BUCKET).list(uid);
    const stale = (existing ?? [])
      .map((f) => `${uid}/${f.name}`)
      .filter((p) => p !== remotePath);
    if (stale.length > 0) await supabase.storage.from(USER_AVATAR_BUCKET).remove(stale);
  } catch (e) {
    console.warn('[basta] avatar cleanup skipped:', e);
  }

  return remotePath;
}

/** Removes the current user's avatar object(s) from Storage. Idempotent. Filenames are
 *  dynamic (`avatar-<ts>.jpg`), so this clears everything under the user's folder. */
export async function deleteMyAvatar(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('Not signed in');
  const { data: existing, error: listErr } = await supabase.storage.from(USER_AVATAR_BUCKET).list(uid);
  if (listErr) throw listErr;
  const paths = (existing ?? []).map((f) => `${uid}/${f.name}`);
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(USER_AVATAR_BUCKET).remove(paths);
  if (error) throw error;
}
