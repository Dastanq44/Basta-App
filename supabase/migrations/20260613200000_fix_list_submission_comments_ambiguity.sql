-- Fix: list_submission_comments threw 42702 "column reference \"id\" is ambiguous",
-- so comments never loaded on the submission screen (getComments failed).
--
-- WHY: the function's RETURNS TABLE declares an `id` column, which is in scope inside the
--   plpgsql body as an OUT-parameter variable. The body's
--     select challenge_id into v_ch from public.submissions where id = p_submission_id;
--   has a BARE `id` that Postgres can't disambiguate between that variable and
--   submissions.id. Same class of bug as the earlier get_my_today_submission fix.
--
-- FIX: qualify the column (submissions.id). Body is otherwise identical. CREATE OR REPLACE
--   keeps the existing grant; re-stated below for idempotency.
--
-- NOTE (D-013): new migration on top of the frozen bootstrap, not a bootstrap edit.
-- Apply via Supabase Dashboard -> SQL editor or `supabase db push`.

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
  -- Qualified `submissions.id` — a bare `id` collides with the `id` OUT parameter.
  select challenge_id into v_ch from public.submissions where submissions.id = p_submission_id;
  if v_ch is null then return; end if;
  if not public.is_challenge_participant(v_ch) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
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
grant execute on function public.list_submission_comments(uuid) to authenticated;
