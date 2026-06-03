-- Patch migration (T-029 / W-024): in-place edit of group + challenge metadata.
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. See W-024 in
-- BUGS_AND_WARNINGS. Idempotent (CREATE OR REPLACE on both functions).
--
-- WHY: until now, groups and challenges were write-once after creation — there was no path
--   to fix a typo in a group name or challenge title, swap a category, extend a duration, or
--   update the proof requirement. Owners/creators have asked for in-place edit.
--
-- SCOPE — what's editable, intentionally tight:
--   * group: name (owner-only). Invite code stays auto-generated and untouched.
--   * challenge: title, category, duration_days, proof_requirement (creator-only).
-- WHAT'S NOT EDITABLE — and why:
--   * challenges.start_date — submissions.challenge_day was computed against this at
--     submit time; rewriting it would silently invalidate every existing proof's day index.
--   * challenges.mode (solo/group) and group_id — fundamentally different semantics; a
--     migration of existing submissions would be required.
--   * challenges.verification_threshold — would retroactively change which past submissions
--     count as verified.
--
-- DURATION SHRINK GUARD: if a creator shrinks duration_days below the highest existing
-- submission's challenge_day + 1, that submission would sit past the new end of the
-- challenge. We reject it server-side rather than silently orphan history.

-- ============================================================
-- 1. update_group(p_group_id uuid, p_name text)
-- ============================================================
create or replace function update_group(p_group_id uuid, p_name text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_owner_id  uuid;
  v_archived  timestamptz;
  v_trimmed   text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  v_trimmed := btrim(coalesce(p_name, ''));
  if length(v_trimmed) = 0 then
    raise exception 'group name is required' using errcode = '22023';
  end if;
  if length(v_trimmed) > 60 then
    raise exception 'group name must be at most 60 characters' using errcode = '22023';
  end if;

  select owner_id, archived_at into v_owner_id, v_archived
    from public.groups where id = p_group_id;
  if v_owner_id is null then
    raise exception 'group not found' using errcode = 'P0002';
  end if;
  if v_owner_id <> v_uid then
    raise exception 'only the owner can rename a group' using errcode = '42501';
  end if;
  if v_archived is not null then
    raise exception 'cannot rename an archived group' using errcode = '22023';
  end if;

  update public.groups set name = v_trimmed where id = p_group_id;
end $$;
grant execute on function update_group(uuid, text) to authenticated;

-- ============================================================
-- 2. update_challenge(p_challenge_id uuid, p_title text, p_category text,
--                     p_duration_days int, p_proof_requirement text)
-- ============================================================
create or replace function update_challenge(
  p_challenge_id      uuid,
  p_title             text,
  p_category          text,
  p_duration_days     int,
  p_proof_requirement text
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

  -- Title.
  v_trimmed_title := btrim(coalesce(p_title, ''));
  if length(v_trimmed_title) = 0 then
    raise exception 'title is required' using errcode = '22023';
  end if;
  if length(v_trimmed_title) > 100 then
    raise exception 'title must be at most 100 characters' using errcode = '22023';
  end if;

  -- Category — allow-list mirrors src/features/challenges/model/schemas.ts.
  v_category_norm := lower(btrim(coalesce(p_category, '')));
  if v_category_norm not in (
    'fitness','reading','meditation','creativity','study','language','work','other'
  ) then
    raise exception 'unknown category' using errcode = '22023';
  end if;

  -- Duration.
  if p_duration_days is null or p_duration_days < 1 or p_duration_days > 365 then
    raise exception 'duration must be between 1 and 365 days' using errcode = '22023';
  end if;

  -- Proof requirement — nullable, ≤280 chars.
  v_trimmed_proof := btrim(coalesce(p_proof_requirement, ''));
  if length(v_trimmed_proof) > 280 then
    raise exception 'proof requirement must be at most 280 characters' using errcode = '22023';
  end if;
  if length(v_trimmed_proof) = 0 then
    v_trimmed_proof := null;
  end if;

  -- Creator check + not-archived guard.
  select creator_id, archived_at into v_creator_id, v_archived
    from public.challenges where id = p_challenge_id;
  if v_creator_id is null then
    raise exception 'challenge not found' using errcode = 'P0002';
  end if;
  if v_creator_id <> v_uid then
    raise exception 'only the creator can edit this challenge' using errcode = '42501';
  end if;
  if v_archived is not null then
    raise exception 'cannot edit an archived challenge' using errcode = '22023';
  end if;

  -- Duration-shrink guard: don't allow shrinking below the highest existing challenge_day.
  select max(challenge_day) into v_max_day
    from public.submissions where challenge_id = p_challenge_id;
  if v_max_day is not null and p_duration_days < v_max_day + 1 then
    raise exception 'duration cannot be shorter than existing submissions (need at least % days)',
      v_max_day + 1 using errcode = '22023';
  end if;

  update public.challenges
     set title             = v_trimmed_title,
         category          = v_category_norm,
         duration_days     = p_duration_days,
         proof_requirement = v_trimmed_proof
   where id = p_challenge_id;
end $$;
grant execute on function update_challenge(uuid, text, text, int, text) to authenticated;
