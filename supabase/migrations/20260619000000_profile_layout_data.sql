-- Profile redesign data — stats + Challenges/Groups tabs for the redesigned profile.
-- Bootstrap stays frozen (D-013). Idempotent. Apply via Dashboard -> SQL editor or `supabase db push`.
--
-- Does NOT change the privacy model or Global feed. All reads are visibility-aware + server-enforced;
-- no invite codes / internal fields are exposed.
--
-- Helpers (reused by all three RPCs so the visibility logic lives in one place):
--   * user_participates_in_challenge(user, challenge)
--   * viewer_can_see_user_challenge(viewer, target, challenge)
--   * viewer_can_see_user_group(viewer, target, group)
-- RPCs:
--   * get_profile_overview(user)              — streaks + visible challenge/group counts (gated)
--   * list_viewable_user_challenges(user,lim) — Challenges tab
--   * list_viewable_user_groups(user,lim)     — Groups tab

-- ============================================================
-- Helpers
-- ============================================================
-- Does p_user participate in the challenge? Explicit participant OR group member of a group challenge.
create or replace function public.user_participates_in_challenge(p_user uuid, p_challenge uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
      select 1 from public.challenge_participants cp
      where cp.challenge_id = p_challenge and cp.user_id = p_user
    )
    or exists (
      select 1 from public.challenges c
      join public.group_members gm on gm.group_id = c.group_id
      where c.id = p_challenge and c.mode = 'group' and gm.user_id = p_user
    );
$$;
revoke execute on function public.user_participates_in_challenge(uuid, uuid) from public;
grant execute on function public.user_participates_in_challenge(uuid, uuid) to authenticated;

