-- Slice T-051-A / W-034: submission titles.
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. Idempotent.
--
-- WHY: every submission now carries a short user-supplied title shown as the row's
--   primary line on the challenge detail, profile submissions, and submission detail
--   screens. Existing rows are backfilled to "Day N" so the migration can declare the
--   column NOT NULL without orphaning history.
--
-- TOUCHES:
--   * `submissions.title` (NEW) — text, NOT NULL, 1..80 chars.
--   * `submit_proof` — drop + recreate with a `p_title` parameter; validates the title.
--   * `redact_my_submission` — drop + recreate with a `p_title` parameter; same checks.
--   * `list_challenge_submissions` — drop + recreate to RETURN the title column.
--   * `get_submission_with_author` — drop + recreate to RETURN the title column.
--   * `get_my_today_submission` — drop + recreate to RETURN the title column.
--
-- All RPCs are dropped first because PostgreSQL doesn't allow CREATE OR REPLACE
-- FUNCTION when the parameter list or RETURNS TABLE shape changes. Re-grants are
-- required because dropping the function drops the grants too.

-- ============================================================
-- 1. Column + backfill + constraint
-- ============================================================
alter table public.submissions add column if not exists title text;

-- One-time backfill. The expression `'Day ' || (challenge_day + 1)` matches the
-- in-app default we use on the listing surfaces too, so legacy rows look natural.
update public.submissions
   set title = 'Day ' || (challenge_day + 1)::text
 where title is null;

alter table public.submissions alter column title set not null;

alter table public.submissions drop constraint if exists submissions_title_len_chk;
alter table public.submissions
  add constraint submissions_title_len_chk
  check (char_length(btrim(title)) between 1 and 80);

-- ============================================================
-- 2. submit_proof (recreated with p_title)
-- ============================================================
drop function if exists public.submit_proof(uuid, uuid, text, text);

