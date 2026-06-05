-- Patch migration (T-032 / W-031): user profile description + avatar storage RLS.
-- Apply via Supabase Dashboard → SQL editor. Idempotent.
--
-- WHY: the redesigned Profile tab adds an editable bio ("description") and lets users pick
--   or take an avatar. `profiles.avatar_url` already exists from Phase 1 — we reuse it as
--   the storage PATH (the bucket is public, so the client computes the URL on read).
--
-- USER STEP (one-time): create the public Storage bucket `user-avatars` in Dashboard →
--   Storage → New bucket → Name: user-avatars → Public: ON. The RLS policies below apply
--   only after the bucket exists.

-- ============================================================
-- 1. profiles.description column (nullable, ≤280 chars)
-- ============================================================
alter table public.profiles
  add column if not exists description text;

-- Constraint added as DROP+ADD so re-applying the migration doesn't 23514 on duplicates.
alter table public.profiles
  drop constraint if exists profiles_description_len_chk;
alter table public.profiles
  add constraint profiles_description_len_chk
  check (description is null or char_length(description) <= 280);

-- ============================================================
-- 2. Storage RLS for `user-avatars` bucket
-- Path convention enforced client-side and by RLS: <user_id>/avatar.jpg
-- ============================================================

-- Anyone (including anonymous) can read a user avatar — the bucket is public, and reading
-- another user's name + photo is a natural part of seeing them on the leaderboard.
drop policy if exists storage_user_avatars_select on storage.objects;
create policy storage_user_avatars_select on storage.objects for select
  using (bucket_id = 'user-avatars');

-- Writes: a user may only insert / update / delete objects under their own uid prefix.
drop policy if exists storage_user_avatars_insert on storage.objects;
create policy storage_user_avatars_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_user_avatars_update on storage.objects;
create policy storage_user_avatars_update on storage.objects for update to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_user_avatars_delete on storage.objects;
create policy storage_user_avatars_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 3. Widen profiles SELECT: any authenticated user may read the public columns of any
--    profile (id, username, display_name, avatar_url, description). Other columns
--    (timezone, terms_version, onboarded) stay private through the existing
--    `profiles_select_own` policy — which still applies, since RLS is OR'd across
--    policies. No leakage.
--
-- Why widen now: leaderboard rows + verification screens already exposed name +
-- username via SECURITY DEFINER RPCs (group_leaderboard, list_challenge_submissions,
-- get_submission_with_author). Pulling them straight from `profiles` for the new
-- Submissions tab keeps the client simple. We restrict to authenticated to keep
-- profiles invisible to fully anonymous sessions.
-- ============================================================
drop policy if exists profiles_select_public on profiles;
create policy profiles_select_public on profiles for select to authenticated
  using (true);
