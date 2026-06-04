-- Phase 3 of the UI overhaul (Groups) — W-030.
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. Idempotent.
--
-- ADDS group profile fields (description + photo avatar) WITHOUT touching create_group /
-- update_group, so the existing create + rename flows keep working even before this is applied.
-- New behaviour (description, avatar, Main-info tab) needs this migration + a Storage bucket.
--
-- USER ACTION (one-time): create a PUBLIC bucket named `group-avatars`
--   Dashboard → Storage → New bucket → name: group-avatars → Public: ON → Save.
-- (Public so avatars render via a plain URL with no signed-URL refresh. Writes are still gated
--  to the group owner by the Storage RLS policies at the bottom of this file.)

-- ── columns ──────────────────────────────────────────────────────────────────────────────────
alter table public.groups add column if not exists description text;
alter table public.groups add column if not exists avatar_path text;
alter table public.groups drop constraint if exists groups_description_len;
alter table public.groups add constraint groups_description_len
  check (description is null or char_length(description) <= 280);

-- ── get_group_overview: extra Main-info fields (member-gated) ─────────────────────────────────
create or replace function get_group_overview(p_group_id uuid)
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_desc    text;
  v_avatar  text;
  v_created timestamptz;
  v_count   int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not is_group_member(p_group_id) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  select g.description, g.avatar_path, g.created_at
    into v_desc, v_avatar, v_created
    from public.groups g where g.id = p_group_id;
  select count(*) into v_count from public.group_members gm where gm.group_id = p_group_id;
  return json_build_object(
    'description', v_desc,
    'avatar_path', v_avatar,
    'created_at', v_created,
    'member_count', coalesce(v_count, 0)
  );
end $$;
grant execute on function get_group_overview(uuid) to authenticated;

-- ── update_group_meta: owner edits name + description + avatar path ───────────────────────────
create or replace function update_group_meta(
  p_group_id    uuid,
  p_name        text,
  p_description text,
  p_avatar_path text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_owner    uuid;
  v_archived timestamptz;
  v_name     text;
  v_desc     text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select g.owner_id, g.archived_at into v_owner, v_archived
    from public.groups g where g.id = p_group_id;
  if v_owner is null then raise exception 'group not found' using errcode = 'P0002'; end if;
  if v_owner <> v_uid then
    raise exception 'only the owner can edit this group' using errcode = '42501';
  end if;
  if v_archived is not null then
    raise exception 'cannot edit an archived group' using errcode = '22023';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'group name must be 1–60 characters' using errcode = '22023';
  end if;
  v_desc := nullif(btrim(coalesce(p_description, '')), '');
  if v_desc is not null and char_length(v_desc) > 280 then
    raise exception 'description must be at most 280 characters' using errcode = '22023';
  end if;

  update public.groups
     set name        = v_name,
         description = v_desc,
         -- null keeps the existing avatar (rename/description edits don't drop the photo).
         avatar_path = coalesce(p_avatar_path, avatar_path)
   where id = p_group_id;
end $$;
grant execute on function update_group_meta(uuid, text, text, text) to authenticated;

-- ── Storage RLS for the public `group-avatars` bucket ────────────────────────────────────────
-- Path convention: <group_id>/avatar.jpg → foldername[1] = group_id. Reads are public (bucket is
-- public); writes are gated to the group's owner. Requires the bucket to exist (USER action above).
drop policy if exists storage_group_avatars_insert on storage.objects;
create policy storage_group_avatars_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'group-avatars'
    and exists (
      select 1 from public.groups g
      where g.id = ((storage.foldername(name))[1])::uuid and g.owner_id = auth.uid()
    )
  );

drop policy if exists storage_group_avatars_update on storage.objects;
create policy storage_group_avatars_update on storage.objects for update to authenticated
  using (
    bucket_id = 'group-avatars'
    and exists (
      select 1 from public.groups g
      where g.id = ((storage.foldername(name))[1])::uuid and g.owner_id = auth.uid()
    )
  );
