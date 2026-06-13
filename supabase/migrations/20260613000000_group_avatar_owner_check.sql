-- Fix: group-avatars storage RLS used an inline subquery into public.groups, which
-- re-enters the groups table's own RLS (groups_select_member -> is_group_member ->
-- group_members) from inside a storage.objects policy. That nested RLS evaluation does
-- not resolve, so even the group's OWNER was denied on avatar upload with
-- "new row violates row-level security policy".
--
-- Every other policy in this schema avoids exactly this by going through a SECURITY
-- DEFINER helper (is_group_member / is_challenge_participant), which reads the table
-- WITHOUT RLS. group-avatars was the one policy using a raw inline subquery.
--
-- This migration adds an is_group_owner() SECURITY DEFINER helper (mirrors
-- is_group_member) and rewrites the group-avatars INSERT + UPDATE policies to use it.
-- user-avatars / proof-media are unaffected (they use a direct auth.uid() comparison
-- or the existing participant helper).
--
-- Apply via Supabase Dashboard -> SQL editor or `supabase db push`. Idempotent.
-- NOTE (D-013): this is a NEW migration on top of the frozen bootstrap, not a bootstrap
-- edit — it adds a function and alters policies.

create or replace function public.is_group_owner(p_group uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups
    where id = p_group and owner_id = auth.uid()
  );
$$;
grant execute on function public.is_group_owner(uuid) to authenticated;

drop policy if exists storage_group_avatars_insert on storage.objects;
create policy storage_group_avatars_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'group-avatars'
    and public.is_group_owner(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists storage_group_avatars_update on storage.objects;
create policy storage_group_avatars_update on storage.objects for update to authenticated
  using (
    bucket_id = 'group-avatars'
    and public.is_group_owner(((storage.foldername(name))[1])::uuid)
  );
