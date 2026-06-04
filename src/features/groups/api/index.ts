// Groups API — thin Supabase wrappers. The DB trigger `trg_groups_add_owner` ensures the
// creator is added as a `member_role=owner` row in group_members; clients don't have to.
import { supabase } from '@/shared/lib/supabase';
import type { Group, GroupId } from '@/entities';

const COLUMNS = 'id, name, owner_id, invite_code, archived_at';

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
};

function toGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    inviteCode: row.invite_code,
    archivedAt: row.archived_at ?? undefined,
  };
}

export async function createGroup(name: string): Promise<Group> {
  const ctrl = withTimeout();
  try {
    // Use the SECURITY DEFINER RPC instead of a direct INSERT — see migration notes for
    // `create_group`. Avoids the RLS edge case where `owner_id = auth.uid()` evaluates to
    // NULL on the server even when the client has a valid session (PKCE/JWT propagation).
    const { data: groupId, error: rpcErr } = await supabase
      .rpc('create_group', { p_name: name })
      .abortSignal(ctrl.signal);
    if (rpcErr) throw new Error(rpcErr.message || 'Could not create group');

    // Read the created row back. The AFTER INSERT trigger has added us as a member, so the
    // groups_select_member RLS passes.
    const { data, error: selErr } = await supabase
      .from('groups')
      .select('id, name, owner_id, invite_code')
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

/** Owner updates name + description + avatar path via the W-030 RPC. */
export async function updateGroupMeta(
  groupId: string,
  input: { name: string; description?: string | null; avatarPath?: string | null },
): Promise<void> {
  const c = withTimeout();
  try {
    const { error } = await supabase
      .rpc('update_group_meta', {
        p_group_id: groupId,
        p_name: input.name,
        p_description: input.description ?? null,
        p_avatar_path: input.avatarPath ?? null,
      })
      .abortSignal(c.signal);
    if (error) throw new Error(error.message || 'Could not update group');
  } catch (e) {
    console.error('[basta] updateGroupMeta failed:', e);
    throw e;
  }
}

/** Uploads a group avatar image to the public `group-avatars` bucket; returns the storage path. */
export async function uploadGroupAvatar(groupId: string, localUri: string): Promise<string> {
  const remotePath = `${groupId}/avatar.jpg`;
  const res = await fetch(localUri);
  if (!res.ok) throw new Error(`Could not read image (${res.status})`);
  const buf = await res.arrayBuffer();
  const { error } = await supabase.storage
    .from(GROUP_AVATAR_BUCKET)
    .upload(remotePath, buf, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' });
  if (error) throw error;
  return remotePath;
}
