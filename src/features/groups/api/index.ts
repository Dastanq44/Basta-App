// Groups API — thin Supabase wrappers. The DB trigger `trg_groups_add_owner` ensures the
// creator is added as a `member_role=owner` row in group_members; clients don't have to.
import { supabase } from '@/shared/lib/supabase';
import type { Group, GroupId } from '@/entities';

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
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('groups')
    .insert({ name, owner_id: uid })
    .select('id, name, owner_id, invite_code')
    .single();
  if (error) throw error;
  return toGroup(data as GroupRow);
}

/**
 * Joins the caller to a group via invite code, by calling the server-side RPC
 * `join_group_by_invite`. The RPC runs SECURITY DEFINER (it has to, since the caller
 * is not yet a group member and therefore can't SELECT the group under RLS).
 * Returns the group_id of the joined group.
 */
export async function joinGroupByInvite(code: string): Promise<GroupId> {
  const { data, error } = await supabase.rpc('join_group_by_invite', { p_code: code });
  if (error) {
    // Surface the Postgres exception message ("invalid invite code") verbatim.
    throw new Error(error.message || 'Could not join group');
  }
  return data as GroupId;
}
