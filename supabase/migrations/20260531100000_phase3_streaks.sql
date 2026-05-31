-- Phase 3 migration: server-authoritative streaks (T-042).
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. See W-015 in BUGS_AND_WARNINGS.
--
-- DESIGN (D-003 / D-010):
--   * The streak is COMPUTED ON READ from `submissions` — it is never stored on the client and
--     never trusted from the client (W-003). The function is the single source of truth.
--   * Timezone correctness is FREE: `submissions.challenge_day` was already computed in the user's
--     timezone at submit time (see submit_proof). So a streak is just the longest run of
--     consecutive verified `challenge_day` values — no timezone math is re-done here.
--   * Only `status = 'verified'` days count (solo proofs auto-verify per D-009; group proofs need a
--     friend's approval). "current" allows a one-day grace: it anchors on today, or yesterday if
--     today isn't done yet, so an un-submitted (but not-yet-missed) today doesn't zero the streak.
--   * NO pg_cron job: a computed streak needs no nightly rollover to stay correct. A cron job is
--     only needed later for PROACTIVE "your streak is at risk" push (T-050) — deferred (D-010).

create or replace function challenge_streak(p_challenge_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_tz        text;
  v_start     date;
  v_today_day int;
  v_current   int := 0;
  v_longest   int := 0;
  v_run       int := 0;
  v_prev      int := null;
  v_today_done boolean := false;
  r record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not is_challenge_participant(p_challenge_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = v_uid;
  select start_date into v_start from public.challenges where id = p_challenge_id;
  if v_start is null then raise exception 'challenge not found'; end if;

  v_today_day := ((now() at time zone v_tz)::date - v_start);

  -- Longest run of consecutive verified days (and whether today is already verified).
  for r in
    select challenge_day
    from public.submissions
    where challenge_id = p_challenge_id and author_id = v_uid and status = 'verified'
    order by challenge_day
  loop
    if v_prev is not null and r.challenge_day = v_prev + 1 then
      v_run := v_run + 1;
    else
      v_run := 1;
    end if;
    if v_run > v_longest then v_longest := v_run; end if;
    v_prev := r.challenge_day;
    if r.challenge_day = v_today_day then v_today_done := true; end if;
  end loop;

  -- Current streak: walk back from the anchor day (today if done, else yesterday for grace).
  declare
    v_anchor int;
    v_day    int;
  begin
    if exists (select 1 from public.submissions
               where challenge_id = p_challenge_id and author_id = v_uid
                 and status = 'verified' and challenge_day = v_today_day) then
      v_anchor := v_today_day;
    elsif exists (select 1 from public.submissions
                  where challenge_id = p_challenge_id and author_id = v_uid
                    and status = 'verified' and challenge_day = v_today_day - 1) then
      v_anchor := v_today_day - 1;
    else
      v_anchor := null;
    end if;

    if v_anchor is not null then
      v_day := v_anchor;
      while exists (select 1 from public.submissions
                    where challenge_id = p_challenge_id and author_id = v_uid
                      and status = 'verified' and challenge_day = v_day) loop
        v_current := v_current + 1;
        v_day := v_day - 1;
      end loop;
    end if;
  end;

  return json_build_object(
    'current', v_current,
    'longest', v_longest,
    'today_done', v_today_done
  );
end $$;
grant execute on function challenge_streak(uuid) to authenticated;
