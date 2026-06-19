// Groups API — thin Supabase wrappers. The DB trigger `trg_groups_add_owner` ensures the
// creator is added as a `member_role=owner` row in group_members; clients don't have to.
import { supabase } from '@/shared/lib/supabase';
import type { Group, GroupId, MemberRole, Submission } from '@/entities';

const COLUMNS = 'id, name, owner_id, invite_code, archived_at, visibility';

const REQUEST_TIMEOUT_MS = 10_000;

function withTimeout(): AbortController {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(new Error(`request timed out after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS);
  return ctrl;
}

type GroupRow = {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  archived_at: string | null;
  visibility?: 'private' | 'public';
};

function toGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    inviteCode: row.invite_code,
    archivedAt: row.archived_at ?? undefined,
    isPublic: row.visibility === 'public',
  };
}

export async function createGroup(name: string, isPublic = true): Promise<Group> {
  const ctrl = withTimeout();
  try {
    // Use the SECURITY DEFINER RPC instead of a direct INSERT — see migration notes for
    // `create_group`. Avoids the RLS edge case where `owner_id = auth.uid()` evaluates to
    // NULL on the server even when the client has a valid session (PKCE/JWT propagation).
    // Visibility defaults to private; the invite code is never affected by it.
    const { data: groupId, error: rpcErr } = await supabase
      .rpc('create_group', { p_name: name, p_visibility: isPublic ? 'public' : 'private' })
      .abortSignal(ctrl.signal);
    if (rpcErr) throw new Error(rpcErr.message || 'Could not create group');

    // Read the created row back. The AFTER INSERT trigger has added us as a member, so the
    // groups_select_member RLS passes.
    const { data, error: selErr } = await supabase
      .from('groups')
      .select(COLUMNS)
      .eq('id', groupId as string)
      .abortSignal(ctrl.signal)
      .single();
    if (selErr) throw selErr;
    return toGroup(data as GroupRow);
  } catch (e) {
    console.error('[basta] createGroup failed:', e);
    throw e;
  }
}

/** List groups the current user is a member of (excludes archived). */
export async function listMyGroups(): Promise<Group[]> {
  const ctrl = withTimeout();
  try {
    const { data, error } = await supabase
      .from('groups')
      .select(COLUMNS)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .abortSignal(ctrl.signal);
    if (error) throw error;
    return (data ?? []).map((r) => toGroup(r as GroupRow));
  } catch (e) {
    console.error('[basta] listMyGroups failed:', e);
    throw e;
  }
}

/** List archived groups the user is still a member of (typically owners after they archive). */
export async function listMyArchivedGroups(): Promise<Group[]> {
  const ctrl = withTimeout();
  try {
    const { data, error } = await supabase
      .from('groups')
      .select(COLUMNS)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
      .abortSignal(ctrl.signal);
    if (error) throw error;
    return (data ?? []).map((r) => toGroup(r as GroupRow));
  } catch (e) {
    console.error('[basta] listMyArchivedGroups failed:', e);
    throw e;
  }
}

/** Owner restores an archived group via RPC. Idempotent on an already-active group. */
export async function restoreGroup(groupId: string): Promise<void> {
  const ctrl = withTimeout();
  try {
    const { error } = await supabase
      .rpc('restore_group', { p_group_id: groupId })
      .abortSignal(ctrl.signal);
    if (error) throw new Error(error.message || 'Could not restore group');
  } catch (e) {
    console.error('[basta] restoreGroup failed:', e);
    throw e;
  }
}

/** Member exits a group via RPC (server enforces sole-owner guard). */
export async function leaveGroup(groupId: string): Promise<void> {
  const ctrl = withTimeout();
  try {
    const { error } = await supabase
      .rpc('leave_group', { p_group_id: groupId })
      .abortSignal(ctrl.signal);
    if (error) throw new Error(error.message || 'Could not leave group');
  } catch (e) {
    console.error('[basta] leaveGroup failed:', e);
    throw e;
  }
}

/** Current owner transfers leadership to another member. Server enforces owner-only,
 *  not-archived, and that the new owner is an existing member. */
export async function transferGroupLeadership(
  groupId: string,
  newOwnerId: string,
): Promise<void> {
  const ctrl = withTimeout();
  try {
    const { error } = await supabase
      .rpc('transfer_group_leadership', {
        p_group_id: groupId,
        p_new_owner_id: newOwnerId,
      })
      .abortSignal(ctrl.signal);
    if (error) throw new Error(error.message || 'Could not transfer leadership');
  } catch (e) {
    console.error('[basta] transferGroupLeadership failed:', e);
    throw e;
  }
}

/** Owner renames an active group via the `update_group` RPC. Throws on validation /
 *  permission failure; the RPC enforces owner-only and not-archived. */
export async function updateGroup(groupId: string, name: string): Promise<void> {
  const ctrl = withTimeout();
  try {
    const { error } = await supabase
      .rpc('update_group', { p_group_id: groupId, p_name: name })
      .abortSignal(ctrl.signal);
    if (error) throw new Error(error.message || 'Could not update group');
  } catch (e) {
    console.error('[basta] updateGroup failed:', e);
    throw e;
  }
}

/** Owner archives a group (soft-delete; data preserved). */
export async function archiveGroup(groupId: string): Promise<void> {
  const ctrl = withTimeout();
  try {
    const { error } = await supabase
      .rpc('archive_group', { p_group_id: groupId })
      .abortSignal(ctrl.signal);
    if (error) throw new Error(error.message || 'Could not archive group');
  } catch (e) {
    console.error('[basta] archiveGroup failed:', e);
    throw e;
  }
}

/**
 * Joins the caller to a group via invite code, by calling the server-side RPC
 * `join_group_by_invite`. The RPC runs SECURITY DEFINER (it has to, since the caller
 * is not yet a group member and therefore can't SELECT the group under RLS).
 * Returns the group_id of the joined group.
 */
export async function joinGroupByInvite(code: string): Promise<GroupId> {
  const ctrl = withTimeout();
  try {
    const { data, error } = await supabase
      .rpc('join_group_by_invite', { p_code: code })
      .abortSignal(ctrl.signal);
    if (error) {
      // Surface the Postgres exception message ("invalid invite code") verbatim.
      throw new Error(error.message || 'Could not join group');
    }
    return data as GroupId;
  } catch (e) {
    console.error('[basta] joinGroupByInvite failed:', e);
    throw e;
  }
}

// ── Group profile (description + photo avatar) — W-030. Additive: create_group / update_group
// stay untouched so the existing create + rename flows keep working before the migration. ──────
const GROUP_AVATAR_BUCKET = 'group-avatars';

export type GroupOverview = {
  description: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  memberCount: number;
};

/** Public URL for a group avatar storage path (bucket is public). Null when unset. */
export function groupAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(GROUP_AVATAR_BUCKET).getPublicUrl(path).data.publicUrl ?? null;
}

/** Main-info fields not on the base Group row (description / avatar / created_at / member count). */
export async function getGroupOverview(groupId: string): Promise<GroupOverview> {
  const c = withTimeout();
  try {
    const { data, error } = await supabase
      .rpc('get_group_overview', { p_group_id: groupId })
      .abortSignal(c.signal);
    if (error) throw error;
    const d = (data ?? {}) as {
      description: string | null;
      avatar_path: string | null;
      created_at: string | null;
      member_count: number;
    };
    return {
      description: d.description ?? null,
      avatarPath: d.avatar_path ?? null,
      avatarUrl: groupAvatarUrl(d.avatar_path),
      createdAt: d.created_at ?? null,
      memberCount: d.member_count ?? 0,
    };
  } catch (e) {
    console.error('[basta] getGroupOverview failed:', e);
    throw e;
  }
}

/** Owner updates name + description + avatar path via the W-030 RPC.
 *  Avatar semantics (3-state): `avatarPath` undefined = keep existing; `null` = remove;
 *  string = set new path. `null` is sent as `p_clear_avatar: true` so the RPC clears it
 *  (a bare null would mean "keep" under the RPC's coalesce). */
export async function updateGroupMeta(
  groupId: string,
  input: { name: string; description?: string | null; avatarPath?: string | null; isPublic?: boolean },
): Promise<void> {
  const c = withTimeout();
  try {
    const clearAvatar = input.avatarPath === null;
    const avatarPath = typeof input.avatarPath === 'string' ? input.avatarPath : null;
    const { error } = await supabase
      .rpc('update_group_meta', {
        p_group_id: groupId,
        p_name: input.name,
        p_description: input.description ?? null,
        p_avatar_path: avatarPath,
        p_visibility: input.isPublic === undefined ? null : input.isPublic ? 'public' : 'private',
        p_clear_avatar: clearAvatar,
      })
      .abortSignal(c.signal);
    if (error) throw new Error(error.message || 'Could not update group');
  } catch (e) {
    console.error('[basta] updateGroupMeta failed:', e);
    throw e;
  }
}

/** Uploads a group avatar image to the public `group-avatars` bucket; returns the storage path.
 *  Path is `<uploader_uid>/<groupId>-<ts>.jpg`:
 *    - storage RLS gates on the first segment (the uploader's uid), the SAME proven pattern
 *      as user avatars (a group-ownership table lookup from a storage policy did not resolve
 *      in Supabase — see migration 20260613100000). Group ownership is enforced by the
 *      owner-only `update_group_meta` RPC that records which path becomes the avatar.
 *    - the `<ts>` makes the public URL change per upload so the CDN + RN <Image> caches don't
 *      keep serving the previous photo.
 *  NOTE: group-avatars has no SELECT/DELETE policy, so superseded files are left as harmless
 *  orphans rather than cleaned up (groups change avatars rarely). */
export async function uploadGroupAvatar(groupId: string, localUri: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('Not signed in');
  const remotePath = `${uid}/${groupId}-${Date.now()}.jpg`;
  const res = await fetch(localUri);
  if (!res.ok) throw new Error(`Could not read image (${res.status})`);
  const buf = await res.arrayBuffer();
  const { error } = await supabase.storage
    .from(GROUP_AVATAR_BUCKET)
    .upload(remotePath, buf, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' });
  if (error) throw error;
  return remotePath;
}

// ── Public-preview access (get_group_access) ─────────────────────────────────

export type GroupAccessMode = 'member' | 'public';

/** Whether + how the viewer can open a group (full member detail vs read-only public preview).
 *  Safe fields only — never the invite code. Null when neither mode applies. */
export type GroupAccess = {
  id: string;
  name: string;
  description?: string;
  avatarPath?: string;
  isPublic: boolean;
  archivedAt?: string;
  ownerId: string;
  memberCount: number;
  viewerRole?: MemberRole;
  accessMode: GroupAccessMode;
  canEdit: boolean;
  canArchive: boolean;
  canLeave: boolean;
  canReport: boolean;
};

type GroupAccessRow = {
  id: string;
  name: string;
  description: string | null;
  avatar_path: string | null;
  visibility: 'private' | 'public';
  archived_at: string | null;
  owner_id: string;
  member_count: number;
  viewer_role: MemberRole | null;
  access_mode: GroupAccessMode;
  can_edit: boolean;
  can_archive: boolean;
  can_leave: boolean;
  can_report: boolean;
};

export async function getGroupAccess(groupId: string): Promise<GroupAccess | null> {
  const c = withTimeout();
  try {
    const { data, error } = await supabase
      .rpc('get_group_access', { p_group_id: groupId })
      .abortSignal(c.signal);
    if (error) throw error;
    const r = ((data ?? []) as GroupAccessRow[])[0];
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      avatarPath: r.avatar_path ?? undefined,
      isPublic: r.visibility === 'public',
      archivedAt: r.archived_at ?? undefined,
      ownerId: r.owner_id,
      memberCount: r.member_count ?? 0,
      viewerRole: r.viewer_role ?? undefined,
      accessMode: r.access_mode,
      canEdit: !!r.can_edit,
      canArchive: !!r.can_archive,
      canLeave: !!r.can_leave,
      canReport: !!r.can_report,
    };
  } catch (e) {
    console.error('[basta] getGroupAccess failed:', e);
    throw e;
  }
}

export type PublicGroupChallenge = {
  id: string;
  groupId: string | null;
  title: string;
  category: string;
  mode: 'solo' | 'group';
  startDate: string;
  durationDays: number;
  isPublic: boolean;
  isParticipant: boolean;
};

type PublicGroupChallengeRow = {
  id: string;
  group_id: string | null;
  title: string;
  category: string;
  mode: 'solo' | 'group';
  start_date: string;
  duration_days: number;
  visibility: 'private' | 'public';
  is_participant: boolean;
};

/** The group's public, non-archived challenges (for the public group preview). */
export async function listPublicGroupChallenges(groupId: string, limit = 20): Promise<PublicGroupChallenge[]> {
  const c = withTimeout();
  try {
    const { data, error } = await supabase
      .rpc('list_public_group_challenges', { p_group_id: groupId, p_limit: limit })
      .abortSignal(c.signal);
    if (error) throw error;
    return ((data ?? []) as PublicGroupChallengeRow[]).map((r) => ({
      id: r.id,
      groupId: r.group_id,
      title: r.title,
      category: r.category,
      mode: r.mode,
      startDate: r.start_date,
      durationDays: r.duration_days,
      isPublic: r.visibility === 'public',
      isParticipant: !!r.is_participant,
    }));
  } catch (e) {
    console.error('[basta] listPublicGroupChallenges failed:', e);
    throw e;
  }
}

type PublicGroupSubmissionRow = {
  id: string;
  challenge_id: string;
  author_id: string;
  challenge_day: number;
  title: string;
  comment: string | null;
  media_path: string | null;
  status: Submission['status'];
  created_at: string;
  author_username: string | null;
  author_display_name: string | null;
  challenge_title: string | null;
  reaction_count: number;
  comment_count: number;
};

/** The group's globally-visible verified submissions (for the public group preview). */
export async function listPublicGroupSubmissions(groupId: string, limit = 20): Promise<Submission[]> {
  const c = withTimeout();
  try {
    const { data, error } = await supabase
      .rpc('list_public_group_submissions', { p_group_id: groupId, p_limit: limit })
      .abortSignal(c.signal);
    if (error) throw error;
    return ((data ?? []) as PublicGroupSubmissionRow[]).map((r) => ({
      id: r.id,
      challengeId: r.challenge_id,
      authorId: r.author_id,
      challengeDay: r.challenge_day,
      title: r.title,
      comment: r.comment ?? undefined,
      mediaRemotePath: r.media_path ?? undefined,
      status: r.status,
      createdAt: r.created_at,
      authorUsername: r.author_username ?? undefined,
      authorDisplayName: r.author_display_name ?? undefined,
      challengeTitle: r.challenge_title ?? undefined,
      reactionCount: r.reaction_count ?? 0,
      commentCount: r.comment_count ?? 0,
    }));
  } catch (e) {
    console.error('[basta] listPublicGroupSubmissions failed:', e);
    throw e;
  }
}
