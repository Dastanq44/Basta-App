-- Privacy / visibility foundation for Global discovery (NOT the feed itself).
-- Adds explicit public/private controls so a future Global feed can show ONLY content the
-- owner opted in to, enforced SERVER-SIDE (never client-side filtering).
--
-- Apply via Supabase Dashboard -> SQL editor or `supabase db push`. Idempotent.
-- NOTE (D-013): new migration on top of the frozen bootstrap.
--
-- Adds:
--   * enum `visibility` ('private','public'); profiles/groups/challenges.visibility default 'private';
--     submissions.is_public boolean default false.
--   * is_submission_globally_visible(uuid) — the single source of truth for the Global predicate.
--   * proof-media storage SELECT widened so Global viewers can load images of globally-visible posts.
--   * write RPCs recreated to accept the new fields (new params DEFAULT to private/false, so an
--     old client that omits them still works during the upgrade window).
--   * submission read RPCs recreated to RETURN is_public (so edit toggles reflect current state).

-- ============================================================
-- 1. Enum + columns
-- ============================================================
do $$ begin
  create type visibility as enum ('private', 'public');
exception when duplicate_object then null; end $$;

alter table public.profiles   add column if not exists visibility visibility not null default 'private';
alter table public.groups     add column if not exists visibility visibility not null default 'private';
alter table public.challenges add column if not exists visibility visibility not null default 'private';
alter table public.submissions add column if not exists is_public boolean not null default false;

-- ============================================================
-- 2. Global-visibility predicate (single source of truth)
-- ============================================================
-- True only when EVERY gate passes:
--   verified + opted-in + author public + challenge public & active + (group public & active) +
--   no block between the viewer (auth.uid()) and the author, either direction.
create or replace function public.is_submission_globally_visible(p_submission_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.submissions s
    join public.profiles   ap on ap.id = s.author_id
    join public.challenges c  on c.id = s.challenge_id
    left join public.groups g on g.id = c.group_id
    where s.id = p_submission_id
      and s.status = 'verified'
      and s.is_public = true
      and ap.visibility = 'public'
      and c.visibility = 'public'
      and c.archived_at is null
      and (c.mode <> 'group' or (g.id is not null and g.visibility = 'public' and g.archived_at is null))
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = s.author_id)
           or (b.blocker_id = s.author_id and b.blocked_id = auth.uid())
      )
  );
$$;
grant execute on function public.is_submission_globally_visible(uuid) to authenticated;

-- ============================================================
-- 3. proof-media SELECT — allow Global viewers to load public posts' images
-- ============================================================
-- Path convention: <author_uid>/<challenge_id>/<submission_id>.jpg. The submission id is the
-- filename (3rd path segment, minus the extension). nullif(...,'') makes the cast NULL-safe for
-- any non-3-segment object the policy might be evaluated against (then the helper returns false).
drop policy if exists storage_proof_media_select on storage.objects;
create policy storage_proof_media_select on storage.objects for select to authenticated
  using (
    bucket_id = 'proof-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_challenge_participant(((storage.foldername(name))[2])::uuid)
      or public.is_submission_globally_visible(
           nullif(split_part(split_part(name, '/', 3), '.', 1), '')::uuid
         )
    )
  );

-- ============================================================
-- 4. Write RPCs recreated with the new opt-in fields
-- ============================================================

-- submit_proof + p_is_public
drop function if exists public.submit_proof(uuid, uuid, text, text, text);
create or replace function public.submit_proof(
  p_submission_id uuid,
  p_challenge_id  uuid,
  p_title         text,
  p_media_path    text,
  p_comment       text,
  p_is_public     boolean default false
) returns json
language plpgsql security definer
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
  if not public.is_challenge_participant(p_challenge_id) then
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

  select id, status into v_existing_id, v_existing_status
    from public.submissions
    where challenge_id = p_challenge_id and author_id = v_uid and challenge_day = v_day
    limit 1;
  if v_existing_id is not null then
    return json_build_object(
      'id', v_existing_id, 'challenge_day', v_day,
      'status', v_existing_status, 'already_submitted', true
    );
  end if;

  if v_mode = 'solo' then
    v_status := 'verified'; v_verified_at := now();
  else
    v_status := 'pending_verification'; v_verified_at := null;
  end if;

  insert into public.submissions
    (id, challenge_id, author_id, challenge_day, title, comment, media_path, status, verified_at, is_public)
  values
    (p_submission_id, p_challenge_id, v_uid, v_day, v_trimmed_title, p_comment, p_media_path, v_status, v_verified_at, coalesce(p_is_public, false));

  return json_build_object(
    'id', p_submission_id, 'challenge_day', v_day,
    'status', v_status, 'already_submitted', false
  );
