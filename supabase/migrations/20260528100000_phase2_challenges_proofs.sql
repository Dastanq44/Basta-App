-- Phase 2 migration: challenges, challenge_participants, submissions + RLS + SECURITY DEFINER
-- RPCs for safe writes. Apply via Supabase Dashboard → SQL editor or `supabase db push`.
--
-- DESIGN: all client writes go through SECURITY DEFINER RPCs (mirroring the Phase 1 fixes for
-- B-006/B-008). Direct INSERTs from the client are disabled (no RLS insert policy granted).
-- This avoids the RLS/JWT chicken-and-egg class of failures we hit on `groups`.
--
-- STORAGE: requires a private bucket `proof-media` (created manually in the Dashboard — see
-- W-011 in BUGS_AND_WARNINGS). Storage RLS policies are at the bottom of this file.

-- ============================================================
-- Enums
-- ============================================================
create type challenge_mode    as enum ('solo', 'group');
create type submission_status as enum ('pending_verification', 'verified', 'rejected');

-- ============================================================
-- challenges
-- ============================================================
create table challenges (
  id                      uuid primary key default gen_random_uuid(),
  group_id                uuid references groups(id) on delete cascade,
  creator_id              uuid not null references profiles(id) on delete restrict,
  title                   text not null check (char_length(title) between 1 and 100),
  category                text not null check (char_length(category) between 1 and 60),
  mode                    challenge_mode not null,
  start_date              date not null,
  duration_days           int  not null check (duration_days between 1 and 365),
  proof_requirement       text check (char_length(proof_requirement) <= 280),
  verification_threshold  int  not null default 1 check (verification_threshold >= 1),
  created_at              timestamptz not null default now(),
  check ((mode = 'group') = (group_id is not null))
);
create index challenges_group_id_idx on challenges(group_id) where group_id is not null;
create index challenges_creator_id_idx on challenges(creator_id);

