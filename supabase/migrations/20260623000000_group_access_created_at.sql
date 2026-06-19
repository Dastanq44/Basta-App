-- Add created_at to get_group_access so the public group preview shows the "Created" date (parity
-- with the member group detail). The RETURN shape changes, so DROP + recreate. The dependent
-- list_public_group_* functions call this by name and resolve it at runtime — unaffected.
-- Bootstrap frozen (D-013). Idempotent. Apply via Dashboard -> SQL editor or `supabase db push`.
drop function if exists public.get_group_access(uuid);
create function public.get_group_access(p_group_id uuid)
returns table (
  id           uuid,
  name         text,
  description  text,
  avatar_path  text,
  visibility   visibility,
  archived_at  timestamptz,
  created_at   timestamptz,
  owner_id     uuid,
  member_count int,
  viewer_role  member_role,
  access_mode  text,
  can_edit     boolean,
  can_archive  boolean,
  can_leave    boolean,
  can_report   boolean
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  g        public.groups%rowtype;
  v_role   member_role;
  v_member boolean;
  v_public boolean;
  v_count  int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into g from public.groups where groups.id = p_group_id;
  if g.id is null then return; end if;
  select gm.role into v_role from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = v_uid;
  v_member := v_role is not null;
  v_public := (not v_member) and g.visibility = 'public' and g.archived_at is null
    and not public.is_block_between(g.owner_id);
  if not (v_member or v_public) then return; end if;

  select count(*) into v_count from public.group_members gm where gm.group_id = p_group_id;
  return query select
    g.id, g.name, g.description, g.avatar_path, g.visibility, g.archived_at, g.created_at, g.owner_id,
    coalesce(v_count, 0), v_role,
    case when v_member then 'member' else 'public' end,
    (g.owner_id = v_uid),   -- can_edit
    (g.owner_id = v_uid),   -- can_archive
    v_member,               -- can_leave
    (g.owner_id <> v_uid);  -- can_report
end $$;
revoke execute on function public.get_group_access(uuid) from public;
grant execute on function public.get_group_access(uuid) to authenticated;
