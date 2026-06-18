-- Global v1 hardening — interaction + pagination + block-filtering fixes on top of
-- 20260616_global_feed_v1. Bootstrap stays frozen (D-013). Idempotent.
-- Apply via Supabase Dashboard -> SQL editor or `supabase db push`.
--
-- 1. is_block_between(other): both-direction block check (auth.uid() <-> other).
-- 2. list_global_submissions: stable (created_at, id) keyset cursor + block-filtered counts.
-- 3. list_submission_comments / list_submission_reactors / list_comment_likers: drop rows from
--    users blocked either direction.
-- 4. list_viewable_user_submissions(user, limit): a user's submissions the caller can_view_submission
--    (so public profiles show globally-visible posts, not just shared-challenge ones).
-- 5. Harden the 3 submission-social SELECT policies to `to authenticated`.

-- ============================================================
-- 1. Both-direction block helper
-- ============================================================
create or replace function public.is_block_between(p_other uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p_other)
       or (b.blocker_id = p_other and b.blocked_id = auth.uid())
  );
$$;
revoke execute on function public.is_block_between(uuid) from public;
grant execute on function public.is_block_between(uuid) to authenticated;

-- ============================================================
-- 2. Global feed — stable (created_at, id) cursor + block-filtered counts
-- ============================================================
-- Keyset pagination: order by (created_at desc, id desc); the next page is rows whose
-- (created_at, id) tuple is strictly less than the last row's. Ties on created_at no longer
-- skip/duplicate rows. Reaction/comment counts exclude users blocked either direction (the feed
-- itself already excludes blocked AUTHORS via is_submission_globally_visible).
drop function if exists public.list_global_submissions(int, timestamptz);
create function public.list_global_submissions(
  p_limit             int default 20,
  p_before_created_at timestamptz default null,
  p_before_id         uuid default null
)
returns table (
  id                   uuid,
  challenge_id         uuid,
  author_id            uuid,
  title                text,
  comment              text,
  media_path           text,
  created_at           timestamptz,
  challenge_day        int,
  author_username      text,
  author_display_name  text,
  author_avatar_url    text,
  challenge_title      text,
  challenge_category   text,
  group_id             uuid,
  group_name           text,
  reaction_count       int,
  comment_count        int
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  return query
    select
      s.id, s.challenge_id, s.author_id, s.title, s.comment, s.media_path, s.created_at, s.challenge_day,
      p.username, p.display_name, p.avatar_url,
      c.title, c.category,
      g.id, g.name,
      coalesce(rc.cnt, 0)::int as reaction_count,
      coalesce(cc.cnt, 0)::int as comment_count
    from public.submissions s
    join public.profiles   p on p.id = s.author_id
    join public.challenges c on c.id = s.challenge_id
    left join public.groups g on g.id = c.group_id
    left join lateral (
      select count(*) as cnt from public.submission_reactions r
      where r.submission_id = s.id and not public.is_block_between(r.user_id)
    ) rc on true
    left join lateral (
      select count(*) as cnt from public.submission_comments cm
      where cm.submission_id = s.id and not public.is_block_between(cm.author_id)
    ) cc on true
    where s.status = 'verified'
      and (
        p_before_created_at is null
        or (s.created_at, s.id) < (p_before_created_at, p_before_id)
      )
      and public.is_submission_globally_visible(s.id)
    order by s.created_at desc, s.id desc
    limit greatest(1, least(coalesce(p_limit, 20), 100));
end $$;
revoke execute on function public.list_global_submissions(int, timestamptz, uuid) from public;
grant execute on function public.list_global_submissions(int, timestamptz, uuid) to authenticated;

-- ============================================================
-- 3. Social reads — drop blocked users' rows
-- ============================================================
-- list_submission_comments + block filter on the comment author
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
      and not public.is_block_between(c.author_id)
    order by c.created_at asc;
end $$;
revoke execute on function public.list_submission_comments(uuid) from public;
grant execute on function public.list_submission_comments(uuid) to authenticated;

-- list_submission_reactors + block filter on the reactor
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
       and not public.is_block_between(r.user_id)
     order by r.created_at asc;
end $$;
revoke execute on function public.list_submission_reactors(uuid, text) from public;
grant execute on function public.list_submission_reactors(uuid, text) to authenticated;

-- list_comment_likers + block filter on the liker
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
       and not public.is_block_between(l.user_id)
     order by l.created_at asc;
end $$;
revoke execute on function public.list_comment_likers(uuid) from public;
grant execute on function public.list_comment_likers(uuid) to authenticated;

-- ============================================================
-- 4. A user's viewable submissions (for /user/[id])
-- ============================================================
-- Returns the target user's submissions the CALLER may see: shared-challenge (private) ones AND
-- globally-visible ones — via can_view_submission. So a public profile page shows public posts
-- even when the viewer shares no challenge with the author.
create or replace function public.list_viewable_user_submissions(
  p_user_id uuid,
  p_limit   int default 50
)
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
  challenge_title      text,
  challenge_group_name text,
  is_public            boolean
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  return query
    select
      s.id, s.challenge_id, s.author_id, s.challenge_day, s.title, s.comment, s.media_path,
      s.status, s.verified_at, s.rejected_at, s.created_at,
      c.title, g.name, s.is_public
    from public.submissions s
    join public.challenges c on c.id = s.challenge_id
    left join public.groups g on g.id = c.group_id
    where s.author_id = p_user_id
      and public.can_view_submission(s.id)
    order by s.created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100));
end $$;
revoke execute on function public.list_viewable_user_submissions(uuid, int) from public;
grant execute on function public.list_viewable_user_submissions(uuid, int) to authenticated;

-- ============================================================
-- 5. Harden the submission-social SELECT policies to `to authenticated`
-- ============================================================
-- 20260616 created these without a role, so they applied to PUBLIC (incl. anon). Scope them to
-- authenticated. (Direct reads still also require can_view_submission.)
drop policy if exists sr_select_participant on public.submission_reactions;
create policy sr_select_participant on public.submission_reactions for select to authenticated
  using (public.can_view_submission(submission_id));

drop policy if exists sc_select_participant on public.submission_comments;
create policy sc_select_participant on public.submission_comments for select to authenticated
  using (public.can_view_submission(submission_id));

drop policy if exists scl_select_participant on public.submission_comment_likes;
create policy scl_select_participant on public.submission_comment_likes for select to authenticated
  using (
    exists (
      select 1 from public.submission_comments c
      where c.id = submission_comment_likes.comment_id
        and public.can_view_submission(c.submission_id)
    )
  );
