-- Patch migration (T-028 / W-023): expose submission author display name to verifiers.
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. See W-023 in
-- BUGS_AND_WARNINGS. Idempotent (CREATE OR REPLACE on both functions).
--
-- WHY: `profiles_select_own` restricts profile SELECT to your own row. A verifier on a
--   group challenge needs to see the submission author's name on the "Recent submissions"
--   list and on the submission detail screen — otherwise rows just read "Day N" with no
--   indication of who submitted. Rather than widen profiles RLS (broader surface), follow
--   the established `group_leaderboard` pattern: a SECURITY DEFINER RPC that returns
--   submissions + author username/display_name in a single round-trip. The RPC enforces
--   participant gating (the widened `is_challenge_participant` from W-022) so outsiders
--   still get nothing.
--
-- SCOPE: only `username` and `display_name` from `profiles` are exposed via these RPCs.
--   Other profile columns (timezone, terms_version, onboarded) remain private.

-- ============================================================
-- 1. list_challenge_submissions(p_challenge_id uuid, p_limit int)
--    Returns recent submissions for a challenge, ordered newest-first, with the
--    author's username + display_name joined in.
-- ============================================================
create or replace function list_challenge_submissions(
  p_challenge_id uuid,
  p_limit        int default 20
) returns table (
  id                   uuid,
  challenge_id         uuid,
  author_id            uuid,
  challenge_day        int,
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
grant execute on function list_challenge_submissions(uuid, int) to authenticated;

-- ============================================================
-- 2. get_submission_with_author(p_submission_id uuid)
--    Returns a single submission + author info. Participant-gated against the
--    submission's challenge.
-- ============================================================
create or replace function get_submission_with_author(p_submission_id uuid)
returns table (
  id                   uuid,
  challenge_id         uuid,
  author_id            uuid,
  challenge_day        int,
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
    -- Return empty rather than raising; the caller (maybeSingle equivalent) treats this
    -- as "submission not found", matching the previous direct-select behavior.
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
grant execute on function get_submission_with_author(uuid) to authenticated;