-- ============================================================
-- challenge_participants
-- ============================================================
create table challenge_participants (
  challenge_id uuid references challenges(id) on delete cascade,
  user_id      uuid references profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index cp_user_idx on challenge_participants(user_id);

-- ============================================================
-- submissions
-- ============================================================
create table submissions (
  id            uuid primary key,                              -- client-generated for idempotency
  challenge_id  uuid not null references challenges(id) on delete cascade,
  author_id     uuid not null references profiles(id) on delete cascade,
  challenge_day int  not null check (challenge_day >= 0),      -- server-computed (D-003)
  comment       text check (char_length(comment) <= 500),
  media_path    text,                                          -- private storage object path
  status        submission_status not null default 'pending_verification',
  verified_at   timestamptz,
  rejected_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (challenge_id, author_id, challenge_day)              -- one proof per day per author
);
create index submissions_challenge_day_idx on submissions(challenge_id, challenge_day);
create index submissions_author_idx on submissions(author_id);

-- ============================================================
-- Triggers
-- ============================================================
-- Auto-add creator as a participant when a challenge is created.
create or replace function add_creator_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into challenge_participants (challenge_id, user_id) values (new.id, new.creator_id);
  return new;
end $$;

create trigger trg_challenges_add_creator
  after insert on challenges
  for each row execute function add_creator_participant();

-- Touch updated_at on submissions changes.
create or replace function touch_submissions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_submissions_touch_updated_at
  before update on submissions
  for each row execute function touch_submissions_updated_at();

-- ============================================================
-- Helper functions (SECURITY DEFINER → bypass RLS to avoid recursion)
-- ============================================================
create or replace function is_challenge_participant(p_challenge uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.challenge_participants
    where challenge_id = p_challenge and user_id = auth.uid()
  );
$$;
grant execute on function is_challenge_participant(uuid) to authenticated;

-- ============================================================
-- RPC: create_challenge
-- ============================================================
create or replace function create_challenge(
  p_group_id          uuid,
  p_title             text,
  p_category          text,
  p_mode              challenge_mode,
  p_start_date        date,
  p_duration_days     int,
  p_proof_requirement text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  if p_mode = 'group' then
    if p_group_id is null then
      raise exception 'group_id required for group challenge';
    end if;
    if not is_group_member(p_group_id) then
      raise exception 'must be a member of the group' using errcode = '42501';
    end if;
  else
    if p_group_id is not null then
      raise exception 'group_id must be null for solo challenge';
    end if;
  end if;

  insert into public.challenges
    (group_id, creator_id, title, category, mode, start_date, duration_days, proof_requirement)
  values
    (p_group_id, v_uid, p_title, p_category, p_mode, p_start_date, p_duration_days, p_proof_requirement)
  returning id into v_id;

  return v_id;
end $$;
grant execute on function create_challenge(uuid, text, text, challenge_mode, date, int, text) to authenticated;

-- ============================================================
-- RPC: join_challenge
-- ============================================================
create or replace function join_challenge(p_challenge uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_mode challenge_mode;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select group_id, mode into v_group_id, v_mode from public.challenges where id = p_challenge;
  if v_mode is null then raise exception 'challenge not found'; end if;
  if v_mode = 'group' and not is_group_member(v_group_id) then
    raise exception 'not a member of the group' using errcode = '42501';
  end if;
  insert into public.challenge_participants (challenge_id, user_id)
    values (p_challenge, v_uid)
    on conflict (challenge_id, user_id) do nothing;
end $$;
grant execute on function join_challenge(uuid) to authenticated;

-- ============================================================
-- RPC: submit_proof
--   * Server computes challenge_day from profiles.timezone + challenges.start_date (D-003).
--   * Idempotent: if a row with (challenge_id, author_id, challenge_day) already exists,
--     returns the existing submission instead of erroring — so a retried queue job that
--     succeeded server-side but lost its ack doesn't fail/duplicate.
-- ============================================================
create or replace function submit_proof(
  p_submission_id uuid,
  p_challenge_id  uuid,
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
  v_today_local      date;
  v_day              int;
  v_existing_id      uuid;
  v_existing_status  submission_status;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  if not is_challenge_participant(p_challenge_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = v_uid;
  select start_date into v_start from public.challenges where id = p_challenge_id;
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

  insert into public.submissions
    (id, challenge_id, author_id, challenge_day, comment, media_path, status)
  values
    (p_submission_id, p_challenge_id, v_uid, v_day, p_comment, p_media_path, 'pending_verification');

  return json_build_object(
    'id', p_submission_id,
    'challenge_day', v_day,
    'status', 'pending_verification',
    'already_submitted', false
  );
end $$;
grant execute on function submit_proof(uuid, uuid, text, text) to authenticated;

-- ============================================================
-- RLS — read policies only. Writes go through the RPCs above.
-- ============================================================
alter table challenges            enable row level security;
alter table challenge_participants enable row level security;
alter table submissions           enable row level security;

-- challenges: visible to participants AND to members of the host group (so they can see /
-- decide to join a group challenge they're not yet a participant of).
create policy challenges_select on challenges for select using (
  is_challenge_participant(id)
  or (group_id is not null and is_group_member(group_id))
);
-- creator may update their own challenge (e.g. fix typo). No delete via RLS in Phase 2.
create policy challenges_update_creator on challenges for update
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());

-- challenge_participants: read if you're in the same challenge.
create policy cp_select_in_challenge on challenge_participants for select using (
  is_challenge_participant(challenge_id)
);
-- self-leave is allowed.
create policy cp_delete_self on challenge_participants for delete using (user_id = auth.uid());

-- submissions: read if you participate in the challenge.
create policy submissions_select_participant on submissions for select using (
  is_challenge_participant(challenge_id)
);

-- ============================================================
-- Storage RLS for the `proof-media` bucket.
--
-- The bucket itself must be CREATED MANUALLY in the Supabase Dashboard
--   (Storage → New bucket → name: proof-media → Public: OFF) — see W-011.
-- These policies enforce the path convention: <auth.uid()>/<challenge_id>/<file>.
-- ============================================================
-- Authenticated users may upload only into their own user-id-prefixed folder.
create policy storage_proof_media_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'proof-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users may read their own files (other-participant reads are widened in Phase 3
-- when the verification UI lands).
create policy storage_proof_media_select on storage.objects for select to authenticated
  using (
    bucket_id = 'proof-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
