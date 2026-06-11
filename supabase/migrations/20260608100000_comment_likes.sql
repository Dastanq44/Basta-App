-- Slice T-053-B / W-035: comment likes + comment list aggregation.
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. Idempotent.
--
-- WHY: each comment on a submission can be "liked" by any challenge participant.
--   The heart count is shown only when > 0; long-pressing the heart pops a list of
--   users who liked it. Mirrors the reactor list on submission_reactions (T-053-C will
--   add the equivalent there). The list_submission_comments RPC bundles author display
--   data + per-row like count + liked_by_me to avoid N+1 queries from the client.
--
-- TOUCHES:
--   * `submission_comment_likes` (NEW) — (comment_id, user_id) PK, ON DELETE CASCADE
--     against both parents (so likes vanish if the comment or user is deleted).
--   * RLS — read-allowed for any user with access to the parent submission's challenge.
--   * `like_comment` / `unlike_comment` — SECURITY DEFINER RPCs, participant-gated.
--   * `list_comment_likers` — RPC returning users who liked a given comment.
--   * `list_submission_comments` — RPC replacing the direct SELECT in the client; joins
--     author profile + bundles likes_count + liked_by_me.

-- ============================================================
-- 1. Table + RLS
-- ============================================================
create table if not exists public.submission_comment_likes (
  comment_id uuid not null references public.submission_comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id)            on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists submission_comment_likes_comment_idx
  on public.submission_comment_likes(comment_id);

alter table public.submission_comment_likes enable row level security;

drop policy if exists scl_select_participant on public.submission_comment_likes;
create policy scl_select_participant on public.submission_comment_likes for select using (
  exists (
    select 1
      from public.submission_comments c
      join public.submissions s on s.id = c.submission_id
     where c.id = submission_comment_likes.comment_id
       and is_challenge_participant(s.challenge_id)
  )
);

-- Writes go through SECURITY DEFINER RPCs; no insert/delete/update policies needed.

-- ============================================================
-- 2. like_comment / unlike_comment
-- ============================================================
create or replace function public.like_comment(p_comment_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ch  uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select s.challenge_id into v_ch
    from public.submission_comments c
    join public.submissions s on s.id = c.submission_id
   where c.id = p_comment_id;
  if v_ch is null then raise exception 'comment not found' using errcode = 'P0002'; end if;
  if not is_challenge_participant(v_ch) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  insert into public.submission_comment_likes (comment_id, user_id)
    values (p_comment_id, v_uid)
    on conflict (comment_id, user_id) do nothing;
end $$;
grant execute on function public.like_comment(uuid) to authenticated;

create or replace function public.unlike_comment(p_comment_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  delete from public.submission_comment_likes
    where comment_id = p_comment_id and user_id = v_uid;
end $$;
grant execute on function public.unlike_comment(uuid) to authenticated;

-- ============================================================
-- 3. list_comment_likers — users who liked a comment (for long-press popover)
-- ============================================================
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
declare
  v_ch uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select s.challenge_id into v_ch
    from public.submission_comments c
    join public.submissions s on s.id = c.submission_id
   where c.id = p_comment_id;
  if v_ch is null then return; end if;
  if not is_challenge_participant(v_ch) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  return query
    select p.id, p.username, p.display_name, l.created_at
      from public.submission_comment_likes l
      join public.profiles p on p.id = l.user_id
     where l.comment_id = p_comment_id
     order by l.created_at asc;
end $$;
grant execute on function public.list_comment_likers(uuid) to authenticated;

-- ============================================================
-- 4. list_submission_comments — comments + author + per-row counts in one round-trip
-- ============================================================
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
  v_ch  uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select challenge_id into v_ch from public.submissions where id = p_submission_id;
  if v_ch is null then return; end if;
  if not is_challenge_participant(v_ch) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  return query
    select
      c.id,
      c.submission_id,
      c.author_id,
      p.username,
      p.display_name,
      c.body,
      c.created_at,
      coalesce(lk.cnt, 0)::int as likes_count,
      coalesce(lk.mine, false)  as liked_by_me
    from public.submission_comments c
    join public.profiles p on p.id = c.author_id
    left join lateral (
      select
        count(*)                                       as cnt,
        bool_or(l.user_id = v_uid)                     as mine
      from public.submission_comment_likes l
      where l.comment_id = c.id
    ) lk on true
    where c.submission_id = p_submission_id
    order by c.created_at asc;
end $$;
grant execute on function public.list_submission_comments(uuid) to authenticated;
