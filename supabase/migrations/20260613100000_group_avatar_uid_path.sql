-- Fix (supersedes 20260613000000): gate group-avatar writes on the UPLOADER'S uid
-- prefix instead of a group-ownership table lookup.
--
-- WHY: the previous fix gated the group-avatars INSERT/UPDATE on
--   is_group_owner((foldername)[1]) — a SECURITY DEFINER read of public.groups from
--   inside a storage.objects policy. In this Supabase environment that read does NOT
--   resolve (the owner is still denied), even though the same helper pattern works for
--   PostgREST queries. Rather than depend on a cross-table read from a storage policy,
--   gate exactly like the WORKING user-avatars policies: a direct comparison of the
--   first path segment to auth.uid(). No table lookup, no function.
--
-- SECURITY: this lets any authenticated user write under group-avatars/<their_uid>/...
--   (same shape as user-avatars). Group ownership is still enforced where it counts —
--   `update_group_meta` is owner-only, so only the owner can record an uploaded path as
--   the group's avatar. A non-owner's uploaded file is never referenced by any group.
--
-- NEW PATH CONVENTION (client): group-avatars/<uploader_uid>/<groupId>-<ts>.jpg
--   foldername(name)[1] = <uploader_uid>.
--
-- Apply via Supabase Dashboard -> SQL editor or `supabase db push`. Idempotent.

drop policy if exists storage_group_avatars_insert on storage.objects;
create policy storage_group_avatars_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'group-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_group_avatars_update on storage.objects;
create policy storage_group_avatars_update on storage.objects for update to authenticated
  using (
    bucket_id = 'group-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- is_group_owner() is no longer referenced by any policy.
drop function if exists public.is_group_owner(uuid);
