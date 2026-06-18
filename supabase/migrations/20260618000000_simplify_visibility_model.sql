-- Simplify the Global visibility model (product decision). Bootstrap stays frozen (D-013).
-- Idempotent. Apply via Supabase Dashboard -> SQL editor or `supabase db push`.
--
-- New model (Spotify-playlist style):
--   * profiles / groups / challenges default PUBLIC (visible). User opts OUT (private / hidden).
--   * submissions have NO user-facing public/private toggle. They inherit Global eligibility from
--     their author profile + challenge (+ group) + verification + blocks.
--   * `submissions.is_public` is DEPRECATED (kept, not dropped). A new internal escape hatch
--     `submissions.hidden_from_global` replaces it as the only submission-level gate.
--
-- Global stays AUTHENTICATED-only and SERVER-enforced; proof-media stays private.

-- ============================================================
-- 1. Default everything to public/visible (new rows only)
-- ============================================================
-- Existing rows are left as-is (explicit private stays private). The columns are NOT NULL, so
-- there are no nulls to coerce.
alter table public.profiles   alter column visibility set default 'public';
alter table public.groups     alter column visibility set default 'public';
alter table public.challenges alter column visibility set default 'public';

-- ============================================================
-- 2. submissions.hidden_from_global (internal escape hatch) + backfill from is_public
-- ============================================================
alter table public.submissions
  add column if not exists hidden_from_global boolean not null default false;

-- One-time preservation of prior per-submission intent: a submission that was NOT opted in to
-- Global under the old model (is_public = false) stays out of Global as hidden_from_global = true.
-- New submissions default hidden_from_global = false (globally eligible if their parents qualify).
update public.submissions set hidden_from_global = true where is_public = false;

-- ============================================================
-- 3. Simplified Global eligibility predicate
-- ============================================================
-- Drops the `is_public = true` requirement; adds `hidden_from_global = false`. All other gates
-- (verified, author/challenge/group public & not archived, block both ways) unchanged.
-- can_view_submission(), the proof-media SELECT policy, list_global_submissions() and
-- list_viewable_user_submissions() all delegate to this, so they update transitively.
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
      and s.hidden_from_global = false
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
revoke execute on function public.is_submission_globally_visible(uuid) from public;
grant execute on function public.is_submission_globally_visible(uuid) to authenticated;

-- ============================================================
-- 4. create_group / create_challenge default to public
-- ============================================================
-- Same signatures (create or replace) — just flip the visibility default/fallback so a create that
-- omits visibility (e.g. an old client during the upgrade window) is PUBLIC, matching the new model.
create or replace function public.create_group(p_name text, p_visibility visibility default 'public')
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  insert into public.groups (name, owner_id, visibility)
    values (p_name, v_uid, coalesce(p_visibility, 'public'))
    returning id into v_group_id;
  return v_group_id;
end $$;
revoke execute on function public.create_group(text, visibility) from public;
grant execute on function public.create_group(text, visibility) to authenticated;

create or replace function public.create_challenge(
  p_group_id          uuid,
  p_title             text,
  p_category          text,
  p_mode              challenge_mode,
  p_start_date        date,
  p_duration_days     int,
  p_proof_requirement text,
  p_visibility        visibility default 'public'
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
    (p_group_id, v_uid, p_title, p_category, p_mode, p_start_date, p_duration_days, p_proof_requirement, coalesce(p_visibility, 'public'))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.create_challenge(uuid, text, text, challenge_mode, date, int, text, visibility) from public;
grant execute on function public.create_challenge(uuid, text, text, challenge_mode, date, int, text, visibility) to authenticated;
