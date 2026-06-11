-- Slice T-053-E / W-038: aggregated streak RPC.
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. Idempotent.
--
-- WHY: the Profile screen now shows two stat tiles — "Current streak" + "Best
--   streak" — aggregated across all of the caller's challenges. `home_overview`
--   already returns current_streak, but adding best_streak there would change a
--   shipping JSON shape. A separate RPC keeps the existing surface untouched.
--
-- TOUCHES:
--   * `get_my_streak_aggregate()` — NEW RPC returning JSON {current_streak, best_streak}.
--     Stable + security definer; same tz-aware day math as home_overview / challenge_streak.

create or replace function public.get_my_streak_aggregate()
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_tz             text;
  v_today          date;
  v_current_streak int := 0;
  v_best_streak    int := 0;
  v_anchor         date;
  v_day            date;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = v_uid;
  v_tz   := coalesce(v_tz, 'UTC');
  v_today := (now() at time zone v_tz)::date;

  -- Current streak: same anchor-and-walk approach as home_overview.
  if exists (
    select 1 from public.submissions s
    join public.challenges c on c.id = s.challenge_id
    where s.author_id = v_uid and s.status = 'verified'
      and (c.start_date + s.challenge_day) = v_today
  ) then
    v_anchor := v_today;
  elsif exists (
    select 1 from public.submissions s
    join public.challenges c on c.id = s.challenge_id
    where s.author_id = v_uid and s.status = 'verified'
      and (c.start_date + s.challenge_day) = v_today - 1
  ) then
    v_anchor := v_today - 1;
  else
    v_anchor := null;
  end if;

  if v_anchor is not null then
    v_day := v_anchor;
    while exists (
      select 1 from public.submissions s
      join public.challenges c on c.id = s.challenge_id
      where s.author_id = v_uid and s.status = 'verified'
        and (c.start_date + s.challenge_day) = v_day
    ) loop
      v_current_streak := v_current_streak + 1;
      v_day := v_day - 1;
    end loop;
  end if;

  -- Best streak: gaps-and-islands across the caller's verified days.
  with verified_days as (
    select distinct (c.start_date + s.challenge_day) as d
      from public.submissions s
      join public.challenges c on c.id = s.challenge_id
      where s.author_id = v_uid and s.status = 'verified'
  ),
  with_island as (
    select d,
           d - (row_number() over (order by d))::int as island
      from verified_days
  ),
  runs as (
    select count(*)::int as run_len
      from with_island
      group by island
  )
  select coalesce(max(run_len), 0) into v_best_streak from runs;

  return json_build_object(
    'current_streak', v_current_streak,
    'best_streak', v_best_streak
  );
end $$;
grant execute on function public.get_my_streak_aggregate() to authenticated;
