-- Privacy enforcement — make the visibility foundation correct + safe. NOT the Global feed.
-- Builds on 20260614000000_visibility_foundation.sql. The bootstrap stays frozen (D-013).
-- Idempotent. Apply via Supabase Dashboard -> SQL editor or `supabase db push`.
--
-- Fixes:
--   1. profiles: drop the broad `using (true)` SELECT that leaked EVERY profile (all columns)
--      to every authenticated user; route other-user reads through get_viewable_profile (safe
--      columns + visibility enforced).
--   2. can_view_submission(uuid): one helper = (author/participant) OR globally visible.
--   3. submission social RPCs gate on can_view_submission so non-blocked viewers of a globally
--      visible post can read + interact, while private submissions stay participant-only.
--   4. proof-media SELECT policy hardened (UUID-guarded casts; bucket stays private).
--   5. update_group_meta gains explicit avatar clearing (p_clear_avatar).
--   6. create_group gains p_visibility (default private).

-- ============================================================
-- 1. Profiles — stop leaking every profile to every user
-- ============================================================
-- `profiles_select_public USING (true)` exposed ALL rows AND ALL columns (incl. timezone,
-- onboarded, terms_version) to any authenticated user, so visibility='private' meant nothing.
-- Remove it. Own-row read/insert/update remain (from the bootstrap). Other-user reads now go
-- through get_viewable_profile(), which returns only safe identity columns and enforces visibility.
drop policy if exists profiles_select_public on public.profiles;

-- Do the viewer and target share a group, or a challenge (incl. group-challenge membership)?
create or replace function public.shares_group_or_challenge(p_viewer uuid, p_target uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.group_members gm1
      join public.group_members gm2 on gm2.group_id = gm1.group_id
      where gm1.user_id = p_viewer and gm2.user_id = p_target
    )
    or exists (
      select 1
      from public.challenge_participants cp1
      join public.challenge_participants cp2 on cp2.challenge_id = cp1.challenge_id
      where cp1.user_id = p_viewer and cp2.user_id = p_target
    );
$$;
revoke execute on function public.shares_group_or_challenge(uuid, uuid) from public;
grant execute on function public.shares_group_or_challenge(uuid, uuid) to authenticated;