end $$;
grant execute on function public.submit_proof(uuid, uuid, text, text, text, boolean) to authenticated;

-- redact_my_submission + p_is_public
drop function if exists public.redact_my_submission(uuid, text, text, text);
create or replace function public.redact_my_submission(
  p_submission_id uuid,
  p_title         text,
  p_media_path    text,
  p_comment       text,
  p_is_public     boolean default null
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

  -- p_is_public NULL = leave unchanged (old client during upgrade window); the new client
  -- always sends the current toggle value. Only an explicit true/false changes it.
  update public.submissions
     set title = v_trimmed_title, media_path = p_media_path,
         comment = nullif(v_trimmed_comment, ''), is_public = coalesce(p_is_public, is_public)
   where id = p_submission_id;

  if v_mode = 'group' then
    delete from public.verifications where submission_id = p_submission_id;
    update public.submissions
       set status = 'pending_verification', verified_at = null, rejected_at = null
     where id = p_submission_id;
  end if;
end $$;
grant execute on function public.redact_my_submission(uuid, text, text, text, boolean) to authenticated;

-- create_challenge + p_visibility
drop function if exists public.create_challenge(uuid, text, text, challenge_mode, date, int, text);
create or replace function public.create_challenge(
  p_group_id          uuid,
  p_title             text,
  p_category          text,
  p_mode              challenge_mode,
  p_start_date        date,
  p_duration_days     int,
  p_proof_requirement text,
  p_visibility        visibility default 'private'
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  if p_mode = 'group' then
    if p_group_id is null then raise exception 'group_id required for group challenge'; end if;
    if not public.is_group_member(p_group_id) then
      raise exception 'must be a member of the group' using errcode = '42501';
    end if;
  else
    if p_group_id is not null then raise exception 'group_id must be null for solo challenge'; end if;
  end if;

  insert into public.challenges
    (group_id, creator_id, title, category, mode, start_date, duration_days, proof_requirement, visibility)
  values
    (p_group_id, v_uid, p_title, p_category, p_mode, p_start_date, p_duration_days, p_proof_requirement, coalesce(p_visibility, 'private'))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.create_challenge(uuid, text, text, challenge_mode, date, int, text, visibility) to authenticated;

-- update_challenge + p_visibility
drop function if exists public.update_challenge(uuid, text, text, int, text);
create or replace function public.update_challenge(
  p_challenge_id      uuid,
  p_title             text,
  p_category          text,
  p_duration_days     int,
  p_proof_requirement text,
  p_visibility        visibility default null
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid              uuid := auth.uid();
  v_creator_id       uuid;
  v_archived         timestamptz;
  v_max_day          int;
  v_trimmed_title    text;
  v_trimmed_proof    text;
  v_category_norm    text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  v_trimmed_title := btrim(coalesce(p_title, ''));
  if length(v_trimmed_title) = 0 then
    raise exception 'title is required' using errcode = '22023';
  end if;
  if length(v_trimmed_title) > 100 then
    raise exception 'title must be at most 100 characters' using errcode = '22023';
  end if;
  v_category_norm := lower(btrim(coalesce(p_category, '')));
  if v_category_norm not in (
    'fitness','reading','meditation','creativity','study','language','work','other'
  ) then
    raise exception 'unknown category' using errcode = '22023';
  end if;
  if p_duration_days is null or p_duration_days < 1 or p_duration_days > 365 then
    raise exception 'duration must be between 1 and 365 days' using errcode = '22023';
  end if;
  v_trimmed_proof := btrim(coalesce(p_proof_requirement, ''));
  if length(v_trimmed_proof) > 280 then
    raise exception 'proof requirement must be at most 280 characters' using errcode = '22023';
  end if;
  if length(v_trimmed_proof) = 0 then v_trimmed_proof := null; end if;

  select creator_id, archived_at into v_creator_id, v_archived
    from public.challenges where id = p_challenge_id;
  if v_creator_id is null then raise exception 'challenge not found' using errcode = 'P0002'; end if;
  if v_creator_id <> v_uid then
    raise exception 'only the creator can edit this challenge' using errcode = '42501';
  end if;
  if v_archived is not null then
    raise exception 'cannot edit an archived challenge' using errcode = '22023';
  end if;

  select max(challenge_day) into v_max_day
    from public.submissions where challenge_id = p_challenge_id;
  if v_max_day is not null and p_duration_days < v_max_day + 1 then
    raise exception 'duration cannot be shorter than existing submissions (need at least % days)',
      v_max_day + 1 using errcode = '22023';
  end if;

  -- p_visibility NULL = leave unchanged (old client during upgrade window).
  update public.challenges
     set title = v_trimmed_title, category = v_category_norm,
         duration_days = p_duration_days, proof_requirement = v_trimmed_proof,
         visibility = coalesce(p_visibility, visibility)
   where id = p_challenge_id;
end $$;
grant execute on function public.update_challenge(uuid, text, text, int, text, visibility) to authenticated;

-- update_group_meta + p_visibility
drop function if exists public.update_group_meta(uuid, text, text, text);
create or replace function public.update_group_meta(
  p_group_id    uuid,
  p_name        text,
  p_description text,
  p_avatar_path text,
  p_visibility  visibility default null
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_owner    uuid;
  v_archived timestamptz;
  v_name     text;
  v_desc     text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select g.owner_id, g.archived_at into v_owner, v_archived
    from public.groups g where g.id = p_group_id;
  if v_owner is null then raise exception 'group not found' using errcode = 'P0002'; end if;
  if v_owner <> v_uid then
    raise exception 'only the owner can edit this group' using errcode = '42501';
  end if;
  if v_archived is not null then
    raise exception 'cannot edit an archived group' using errcode = '22023';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'group name must be 1–60 characters' using errcode = '22023';
  end if;
  v_desc := nullif(btrim(coalesce(p_description, '')), '');
  if v_desc is not null and char_length(v_desc) > 280 then
    raise exception 'description must be at most 280 characters' using errcode = '22023';
  end if;

  -- p_visibility NULL = leave unchanged (old client during upgrade window).
  update public.groups
     set name        = v_name,
         description = v_desc,
         avatar_path = coalesce(p_avatar_path, avatar_path),
         visibility  = coalesce(p_visibility, visibility)
   where id = p_group_id;
end $$;
grant execute on function public.update_group_meta(uuid, text, text, text, visibility) to authenticated;

-- ============================================================
-- 5. Submission read RPCs recreated to RETURN is_public
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
  created_at    timestamptz,
  is_public     boolean
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
  if not public.is_challenge_participant(p_challenge_id) then return; end if;

  select coalesce(profiles.timezone, 'UTC') into v_tz
    from public.profiles where profiles.id = v_uid;
  select challenges.start_date into v_start
    from public.challenges where challenges.id = p_challenge_id;
  if v_start is null then return; end if;
  v_today_day := ((now() at time zone v_tz)::date - v_start);

  return query
    select s.id, s.challenge_id, s.author_id, s.challenge_day, s.title, s.comment,
           s.media_path, s.status, s.verified_at, s.rejected_at, s.created_at, s.is_public
    from public.submissions s
    where s.challenge_id = p_challenge_id
      and s.author_id    = v_uid
      and s.challenge_day = v_today_day
    limit 1;
end $$;
grant execute on function public.get_my_today_submission(uuid) to authenticated;

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
  author_display_name  text,
  is_public            boolean
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not public.is_challenge_participant(p_challenge_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  return query
    select s.id, s.challenge_id, s.author_id, s.challenge_day, s.title, s.comment,
           s.media_path, s.status, s.verified_at, s.rejected_at, s.created_at,
           p.username, p.display_name, s.is_public
    from public.submissions s
    join public.profiles p on p.id = s.author_id
    where s.challenge_id = p_challenge_id
    order by s.created_at desc
    limit greatest(coalesce(p_limit, 20), 1);
end $$;
grant execute on function public.list_challenge_submissions(uuid, int) to authenticated;

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
  author_display_name  text,
  is_public            boolean
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_challenge_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select s.challenge_id into v_challenge_id
    from public.submissions s where s.id = p_submission_id;
  if v_challenge_id is null then return; end if;
  if not public.is_challenge_participant(v_challenge_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  return query
    select s.id, s.challenge_id, s.author_id, s.challenge_day, s.title, s.comment,
           s.media_path, s.status, s.verified_at, s.rejected_at, s.created_at,
           p.username, p.display_name, s.is_public
    from public.submissions s
    join public.profiles p on p.id = s.author_id
    where s.id = p_submission_id;
end $$;
grant execute on function public.get_submission_with_author(uuid) to authenticated;
