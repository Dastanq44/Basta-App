-- Phase 3 migration: group leaderboard (T-043).
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. See W-016 in BUGS_AND_WARNINGS.
--
-- DESIGN (D-003):
--   * Server-authoritative. Ranks every member of a group by their number of VERIFIED proofs
--     across that group's challenges (solo proofs in other challenges don't count — the join is
--     restricted to challenges.group_id = p_group_id).
--   * SECURITY DEFINER so it can read co-members' profiles + submissions, but it first enforces the
--     caller is a member of the group (is_group_member) — non-members get an error, not data.
--   * Members with zero verified proofs are still listed (LEFT JOINs), so the board shows everyone.

create or replace function group_leaderboard(p_group_id uuid)
returns table (
  user_id        uuid,
  username       text,
  display_name   text,
  verified_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not is_group_member(p_group_id) then
    raise exception 'not a member of the group' using errcode = '42501';
  end if;

  return query
    select
      gm.user_id,
      p.username,
      p.display_name,
      count(s.id) filter (where s.status = 'verified') as verified_count
    from public.group_members gm
    join public.profiles p on p.id = gm.user_id
    left join public.challenges c on c.group_id = p_group_id
    left join public.submissions s on s.challenge_id = c.id and s.author_id = gm.user_id
    where gm.group_id = p_group_id
    group by gm.user_id, p.username, p.display_name
    order by verified_count desc, p.username asc nulls last;
end $$;
grant execute on function group_leaderboard(uuid) to authenticated;
