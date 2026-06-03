-- Patch migration (T-030 / W-025): transfer group leadership.
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. See W-025 in
-- BUGS_AND_WARNINGS. Idempotent (CREATE OR REPLACE).
--
-- WHY: until now `groups.owner_id` was fixed for life. The owner is the only one allowed
--   to edit the group (T-029) and archive it. Giving the owner a way to hand leadership
--   to another member (e.g. before leaving) avoids the sole-owner-leave dead end.
--
-- RULES (enforced server-side):
--   * Caller must be the current owner.
--   * New owner must be an existing member of the same group, not the caller themselves.
--   * Group must not be archived (consistent with update_group / archive_group).
--   * On success: groups.owner_id ← new_uid; the previous owner's group_members.role
--     drops from 'owner' to 'member' (predictable, no admin-side-effects); the new
--     owner's role becomes 'owner'. Both updates run in one transaction (PL/pgSQL
--     function body) so a partial state can't be observed.

create or replace function transfer_group_leadership(
  p_group_id     uuid,
  p_new_owner_id uuid
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_current     uuid;
  v_archived    timestamptz;
  v_new_exists  boolean;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_new_owner_id is null then
    raise exception 'new owner is required' using errcode = '22023';
  end if;
  if p_new_owner_id = v_uid then
    raise exception 'you are already the owner' using errcode = '22023';
  end if;

  select owner_id, archived_at into v_current, v_archived
    from public.groups where id = p_group_id;
  if v_current is null then
    raise exception 'group not found' using errcode = 'P0002';
  end if;
  if v_current <> v_uid then
    raise exception 'only the current owner can transfer leadership' using errcode = '42501';
  end if;
  if v_archived is not null then
    raise exception 'cannot transfer leadership on an archived group' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_new_owner_id
  ) into v_new_exists;
  if not v_new_exists then
    raise exception 'new owner must be a member of the group' using errcode = '22023';
  end if;

  -- Flip ownership in groups.
  update public.groups
     set owner_id = p_new_owner_id
   where id = p_group_id;

  -- Demote the previous owner; promote the new owner. Two updates rather than upserts so
  -- we don't introduce extra rows on a corrupt state — the membership guard above means
  -- both rows already exist.
  update public.group_members
     set role = 'member'
   where group_id = p_group_id and user_id = v_uid;

  update public.group_members
     set role = 'owner'
   where group_id = p_group_id and user_id = p_new_owner_id;
end $$;
grant execute on function transfer_group_leadership(uuid, uuid) to authenticated;
