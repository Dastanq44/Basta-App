-- Patch migration (B-013 / W-028): fix `column reference "id" is ambiguous` on
-- get_my_today_submission. Apply via Supabase Dashboard → SQL editor. Idempotent.
--
-- WHY: The W-027 version of `get_my_today_submission` declared OUT params via
--   `returns table (id uuid, challenge_id uuid, …)`. Inside a plpgsql function those OUT
--   params are in scope as variables. Then the function body issued:
--       select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = v_uid;
--   That bare `id` collides with the OUT parameter `id`. PostgreSQL raises 42702
--   ("column reference 'id' is ambiguous … It could refer to either a PL/pgSQL variable
--   or a table column"). The return-query SELECT was fine because every column was
--   prefixed as `s.<col>`; only the profile lookup was unqualified.
--
-- FIX: qualify the column (`where profiles.id = v_uid`). The function body otherwise
--   matches W-027 verbatim, so applying this migration after W-027 is safe.

create or replace function get_my_today_submission(p_challenge_id uuid)
returns table (
  id            uuid,
  challenge_id  uuid,
  author_id     uuid,
  challenge_day int,
  comment       text,
  media_path    text,
  status        submission_status,
  verified_at   timestamptz,
  rejected_at   timestamptz,
  created_at    timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_tz        text;
  v_start     date;
  v_today_day int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not is_challenge_participant(p_challenge_id) then return; end if;

  -- Qualified column refs — bare `id`/`start_date` would collide with the OUT params.
  select coalesce(profiles.timezone, 'UTC') into v_tz
    from public.profiles where profiles.id = v_uid;
  select challenges.start_date into v_start
    from public.challenges where challenges.id = p_challenge_id;
  if v_start is null then return; end if;

  v_today_day := ((now() at time zone v_tz)::date - v_start);

  return query
    select s.id, s.challenge_id, s.author_id, s.challenge_day, s.comment, s.media_path,
           s.status, s.verified_at, s.rejected_at, s.created_at
    from public.submissions s
    where s.challenge_id = p_challenge_id
      and s.author_id    = v_uid
      and s.challenge_day = v_today_day
    limit 1;
end $$;
-- Grant already in place from W-027.