-- May the viewer see that p_target participates in this challenge?
-- self, OR the viewer participates (shared — uses auth.uid()), OR it's a public challenge on a
-- public target profile (group also public for group challenges) and not archived.
create or replace function public.viewer_can_see_user_challenge(p_viewer uuid, p_target uuid, p_challenge uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    p_viewer = p_target
    or public.is_challenge_participant(p_challenge)
    or exists (
      select 1
      from public.challenges c
      join public.profiles tp on tp.id = p_target
      left join public.groups g on g.id = c.group_id
      where c.id = p_challenge
        and c.visibility = 'public'
        and c.archived_at is null
        and tp.visibility = 'public'
        and (c.mode <> 'group' or (g.id is not null and g.visibility = 'public' and g.archived_at is null))
    );
$$;
revoke execute on function public.viewer_can_see_user_challenge(uuid, uuid, uuid) from public;
grant execute on function public.viewer_can_see_user_challenge(uuid, uuid, uuid) to authenticated;

-- May the viewer see that p_target belongs to this group?
-- self, OR the viewer is a co-member (auth.uid()), OR it's a public group on a public target profile.
create or replace function public.viewer_can_see_user_group(p_viewer uuid, p_target uuid, p_group uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    p_viewer = p_target
    or public.is_group_member(p_group)
    or exists (
      select 1
      from public.groups g
      join public.profiles tp on tp.id = p_target
      where g.id = p_group
        and g.visibility = 'public'
        and g.archived_at is null
        and tp.visibility = 'public'
    );
$$;
revoke execute on function public.viewer_can_see_user_group(uuid, uuid, uuid) from public;
grant execute on function public.viewer_can_see_user_group(uuid, uuid, uuid) to authenticated;

-- ============================================================
-- get_profile_overview — stats row + world-rank inputs (gated)
-- ============================================================
-- Returns ONE row only when the viewer may see the profile (self / public / shares a group or
-- challenge). Returns no row otherwise → the client renders "This profile is private". Streaks are
-- the parameterized version of get_my_streak_aggregate computed for p_user_id in their timezone.
create or replace function public.get_profile_overview(p_user_id uuid)
returns table (
  current_streak         int,
  best_streak            int,
  active_challenge_count int,
  group_count            int
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_vis    visibility;
  v_tz     text;
  v_today  date;
  v_anchor date;
  v_day    date;
  v_cur    int := 0;
  v_best   int := 0;
  v_active int := 0;
  v_groups int := 0;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select pr.visibility into v_vis from public.profiles pr where pr.id = p_user_id;
  if v_vis is null then return; end if;  -- no such profile
  if not (p_user_id = v_uid or v_vis = 'public' or public.shares_group_or_challenge(v_uid, p_user_id)) then
    return;  -- private + unrelated → no stats
  end if;

  select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = p_user_id;
  v_tz := coalesce(v_tz, 'UTC');
  v_today := (now() at time zone v_tz)::date;

  -- current streak: anchor on today or yesterday, then walk back over consecutive verified days.
  if exists (
    select 1 from public.submissions s join public.challenges c on c.id = s.challenge_id
    where s.author_id = p_user_id and s.status = 'verified' and (c.start_date + s.challenge_day) = v_today
  ) then v_anchor := v_today;
  elsif exists (
    select 1 from public.submissions s join public.challenges c on c.id = s.challenge_id
    where s.author_id = p_user_id and s.status = 'verified' and (c.start_date + s.challenge_day) = v_today - 1
  ) then v_anchor := v_today - 1;
  else v_anchor := null;
  end if;

  if v_anchor is not null then
    v_day := v_anchor;
    while exists (
      select 1 from public.submissions s join public.challenges c on c.id = s.challenge_id
      where s.author_id = p_user_id and s.status = 'verified' and (c.start_date + s.challenge_day) = v_day
    ) loop
      v_cur := v_cur + 1;
      v_day := v_day - 1;
    end loop;
  end if;

  -- best streak: longest run of consecutive verified days.
  with verified_days as (
    select distinct (c.start_date + s.challenge_day) as d
      from public.submissions s join public.challenges c on c.id = s.challenge_id
      where s.author_id = p_user_id and s.status = 'verified'
  ),
  with_island as (select d, d - (row_number() over (order by d))::int as island from verified_days),
  runs as (select count(*)::int as run_len from with_island group by island)
  select coalesce(max(run_len), 0) into v_best from runs;

  -- active (not-yet-completed, not archived) challenges the viewer may see.
  select count(*)::int into v_active
  from public.challenges c
  where c.archived_at is null
    and (c.start_date + c.duration_days - 1) >= v_today
    and public.user_participates_in_challenge(p_user_id, c.id)
    and public.viewer_can_see_user_challenge(v_uid, p_user_id, c.id);

  -- groups the viewer may see.
  select count(*)::int into v_groups
  from public.groups g
  where g.archived_at is null
    and exists (select 1 from public.group_members gm where gm.group_id = g.id and gm.user_id = p_user_id)
    and public.viewer_can_see_user_group(v_uid, p_user_id, g.id);

  return query select v_cur, v_best, v_active, v_groups;
end $$;
revoke execute on function public.get_profile_overview(uuid) from public;
grant execute on function public.get_profile_overview(uuid) to authenticated;

-- ============================================================
-- list_viewable_user_challenges — Challenges tab
-- ============================================================
-- Excludes archived. `is_participant` = whether the VIEWER participates (drives tappability —
-- /challenge/[id] RLS only allows participants; public non-participant cards are info-only).
create or replace function public.list_viewable_user_challenges(p_user_id uuid, p_limit int default 50)
returns table (
  id             uuid,
  group_id       uuid,
  title          text,
  category       text,
  mode           challenge_mode,
  start_date     date,
  duration_days  int,
  group_name     text,
  visibility     visibility,
  is_participant boolean
)
language plpgsql stable security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  return query
    select c.id, c.group_id, c.title, c.category, c.mode, c.start_date, c.duration_days,
           g.name, c.visibility, public.is_challenge_participant(c.id)
    from public.challenges c
    left join public.groups g on g.id = c.group_id
    where c.archived_at is null
      and public.user_participates_in_challenge(p_user_id, c.id)
      and public.viewer_can_see_user_challenge(v_uid, p_user_id, c.id)
    order by c.start_date desc
    limit greatest(1, least(coalesce(p_limit, 50), 100));
end $$;
revoke execute on function public.list_viewable_user_challenges(uuid, int) from public;
grant execute on function public.list_viewable_user_challenges(uuid, int) to authenticated;

-- ============================================================
-- list_viewable_user_groups — Groups tab
-- ============================================================
-- Safe fields only (NO invite_code). `viewer_role` is null when the viewer isn't a member (drives
-- tappability — /group/[id] RLS only allows members; public non-member cards are info-only).
create or replace function public.list_viewable_user_groups(p_user_id uuid, p_limit int default 50)
returns table (
  id           uuid,
  name         text,
  description  text,
  avatar_path  text,
  visibility   visibility,
  member_count int,
  viewer_role  member_role,
  target_role  member_role
)
language plpgsql stable security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  return query
    select
      g.id, g.name, g.description, g.avatar_path, g.visibility,
      (select count(*)::int from public.group_members gm where gm.group_id = g.id),
      (select gm.role from public.group_members gm where gm.group_id = g.id and gm.user_id = v_uid),
      (select gm.role from public.group_members gm where gm.group_id = g.id and gm.user_id = p_user_id)
    from public.groups g
    where g.archived_at is null
      and exists (select 1 from public.group_members gm where gm.group_id = g.id and gm.user_id = p_user_id)
      and public.viewer_can_see_user_group(v_uid, p_user_id, g.id)
    order by g.created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100));
end $$;
revoke execute on function public.list_viewable_user_groups(uuid, int) from public;
grant execute on function public.list_viewable_user_groups(uuid, int) to authenticated;
