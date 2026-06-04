-- Phase 2 of the UI overhaul (Home screen) — W-029.
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. Idempotent (CREATE OR REPLACE).
--
-- Adds two SECURITY DEFINER read RPCs that power the revamped Home ("Today") tab:
--   * get_home_overview() — one round-trip JSON for: overall current streak, days active this
--     week, today's task total/done, and how many proofs await MY verification.
--   * list_pending_verifications_for_me() — the inbox behind the conditional "Verify a friend"
--     button (group proofs I can still vote on).
--
-- DESIGN (D-003 / D-010): all day math is in the caller's profile timezone. A submission's
-- calendar date is `challenges.start_date + submissions.challenge_day` (challenge_day was already
-- computed in the user's tz at submit time, so this is tz-correct without re-doing tz math).
-- Only status='verified' days count toward streak/week (matches challenge_streak).

-- ============================================================
-- get_home_overview
-- ============================================================
create or replace function get_home_overview()
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_tz             text;
  v_today          date;
  v_today_total    int := 0;
  v_today_done     int := 0;
  v_week_days      int := 0;
  v_current_streak int := 0;
  v_pending        int := 0;
  v_anchor         date;
  v_day            date;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = v_uid;
  v_tz := coalesce(v_tz, 'UTC');
  v_today := (now() at time zone v_tz)::date;

  -- Today's tasks: my non-archived challenges that are active today, and how many I've submitted.
  with my_ch as (
    select c.id, c.start_date, c.duration_days,
           ((now() at time zone v_tz)::date - c.start_date) as today_day
    from public.challenges c
    where c.archived_at is null
      and (
        exists (select 1 from public.challenge_participants cp
                where cp.challenge_id = c.id and cp.user_id = v_uid)
        or (c.mode = 'group' and c.group_id is not null
            and exists (select 1 from public.group_members gm
                        where gm.group_id = c.group_id and gm.user_id = v_uid))
      )
  ),
  active_today as (
    select id, today_day from my_ch where today_day >= 0 and today_day < duration_days
  )
  select
    count(*)::int,
    count(*) filter (where exists (
      select 1 from public.submissions s
      where s.challenge_id = active_today.id
        and s.author_id = v_uid
        and s.challenge_day = active_today.today_day
    ))::int
  into v_today_total, v_today_done
  from active_today;

  -- Days active this week (last 7 calendar days incl. today), across all my challenges.
  select count(distinct (c.start_date + s.challenge_day))
    into v_week_days
    from public.submissions s
    join public.challenges c on c.id = s.challenge_id
    where s.author_id = v_uid
      and s.status = 'verified'
      and (c.start_date + s.challenge_day) between v_today - 6 and v_today;

  -- Overall current streak: anchor today if active, else yesterday (1-day grace), then walk back.
  if exists (select 1 from public.submissions s join public.challenges c on c.id = s.challenge_id
             where s.author_id = v_uid and s.status = 'verified'
               and (c.start_date + s.challenge_day) = v_today) then
    v_anchor := v_today;
  elsif exists (select 1 from public.submissions s join public.challenges c on c.id = s.challenge_id
                where s.author_id = v_uid and s.status = 'verified'
                  and (c.start_date + s.challenge_day) = v_today - 1) then
    v_anchor := v_today - 1;
  else
    v_anchor := null;
  end if;

  if v_anchor is not null then
    v_day := v_anchor;
    while exists (select 1 from public.submissions s join public.challenges c on c.id = s.challenge_id
                  where s.author_id = v_uid and s.status = 'verified'
                    and (c.start_date + s.challenge_day) = v_day) loop
      v_current_streak := v_current_streak + 1;
      v_day := v_day - 1;
    end loop;
  end if;

  -- Group proofs awaiting MY verification: not mine, group mode, I'm a participant, no vote yet.
  select count(*)
    into v_pending
    from public.submissions s
    join public.challenges c on c.id = s.challenge_id
    where s.status = 'pending_verification'
      and s.author_id <> v_uid
      and c.mode = 'group'
      and c.archived_at is null
      and is_challenge_participant(s.challenge_id)
      and not exists (select 1 from public.verifications v
                      where v.submission_id = s.id and v.verifier_id = v_uid);

  return json_build_object(
    'current_streak', v_current_streak,
    'week_active_days', v_week_days,
    'today_total', v_today_total,
    'today_done', v_today_done,
    'pending_verifications', v_pending
  );
end $$;
grant execute on function get_home_overview() to authenticated;

-- ============================================================
-- list_pending_verifications_for_me
-- ============================================================
create or replace function list_pending_verifications_for_me()
returns table (
  submission_id       uuid,
  challenge_id        uuid,
  challenge_title     text,
  author_id           uuid,
  author_username     text,
  author_display_name text,
  challenge_day       int,
  created_at          timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  return query
    select s.id, s.challenge_id, c.title, s.author_id, p.username, p.display_name,
           s.challenge_day, s.created_at
    from public.submissions s
    join public.challenges c on c.id = s.challenge_id
    left join public.profiles p on p.id = s.author_id
    where s.status = 'pending_verification'
      and s.author_id <> v_uid
      and c.mode = 'group'
      and c.archived_at is null
      and is_challenge_participant(s.challenge_id)
      and not exists (select 1 from public.verifications v
                      where v.submission_id = s.id and v.verifier_id = v_uid)
    order by s.created_at asc;
end $$;
grant execute on function list_pending_verifications_for_me() to authenticated;
