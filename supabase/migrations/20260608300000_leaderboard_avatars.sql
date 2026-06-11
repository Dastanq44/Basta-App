-- Slice T-053-D / W-037: group_leaderboard returns avatar_url.
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. Idempotent.
--
-- WHY: leaderboard rows now show an avatar between the rank number and the name.
--   The existing `group_leaderboard` RPC returned only `user_id, username,
--   display_name, verified_count` — we add `avatar_url` so the client can render
--   the avatar without a second per-row profile fetch. profiles.avatar_url is
--   public via the W-031 RLS widening, but rolling it into this RPC keeps the
--   leaderboard one round-trip.
--
-- TOUCHES:
--   * `group_leaderboard(uuid)` — drop + recreate with a new column in RETURNS TABLE.
--     CREATE OR REPLACE can't change the return shape.

drop function if exists public.group_leaderboard(uuid);

create or replace function public.group_leaderboard(p_group_id uuid)
returns table (
  user_id        uuid,
  username       text,
  display_name   text,
  avatar_url     text,
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
grant execute on function public.group_leaderboard(uuid) to authenticated;
