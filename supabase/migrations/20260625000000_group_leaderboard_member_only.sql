-- Privacy hardening: the public group preview no longer shows a leaderboard, and non-members must
-- not be able to read group member identities + proof counts even via a direct RPC call. Re-gate
-- list_public_group_leaderboard from `get_group_access` (member OR public) to MEMBER-ONLY, matching
-- the original group_leaderboard. (Kept as a function so the member group screen could use either.)
-- Bootstrap frozen (D-013). Idempotent. Apply via Dashboard -> SQL editor or `supabase db push`.
create or replace function public.list_public_group_leaderboard(p_group_id uuid)
returns table (
  user_id        uuid,
  username       text,
  display_name   text,
  avatar_url     text,
  verified_count bigint
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  -- Members only — a non-member (even of a PUBLIC group) gets no rows.
  if not public.is_group_member(p_group_id) then return; end if;
  return query
    select
      gm.user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      count(s.id) filter (where s.status = 'verified') as verified_count
    from public.group_members gm
    join public.profiles p on p.id = gm.user_id
    left join public.challenges c on c.group_id = p_group_id
    left join public.submissions s on s.challenge_id = c.id and s.author_id = gm.user_id
    where gm.group_id = p_group_id
    group by gm.user_id, p.username, p.display_name, p.avatar_url
    order by verified_count desc, p.username asc nulls last;
end $$;
revoke execute on function public.list_public_group_leaderboard(uuid) from public;
grant execute on function public.list_public_group_leaderboard(uuid) to authenticated;
