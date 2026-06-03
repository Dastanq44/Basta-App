-- Patch migration (B-011 / W-022): treat group members as challenge participants.
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. See W-022 in
-- BUGS_AND_WARNINGS. Idempotent (CREATE OR REPLACE on both functions).
--
-- BUG (B-011): In a group challenge, only the creator was auto-joined into
--   `challenge_participants` (via trg_challenges_add_creator). Every other group member
--   was treated as a non-participant — including the verifier — so they hit:
--     * empty `submissions` list (RLS submissions_select_participant)
--     * 403 on the proof photo  (storage RLS storage_proof_media_select)
--     * empty `verifications`   (RLS verifications_select_participant)
--     * 42501 on verify_submission RPC
--     * 42501 on challenge_streak RPC (the visible error in the issue report)
--
-- FIX (Option A): widen the single helper `is_challenge_participant(p_challenge uuid)` so
--   that for a `mode='group'` challenge, any member of the host group counts as a
--   participant for read/verify purposes. Every gate already calls this helper, so the
--   four RLS policies + three RPCs above are fixed at once without churn.
--
--   For solo challenges the behavior is unchanged (group_id is null → the new OR clause
--   contributes nothing). For outsiders (not a participant AND not in the host group) it
--   still returns false — RLS/RPC denials remain in place for them.
--
-- DEFENSIVE TWEAK: `challenge_streak` previously raised `42501 not a participant` for
-- non-participants. After the helper widening, every legitimate viewer (participant OR
-- group member) passes the check, so the raise path now only fires for true outsiders.
-- Soften it to `return null` so the client treats "no streak" as missing data rather
-- than an error condition. (Backend errors for valid viewers are NOT hidden — they would
-- still surface from the broader query / RLS layer.)

-- ============================================================
-- 1. Widen is_challenge_participant
-- ============================================================
create or replace function is_challenge_participant(p_challenge uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.challenge_participants
      where challenge_id = p_challenge and user_id = auth.uid()
    )
    or exists (
      select 1
      from public.challenges c
      join public.group_members gm on gm.group_id = c.group_id
      where c.id = p_challenge
        and c.mode = 'group'
        and gm.user_id = auth.uid()
    );
$$;
-- Grant is already in place from Phase 2; no re-grant needed.

-- ============================================================
-- 2. challenge_streak: return null instead of raising for non-participants
-- ============================================================
create or replace function challenge_streak(p_challenge_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_tz         text;
  v_start      date;
  v_today_day  int;
  v_current    int := 0;
  v_longest    int := 0;
  v_run        int := 0;
  v_prev       int := null;
  v_today_done boolean := false;
  r record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  -- True outsiders (not a participant and not a member of the host group) get null —
  -- the client renders "no streak" rather than surfacing an error toast.
  if not is_challenge_participant(p_challenge_id) then
    return null;
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
-- Grant is already in place from Phase 3; no re-grant needed.
