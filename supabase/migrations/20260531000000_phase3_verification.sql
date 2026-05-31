-- Phase 3 migration: friend verification (T-040).
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. See W-014 in BUGS_AND_WARNINGS.
--
-- DESIGN (consistent with Phase 1/2):
--   * All client writes go through SECURITY DEFINER RPCs. No direct INSERT/UPDATE on `verifications`.
--   * Server is authoritative for the verified/rejected transition (D-003).
--   * verify_submission enforces who may verify: a challenge participant who is NOT the author.
--   * Outcome rule (D-009): approve count >= challenges.verification_threshold -> 'verified';
--     any single 'reject' -> 'rejected'.
--   * Solo challenges have no friend to verify, so submit_proof auto-verifies them on submit (D-009).
--   * The Phase 2 storage SELECT policy (own-files-only) is widened here so a verifier can view a
--     co-participant's proof media — the Phase 2 file deferred this to "when the verification UI lands".

-- ============================================================
-- Enum + verifications table
-- ============================================================
do $$ begin
  create type verification_result as enum ('approve', 'reject');
exception when duplicate_object then null; end $$;

create table if not exists verifications (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  verifier_id   uuid not null references profiles(id) on delete cascade,
  result        verification_result not null,
  created_at    timestamptz not null default now(),
  unique (submission_id, verifier_id)        -- one (re-votable) vote per verifier
);
create index if not exists verifications_submission_idx on verifications(submission_id);

-- ============================================================
-- RPC: verify_submission
--   * Participant-only, never the author.
--   * Idempotent / re-votable per verifier (upsert on the unique key).
--   * Recomputes the submission status after every vote.
-- ============================================================
create or replace function verify_submission(
  p_submission_id uuid,
  p_result        verification_result
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_challenge_id  uuid;
  v_author_id     uuid;
  v_threshold     int;
  v_approve_count int;
  v_new_status    submission_status;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select s.challenge_id, s.author_id into v_challenge_id, v_author_id
    from public.submissions s where s.id = p_submission_id;
  if v_challenge_id is null then raise exception 'submission not found'; end if;

  if v_author_id = v_uid then
    raise exception 'cannot verify your own proof' using errcode = '42501';
  end if;

  if not is_challenge_participant(v_challenge_id) then
    raise exception 'not a participant of this challenge' using errcode = '42501';
  end if;

  -- Record (or change) this verifier's vote.
  insert into public.verifications (submission_id, verifier_id, result)
    values (p_submission_id, v_uid, p_result)
    on conflict (submission_id, verifier_id)
    do update set result = excluded.result, created_at = now();

  -- Recompute outcome: any reject wins; else approve count vs the challenge threshold.
  select c.verification_threshold into v_threshold
    from public.challenges c
    join public.submissions s on s.challenge_id = c.id
    where s.id = p_submission_id;

  if exists (
    select 1 from public.verifications
    where submission_id = p_submission_id and result = 'reject'
  ) then
    v_new_status := 'rejected';
  else
    select count(*) into v_approve_count
      from public.verifications
      where submission_id = p_submission_id and result = 'approve';
    if v_approve_count >= v_threshold then
      v_new_status := 'verified';
    else
      v_new_status := 'pending_verification';
    end if;
  end if;

  update public.submissions
    set status      = v_new_status,
        verified_at = case when v_new_status = 'verified' then now() else null end,
        rejected_at = case when v_new_status = 'rejected' then now() else null end
    where id = p_submission_id;

  return json_build_object('id', p_submission_id, 'status', v_new_status);
end $$;
grant execute on function verify_submission(uuid, verification_result) to authenticated;

-- ============================================================
-- RPC: submit_proof — REPLACED to auto-verify solo proofs (D-009).
-- Identical to the Phase 2 version except it reads challenges.mode and sets the new
-- submission's status accordingly: solo -> 'verified', group -> 'pending_verification'.
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
  v_mode             challenge_mode;
  v_today_local      date;
  v_day              int;
  v_existing_id      uuid;
  v_existing_status  submission_status;
  v_status           submission_status;
  v_verified_at      timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  if not is_challenge_participant(p_challenge_id) then
    raise exception 'not a participant' using errcode = '42501';
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
    (id, challenge_id, author_id, challenge_day, comment, media_path, status, verified_at)
  values
    (p_submission_id, p_challenge_id, v_uid, v_day, p_comment, p_media_path, v_status, v_verified_at);

  return json_build_object(
    'id', p_submission_id,
    'challenge_day', v_day,
    'status', v_status,
    'already_submitted', false
  );
end $$;
grant execute on function submit_proof(uuid, uuid, text, text) to authenticated;

-- ============================================================
-- RLS — verifications: read-only for challenge participants; writes via the RPC above.
-- ============================================================
alter table verifications enable row level security;

drop policy if exists verifications_select_participant on verifications;
create policy verifications_select_participant on verifications for select using (
  exists (
    select 1 from public.submissions s
    where s.id = verifications.submission_id
      and is_challenge_participant(s.challenge_id)
  )
);

-- ============================================================
-- Storage RLS — widen proof-media SELECT so co-participants (the verifiers) can view proofs.
-- Path convention (from src/offline/upload/storage.ts): <author_uid>/<challenge_id>/<file>.
-- foldername(name) -> {author_uid, challenge_id}; [2] is the challenge id.
-- ============================================================
drop policy if exists storage_proof_media_select on storage.objects;
create policy storage_proof_media_select on storage.objects for select to authenticated
  using (
    bucket_id = 'proof-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text                  -- own files
      or is_challenge_participant(((storage.foldername(name))[2])::uuid) -- co-participant of the challenge
    )
  );