create or replace function public.submit_proof(
  p_submission_id uuid,
  p_challenge_id  uuid,
  p_title         text,
  p_media_path    text,
  p_comment       text
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid              uuid := auth.uid();
  v_tz               text;
  v_start            date;
  v_mode             challenge_mode;
  v_today_local      date;
  v_day              int;
  v_existing_id      uuid;
  v_existing_status  submission_status;
  v_status           submission_status;
  v_verified_at      timestamptz;
  v_trimmed_title    text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  if not is_challenge_participant(p_challenge_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  v_trimmed_title := btrim(coalesce(p_title, ''));
  if length(v_trimmed_title) < 1 or length(v_trimmed_title) > 80 then
    raise exception 'title must be 1..80 characters' using errcode = '22023';
  end if;

  select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = v_uid;
  select start_date, mode into v_start, v_mode from public.challenges where id = p_challenge_id;
  if v_start is null then raise exception 'challenge not found'; end if;

  v_today_local := (now() at time zone v_tz)::date;
  v_day := v_today_local - v_start;
  if v_day < 0 then raise exception 'challenge has not started'; end if;

  -- Idempotency: if a submission already exists for this (challenge, author, day), return it.
  select id, status into v_existing_id, v_existing_status
    from public.submissions
    where challenge_id = p_challenge_id and author_id = v_uid and challenge_day = v_day
    limit 1;
  if v_existing_id is not null then
    return json_build_object(
      'id', v_existing_id,
      'challenge_day', v_day,
      'status', v_existing_status,
      'already_submitted', true
    );
  end if;

  -- Solo challenges have no friend to verify; the proof self-counts immediately (D-009).
  if v_mode = 'solo' then
    v_status := 'verified';
    v_verified_at := now();
  else
    v_status := 'pending_verification';
    v_verified_at := null;
  end if;

  insert into public.submissions
    (id, challenge_id, author_id, challenge_day, title, comment, media_path, status, verified_at)
  values
    (p_submission_id, p_challenge_id, v_uid, v_day, v_trimmed_title, p_comment, p_media_path, v_status, v_verified_at);

  return json_build_object(
    'id', p_submission_id,
    'challenge_day', v_day,
    'status', v_status,
    'already_submitted', false
  );
end $$;
grant execute on function public.submit_proof(uuid, uuid, text, text, text) to authenticated;

-- ============================================================
-- 3. redact_my_submission (recreated with p_title)
-- ============================================================
drop function if exists public.redact_my_submission(uuid, text, text);

create or replace function public.redact_my_submission(
  p_submission_id uuid,
  p_title         text,
  p_media_path    text,
  p_comment       text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid              uuid := auth.uid();
  v_author_id        uuid;
  v_status           submission_status;
  v_challenge_id     uuid;
  v_challenge_day    int;
  v_mode             challenge_mode;
  v_archived         timestamptz;
  v_start_date       date;
  v_tz               text;
  v_today_day        int;
  v_trimmed_comment  text;
  v_trimmed_title    text;
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

  v_trimmed_title := btrim(coalesce(p_title, ''));
  if length(v_trimmed_title) < 1 or length(v_trimmed_title) > 80 then
    raise exception 'title must be 1..80 characters' using errcode = '22023';
  end if;

  v_trimmed_comment := btrim(coalesce(p_comment, ''));
  if length(v_trimmed_comment) > 500 then
    raise exception 'comment must be at most 500 characters' using errcode = '22023';
  end if;

  if p_media_path is null or length(btrim(p_media_path)) = 0 then
    raise exception 'media_path is required' using errcode = '22023';
  end if;

  update public.submissions
     set title      = v_trimmed_title,
         media_path = p_media_path,
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
grant execute on function public.redact_my_submission(uuid, text, text, text) to authenticated;

-- ============================================================
-- 4. list_challenge_submissions (recreated to return title)
-- ============================================================
drop function if exists public.list_challenge_submissions(uuid, int);

create or replace function public.list_challenge_submissions(
  p_challenge_id uuid,
  p_limit        int default 20
) returns table (
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
  author_display_name  text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not is_challenge_participant(p_challenge_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  return query
    select
      s.id,
      s.challenge_id,
      s.author_id,
      s.challenge_day,
      s.title,
      s.comment,
      s.media_path,
      s.status,
      s.verified_at,
      s.rejected_at,
      s.created_at,
      p.username,
      p.display_name
    from public.submissions s
    join public.profiles p on p.id = s.author_id
    where s.challenge_id = p_challenge_id
    order by s.created_at desc
    limit greatest(coalesce(p_limit, 20), 1);
end $$;
grant execute on function public.list_challenge_submissions(uuid, int) to authenticated;

-- ============================================================
-- 5. get_submission_with_author (recreated to return title)
-- ============================================================
drop function if exists public.get_submission_with_author(uuid);

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
  author_display_name  text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_challenge_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select s.challenge_id into v_challenge_id
    from public.submissions s where s.id = p_submission_id;
  if v_challenge_id is null then
    return;
  end if;

  if not is_challenge_participant(v_challenge_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  return query
    select
      s.id,
      s.challenge_id,
      s.author_id,
      s.challenge_day,
      s.title,
      s.comment,
      s.media_path,
      s.status,
      s.verified_at,
      s.rejected_at,
      s.created_at,
      p.username,
      p.display_name
    from public.submissions s
    join public.profiles p on p.id = s.author_id
    where s.id = p_submission_id;
end $$;
grant execute on function public.get_submission_with_author(uuid) to authenticated;

-- ============================================================
-- 6. get_my_today_submission (recreated to return title)
-- ============================================================
drop function if exists public.get_my_today_submission(uuid);

create or replace function public.get_my_today_submission(p_challenge_id uuid)
returns table (
  id            uuid,
  challenge_id  uuid,
  author_id     uuid,
  challenge_day int,
  title         text,
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

  select coalesce(profiles.timezone, 'UTC') into v_tz
    from public.profiles where profiles.id = v_uid;
  select challenges.start_date into v_start
    from public.challenges where challenges.id = p_challenge_id;
  if v_start is null then return; end if;

  v_today_day := ((now() at time zone v_tz)::date - v_start);

  return query
    select s.id, s.challenge_id, s.author_id, s.challenge_day, s.title, s.comment,
           s.media_path, s.status, s.verified_at, s.rejected_at, s.created_at
    from public.submissions s
    where s.challenge_id = p_challenge_id
      and s.author_id    = v_uid
      and s.challenge_day = v_today_day
    limit 1;
end $$;
grant execute on function public.get_my_today_submission(uuid) to authenticated;
