-- Patch migration (T-031 / W-027): challenge detail revamp.
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. See W-027 in
-- BUGS_AND_WARNINGS. Idempotent (CREATE OR REPLACE on all three functions).
--
-- WHY: The challenge detail screen had three correctness/UX gaps:
--   1. `getMyTodaySubmission` was the LATEST submission, not today's — so after a day
--      rollover with no new submission, the primary button still said "Add another
--      (replaces today)" referencing yesterday's row.
--   2. For group challenges, there was no way to see how other contestants are doing
--      on this specific challenge (the group leaderboard is across ALL challenges).
--   3. After submitting, the "Add another" button could create a confusing new row
--      flow; the natural action is to EDIT the existing day's submission until it's
--      locked. With "rejected" / "pending_verification" / solo's auto-verify all in play,
--      the edit rules need server enforcement.
--
-- ADDS:
--   * get_my_today_submission(p_challenge_id) — today's row for the caller, computed
--     in the caller's profile timezone (matches submit_proof's day math exactly).
--   * list_challenge_streaks(p_challenge_id) — per-participant {current, longest,
--     today_done} for the caller's view of THIS challenge. Group challenges only;
--     returns the caller's own row for solo so the client doesn't have to branch on
--     mode for the read.
--   * redact_my_submission(p_submission_id, p_media_path, p_comment) — author-only
--     in-place edit of media/comment. Group: lock when status='verified', otherwise
--     clear votes and reset to pending so the new content is re-verified. Solo: only
--     same-day edits (day index must equal today's day for the caller).

-- ============================================================
-- 1. get_my_today_submission
-- ============================================================
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
  -- Outsiders quietly get nothing. We don't `raise` so the client's "no today submission"
  -- state renders identically to a participant who simply hasn't submitted today yet.
  if not is_challenge_participant(p_challenge_id) then return; end if;

  select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = v_uid;
  select start_date into v_start from public.challenges where id = p_challenge_id;
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
grant execute on function get_my_today_submission(uuid) to authenticated;

-- ============================================================
-- 2. list_challenge_streaks
-- ============================================================
create or replace function list_challenge_streaks(p_challenge_id uuid)
returns table (
  user_id              uuid,
  username             text,
  display_name         text,
  current_streak       int,
  longest_streak       int,
  today_done           boolean
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_mode       challenge_mode;
  v_group_id   uuid;
  v_start      date;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not is_challenge_participant(p_challenge_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  select c.mode, c.group_id, c.start_date
    into v_mode, v_group_id, v_start
    from public.challenges c where c.id = p_challenge_id;
  if v_start is null then raise exception 'challenge not found' using errcode = 'P0002'; end if;

  -- For each member-or-self, compute longest run, current run anchored to their today.
  -- Solo: just the caller. Group: every group_member.
  return query
  with participants as (
    select v_uid as uid
    where v_mode = 'solo'
    union
    select gm.user_id as uid
    from public.group_members gm
    where v_mode = 'group' and gm.group_id = v_group_id
  ),
  per_user as (
    select
      pa.uid,
      coalesce(pr.timezone, 'UTC') as tz,
      ((now() at time zone coalesce(pr.timezone, 'UTC'))::date - v_start) as today_day
    from participants pa
    left join public.profiles pr on pr.id = pa.uid
  ),
  verified_days as (
    select s.author_id, s.challenge_day
    from public.submissions s
    where s.challenge_id = p_challenge_id and s.status = 'verified'
  ),
  longest as (
    -- Longest run via grouping on (day - row_number()).
    select pu.uid,
           coalesce(max(run_len), 0) as longest
    from per_user pu
    left join lateral (
      select count(*) as run_len
      from (
        select challenge_day,
               challenge_day - row_number() over (order by challenge_day) as grp
        from verified_days vd
        where vd.author_id = pu.uid
      ) g
      group by grp
    ) l on true
    group by pu.uid
  ),
  current_run as (
    -- Anchor today if done, else yesterday (1-day grace), else 0.
    select pu.uid,
           case
             when exists (select 1 from verified_days vd
                          where vd.author_id = pu.uid and vd.challenge_day = pu.today_day) then pu.today_day
             when exists (select 1 from verified_days vd
                          where vd.author_id = pu.uid and vd.challenge_day = pu.today_day - 1) then pu.today_day - 1
             else null
           end as anchor,
           pu.today_day
    from per_user pu
  ),
  current_len as (
    select cr.uid,
           cr.anchor,
           cr.today_day,
           case when cr.anchor is null then 0 else (
             select count(*)::int
             from generate_series(0, 365) gs
             where exists (
               select 1 from verified_days vd
               where vd.author_id = cr.uid and vd.challenge_day = cr.anchor - gs
             )
             and (
               -- stop as soon as we hit a gap: require all earlier days in the run unbroken.
               not exists (
                 select 1 from generate_series(0, gs) gg
                 where not exists (
                   select 1 from verified_days vd2
                   where vd2.author_id = cr.uid and vd2.challenge_day = cr.anchor - gg
                 )
               )
             )
           ) end as current_streak
    from current_run cr
  ),
  today_done_per as (
    select pu.uid,
           exists (
             select 1 from verified_days vd
             where vd.author_id = pu.uid and vd.challenge_day = pu.today_day
           ) as today_done
    from per_user pu
  )
  select
    pu.uid          as user_id,
    pr.username,
    pr.display_name,
    coalesce(cl.current_streak, 0)::int as current_streak,
    coalesce(lo.longest, 0)::int        as longest_streak,
    coalesce(td.today_done, false)      as today_done
  from per_user pu
  left join public.profiles pr on pr.id = pu.uid
  left join longest        lo on lo.uid = pu.uid
  left join current_len    cl on cl.uid = pu.uid
  left join today_done_per td on td.uid = pu.uid
  order by current_streak desc, longest_streak desc, pr.username asc nulls last;
end $$;
grant execute on function list_challenge_streaks(uuid) to authenticated;

-- ============================================================
-- 3. redact_my_submission
-- ============================================================
create or replace function redact_my_submission(
  p_submission_id uuid,
  p_media_path    text,
  p_comment       text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_author_id     uuid;
  v_status        submission_status;
  v_challenge_id  uuid;
  v_challenge_day int;
  v_mode          challenge_mode;
  v_archived      timestamptz;
  v_start_date    date;
  v_tz            text;
  v_today_day     int;
  v_trimmed_comment text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select s.author_id, s.status, s.challenge_id, s.challenge_day
    into v_author_id, v_status, v_challenge_id, v_challenge_day
    from public.submissions s where s.id = p_submission_id;
  if v_author_id is null then raise exception 'submission not found' using errcode = 'P0002'; end if;
  if v_author_id <> v_uid then
    raise exception 'only the author can edit this submission' using errcode = '42501';
  end if;

  select c.mode, c.archived_at, c.start_date
    into v_mode, v_archived, v_start_date
    from public.challenges c where c.id = v_challenge_id;
  if v_archived is not null then
    raise exception 'cannot edit a submission on an archived challenge' using errcode = '22023';
  end if;

  if v_mode = 'group' and v_status = 'verified' then
    raise exception 'verified submissions cannot be edited' using errcode = '22023';
  end if;

  if v_mode = 'solo' then
    -- Solo proofs auto-verify on submit, so the "verified" lock would be permanent.
    -- Instead: same-day only — once tomorrow rolls over, yesterday's solo submission is
    -- locked history.
    select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = v_uid;
    v_today_day := ((now() at time zone v_tz)::date - v_start_date);
    if v_challenge_day <> v_today_day then
      raise exception 'solo submissions can only be edited on the same day' using errcode = '22023';
    end if;
  end if;

  v_trimmed_comment := btrim(coalesce(p_comment, ''));
  if length(v_trimmed_comment) > 500 then
    raise exception 'comment must be at most 500 characters' using errcode = '22023';
  end if;

  -- Update the row. media_path is mandatory because the client always re-uploads
  -- (storage upsert overwrites at the deterministic path).
  if p_media_path is null or length(btrim(p_media_path)) = 0 then
    raise exception 'media_path is required' using errcode = '22023';
  end if;

  update public.submissions
     set media_path = p_media_path,
         comment    = nullif(v_trimmed_comment, '')
   where id = p_submission_id;

  -- Group submissions: the proof content changed, so any prior approve/reject votes are
  -- invalidated. Clear them and reset to pending_verification regardless of previous
  -- state (pending → still pending; rejected → back to pending so verifiers re-vote).
  if v_mode = 'group' then
    delete from public.verifications where submission_id = p_submission_id;
    update public.submissions
       set status      = 'pending_verification',
           verified_at = null,
           rejected_at = null
     where id = p_submission_id;
  end if;
end $$;
grant execute on function redact_my_submission(uuid, text, text) to authenticated;
