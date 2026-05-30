// Groups API — thin Supabase wrappers. The DB trigger `trg_groups_add_owner` ensures the
// creator is added as a `member_role=owner` row in group_members; clients don't have to.
import { supabase } from '@/shared/lib/supabase';
import type { Group, GroupId } from '@/entities';

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
};

function toGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    inviteCode: row.invite_code,
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