-- Safe view of another user's profile. Returns a row ONLY when the viewer is allowed:
--   self  OR  target is public  OR  viewer shares a group/challenge with target.
-- Never returns internal columns (timezone / onboarded / terms_version).
drop function if exists public.get_viewable_profile(uuid);
create function public.get_viewable_profile(p_user_id uuid)
returns table (
  id           uuid,
  username     text,
  display_name text,
  avatar_url   text,
  description  text,
  visibility   visibility
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_vis visibility;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select pr.visibility into v_vis from public.profiles pr where pr.id = p_user_id;
  if v_vis is null then return; end if;  -- no such profile
  if p_user_id = v_uid
     or v_vis = 'public'
     or public.shares_group_or_challenge(v_uid, p_user_id) then
    return query
      select pr.id, pr.username, pr.display_name, pr.avatar_url, pr.description, pr.visibility
        from public.profiles pr
       where pr.id = p_user_id;
  end if;
  -- otherwise: no row (controlled "not found / not allowed")
end $$;
revoke execute on function public.get_viewable_profile(uuid) from public;
grant execute on function public.get_viewable_profile(uuid) to authenticated;

-- ============================================================
-- 2. can_view_submission — private access OR globally visible
-- ============================================================
-- True when the caller may see the submission at all: author, challenge participant (the
-- existing private rules) OR the submission is globally visible (which itself enforces verified +
-- opt-in + public profile/challenge/group + not blocked, either direction).
create or replace function public.can_view_submission(p_submission_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.submissions s
      where s.id = p_submission_id
        and (s.author_id = auth.uid() or public.is_challenge_participant(s.challenge_id))
    )
    or public.is_submission_globally_visible(p_submission_id);
$$;
revoke execute on function public.can_view_submission(uuid) from public;
grant execute on function public.can_view_submission(uuid) to authenticated;

-- ============================================================
-- 3. Submission social RPCs — gate on can_view_submission
-- ============================================================
-- Each body is the current one with the participant check swapped for can_view_submission.
-- Reads return empty when the caller can't see the submission (no existence leak); writes raise.

-- get_submission_with_author (was participant-gated in 20260614). Returns is_public too.
create or replace function public.get_submission_with_author(p_submission_id uuid)
returns table (
  id                   uuid,
  challenge_id         uuid,
  author_id            uuid,
  challenge_day        int,
  title                text,
  comment              text,
  media_path           text,
  status               submission_status,
  verified_at          timestamptz,
  rejected_at          timestamptz,
  created_at           timestamptz,
  author_username      text,
  author_display_name  text,
  is_public            boolean
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not public.can_view_submission(p_submission_id) then return; end if;  -- not found / not allowed
  return query
    select s.id, s.challenge_id, s.author_id, s.challenge_day, s.title, s.comment,
           s.media_path, s.status, s.verified_at, s.rejected_at, s.created_at,
           p.username, p.display_name, s.is_public
    from public.submissions s
    join public.profiles p on p.id = s.author_id
    where s.id = p_submission_id;
end $$;
revoke execute on function public.get_submission_with_author(uuid) from public;
grant execute on function public.get_submission_with_author(uuid) to authenticated;

-- list_submission_comments (keeps the qualified submissions.id ambiguity fix from 20260613200000)
create or replace function public.list_submission_comments(p_submission_id uuid)
returns table (
  id                  uuid,
  submission_id       uuid,
  author_id           uuid,
  author_username     text,
  author_display_name text,
  body                text,
  created_at          timestamptz,
  likes_count         int,
  liked_by_me         boolean
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not public.can_view_submission(p_submission_id) then return; end if;
  return query
    select
      c.id, c.submission_id, c.author_id, p.username, p.display_name, c.body, c.created_at,
      coalesce(lk.cnt, 0)::int as likes_count,
      coalesce(lk.mine, false) as liked_by_me
    from public.submission_comments c
    join public.profiles p on p.id = c.author_id
    left join lateral (
      select count(*) as cnt, bool_or(l.user_id = v_uid) as mine
      from public.submission_comment_likes l
      where l.comment_id = c.id
    ) lk on true
    where c.submission_id = p_submission_id
    order by c.created_at asc;
end $$;
revoke execute on function public.list_submission_comments(uuid) from public;
grant execute on function public.list_submission_comments(uuid) to authenticated;

-- add_comment (write — raises when the caller can't see the submission)
create or replace function public.add_comment(p_submission_id uuid, p_body text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_id      uuid;
  v_created timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_body is null or char_length(trim(p_body)) = 0 then raise exception 'empty comment'; end if;
  if not public.can_view_submission(p_submission_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.submission_comments (submission_id, author_id, body)
    values (p_submission_id, v_uid, left(trim(p_body), 280))
    returning id, created_at into v_id, v_created;
  return json_build_object('id', v_id, 'created_at', v_created);
end $$;
revoke execute on function public.add_comment(uuid, text) from public;
grant execute on function public.add_comment(uuid, text) to authenticated;

-- react_to_submission (write)
create or replace function public.react_to_submission(p_submission_id uuid, p_emoji text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not public.can_view_submission(p_submission_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_emoji is null or char_length(trim(p_emoji)) = 0 then
    delete from public.submission_reactions where submission_id = p_submission_id and user_id = v_uid;
  else
    insert into public.submission_reactions (submission_id, user_id, emoji)
      values (p_submission_id, v_uid, p_emoji)
      on conflict (submission_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
end $$;
revoke execute on function public.react_to_submission(uuid, text) from public;
grant execute on function public.react_to_submission(uuid, text) to authenticated;

-- list_submission_reactors (read)
create or replace function public.list_submission_reactors(
  p_submission_id uuid,
  p_emoji         text
)
returns table (
  user_id      uuid,
  username     text,
  display_name text,
  reacted_at   timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_emoji is null or char_length(btrim(p_emoji)) = 0 then return; end if;
  if not public.can_view_submission(p_submission_id) then return; end if;
  return query
    select p.id, p.username, p.display_name, r.created_at
      from public.submission_reactions r
      join public.profiles p on p.id = r.user_id
     where r.submission_id = p_submission_id and r.emoji = p_emoji
     order by r.created_at asc;
end $$;
revoke execute on function public.list_submission_reactors(uuid, text) from public;
grant execute on function public.list_submission_reactors(uuid, text) to authenticated;

-- like_comment (write — resolves the comment's submission, then gates)
create or replace function public.like_comment(p_comment_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sub uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select c.submission_id into v_sub from public.submission_comments c where c.id = p_comment_id;
  if v_sub is null then raise exception 'comment not found' using errcode = 'P0002'; end if;
  if not public.can_view_submission(v_sub) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.submission_comment_likes (comment_id, user_id)
    values (p_comment_id, v_uid)
    on conflict (comment_id, user_id) do nothing;
end $$;
revoke execute on function public.like_comment(uuid) from public;
grant execute on function public.like_comment(uuid) to authenticated;

-- unlike_comment is unchanged (only ever deletes the caller's OWN like) — re-granted for clarity.
revoke execute on function public.unlike_comment(uuid) from public;
grant execute on function public.unlike_comment(uuid) to authenticated;

-- list_comment_likers (read)
create or replace function public.list_comment_likers(p_comment_id uuid)
returns table (
  user_id      uuid,
  username     text,
  display_name text,
  liked_at     timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
declare v_sub uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select c.submission_id into v_sub from public.submission_comments c where c.id = p_comment_id;
  if v_sub is null then return; end if;
  if not public.can_view_submission(v_sub) then return; end if;
  return query
    select p.id, p.username, p.display_name, l.created_at
      from public.submission_comment_likes l
      join public.profiles p on p.id = l.user_id
     where l.comment_id = p_comment_id
     order by l.created_at asc;
end $$;
revoke execute on function public.list_comment_likers(uuid) from public;
grant execute on function public.list_comment_likers(uuid) to authenticated;

-- ============================================================
-- 4. proof-media SELECT — harden the path -> uuid casts
-- ============================================================
-- Bucket stays PRIVATE. Author + participant clauses preserved; Global clause added (20260614).
-- The casts to uuid are now guarded by a UUID regex so a malformed object name can never error
-- the policy (the bootstrap cast `[2]::uuid` unguarded; this also covers that). Path convention:
-- <author_uid>/<challenge_id>/<submission_id>.jpg.
drop policy if exists storage_proof_media_select on storage.objects;
create policy storage_proof_media_select on storage.objects for select to authenticated
  using (
    bucket_id = 'proof-media'
    and (
      -- author: first path segment is the caller's uid
      (storage.foldername(name))[1] = auth.uid()::text
      -- participant: 2nd segment is the challenge id (only cast when it looks like a uuid)
      or (
        (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and public.is_challenge_participant(((storage.foldername(name))[2])::uuid)
      )
      -- global: filename (3rd segment, sans extension) is the submission id
      or (
        split_part(split_part(name, '/', 3), '.', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and public.is_submission_globally_visible(split_part(split_part(name, '/', 3), '.', 1)::uuid)
      )
    )
  );

-- ============================================================
-- 5. update_group_meta — explicit avatar clearing
-- ============================================================
-- Adds p_clear_avatar so the client can DISTINGUISH "keep" (omit) from "remove" (clear). Before,
-- avatar_path = coalesce(p_avatar_path, avatar_path) made null mean "keep", so an avatar could
-- never be cleared. Now:  p_clear_avatar=true -> null; else keep-or-set via coalesce.
-- Drop BOTH prior signatures (4-arg bootstrap, 5-arg 20260614) so no overload is left ambiguous.
drop function if exists public.update_group_meta(uuid, text, text, text);
drop function if exists public.update_group_meta(uuid, text, text, text, visibility);
create function public.update_group_meta(
  p_group_id     uuid,
  p_name         text,
  p_description  text,
  p_avatar_path  text,
  p_visibility   visibility default null,
  p_clear_avatar boolean default false
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

  -- p_visibility NULL = leave unchanged. p_clear_avatar=true = remove avatar; else keep-or-set.
  update public.groups
     set name        = v_name,
         description = v_desc,
         avatar_path = case when p_clear_avatar then null else coalesce(p_avatar_path, avatar_path) end,
         visibility  = coalesce(p_visibility, visibility)
   where id = p_group_id;
end $$;
revoke execute on function public.update_group_meta(uuid, text, text, text, visibility, boolean) from public;
grant execute on function public.update_group_meta(uuid, text, text, text, visibility, boolean) to authenticated;

-- ============================================================
-- 6. create_group — visibility at creation (default private)
-- ============================================================
drop function if exists public.create_group(text);
create function public.create_group(p_name text, p_visibility visibility default 'private')
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  insert into public.groups (name, owner_id, visibility)
    values (p_name, v_uid, coalesce(p_visibility, 'private'))
    returning id into v_group_id;
  return v_group_id;
end $$;
revoke execute on function public.create_group(text, visibility) from public;
grant execute on function public.create_group(text, visibility) to authenticated;
