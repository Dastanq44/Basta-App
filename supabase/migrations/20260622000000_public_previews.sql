-- Public preview access for public challenges/groups + a profile-stats privacy fix.
-- Bootstrap frozen (D-013). Idempotent. Apply via Dashboard -> SQL editor or `supabase db push`.
-- Authenticated-only; SECURITY DEFINER; no invite codes / private members / private submissions.
--
--   * get_challenge_access(uuid)               — member OR public-preview access + safe fields/flags
--   * list_public_challenge_submissions(...)   — can_view_submission-filtered, keyset
--   * get_group_access(uuid)                   — member OR public-preview access + safe fields/flags
--   * list_public_group_challenges(uuid,int)   — the group's public, non-archived challenges
--   * list_public_group_submissions(...)       — group's globally-visible verified submissions, keyset
--   * get_profile_overview(uuid)               — RECREATED: streaks exclude submissions the viewer
--                                                can't see (was leaking hidden-challenge activity)

-- ============================================================
-- Challenge access (member or public preview)
-- ============================================================
create or replace function public.get_challenge_access(p_challenge_id uuid)
returns table (
  id                    uuid,
  group_id              uuid,
  creator_id            uuid,
  title                 text,
  category              text,
  mode                  challenge_mode,
  start_date            date,
  duration_days         int,
  proof_requirement     text,
  visibility            visibility,
  archived_at           timestamptz,
  group_name            text,
  group_visibility      visibility,
  viewer_is_participant boolean,
  viewer_is_creator     boolean,
  viewer_group_role     member_role,
  access_mode           text,
  can_submit            boolean,
  can_edit              boolean,
  can_delete            boolean,
  can_report            boolean
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  c        public.challenges%rowtype;
  g        public.groups%rowtype;
  v_part   boolean;
  v_grole  member_role;
  v_member boolean;
  v_public boolean;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into c from public.challenges where challenges.id = p_challenge_id;
  if c.id is null then return; end if;
  if c.group_id is not null then
    select * into g from public.groups where groups.id = c.group_id;
    select gm.role into v_grole from public.group_members gm
      where gm.group_id = c.group_id and gm.user_id = v_uid;
  end if;

  v_part := public.is_challenge_participant(p_challenge_id);
  v_member := v_part;
  -- Public preview: challenge public & active, not blocked, and the gating entity public:
  --   solo  → creator profile public;  group → group public & active.
  v_public := (not v_member)
    and c.visibility = 'public'
    and c.archived_at is null
    and not public.is_block_between(c.creator_id)
    and (
      (c.mode <> 'group'
        and exists (select 1 from public.profiles p where p.id = c.creator_id and p.visibility = 'public'))
      or
      (c.mode = 'group' and g.id is not null and g.visibility = 'public' and g.archived_at is null)
    );

  if not (v_member or v_public) then return; end if;

  return query select
    c.id, c.group_id, c.creator_id, c.title, c.category, c.mode, c.start_date, c.duration_days,
    c.proof_requirement, c.visibility, c.archived_at,
    g.name, g.visibility,
    v_part, (c.creator_id = v_uid), v_grole,
    case when v_member then 'member' else 'public' end,
    (v_member and c.archived_at is null),              -- can_submit
    (c.creator_id = v_uid and c.archived_at is null),  -- can_edit
    (c.creator_id = v_uid and c.archived_at is null),  -- can_delete
    (c.creator_id <> v_uid);                           -- can_report
end $$;
revoke execute on function public.get_challenge_access(uuid) from public;
grant execute on function public.get_challenge_access(uuid) to authenticated;

-- Public-preview submissions for a challenge (can_view_submission-filtered; keyset). Reusable by
-- both member + public viewers, but members keep the private feed (list_challenge_submissions).
create or replace function public.list_public_challenge_submissions(
  p_challenge_id      uuid,
  p_limit             int default 20,
  p_before_created_at timestamptz default null,
  p_before_id         uuid default null
)
returns table (
  id                  uuid,
  challenge_id        uuid,
  author_id           uuid,
  challenge_day       int,
  title               text,
  comment             text,
  media_path          text,
  status              submission_status,
  created_at          timestamptz,
  author_username     text,
  author_display_name text,
  reaction_count      int,
  comment_count       int
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not exists (select 1 from public.get_challenge_access(p_challenge_id)) then return; end if;
  return query
    select s.id, s.challenge_id, s.author_id, s.challenge_day, s.title, s.comment, s.media_path,
           s.status, s.created_at, p.username, p.display_name,
           coalesce(rc.cnt, 0)::int, coalesce(cc.cnt, 0)::int
    from public.submissions s
    join public.profiles p on p.id = s.author_id
    left join lateral (
      select count(*) as cnt from public.submission_reactions r
      where r.submission_id = s.id and not public.is_block_between(r.user_id)
    ) rc on true
    left join lateral (
      select count(*) as cnt from public.submission_comments cm
      where cm.submission_id = s.id and not public.is_block_between(cm.author_id)
    ) cc on true
    where s.challenge_id = p_challenge_id
      and public.can_view_submission(s.id)
      and (p_before_created_at is null or (s.created_at, s.id) < (p_before_created_at, p_before_id))
    order by s.created_at desc, s.id desc
    limit greatest(1, least(coalesce(p_limit, 20), 100));
end $$;
revoke execute on function public.list_public_challenge_submissions(uuid, int, timestamptz, uuid) from public;
grant execute on function public.list_public_challenge_submissions(uuid, int, timestamptz, uuid) to authenticated;

-- ============================================================
-- Group access (member or public preview)
-- ============================================================
create or replace function public.get_group_access(p_group_id uuid)
returns table (
  id           uuid,
  name         text,
  description  text,
  avatar_path  text,
  visibility   visibility,
  archived_at  timestamptz,
  owner_id     uuid,
  member_count int,
  viewer_role  member_role,
  access_mode  text,
  can_edit     boolean,
  can_archive  boolean,
  can_leave    boolean,
  can_report   boolean
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  g        public.groups%rowtype;
  v_role   member_role;
  v_member boolean;
  v_public boolean;
  v_count  int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into g from public.groups where groups.id = p_group_id;
  if g.id is null then return; end if;
  select gm.role into v_role from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = v_uid;
  v_member := v_role is not null;
  v_public := (not v_member) and g.visibility = 'public' and g.archived_at is null
    and not public.is_block_between(g.owner_id);
  if not (v_member or v_public) then return; end if;

  select count(*) into v_count from public.group_members gm where gm.group_id = p_group_id;
  return query select
    g.id, g.name, g.description, g.avatar_path, g.visibility, g.archived_at, g.owner_id,
    coalesce(v_count, 0), v_role,
    case when v_member then 'member' else 'public' end,
    (g.owner_id = v_uid),   -- can_edit
    (g.owner_id = v_uid),   -- can_archive
    v_member,               -- can_leave
    (g.owner_id <> v_uid);  -- can_report
end $$;
revoke execute on function public.get_group_access(uuid) from public;
grant execute on function public.get_group_access(uuid) to authenticated;

-- The group's public, non-archived challenges (safe fields; viewer participation flag). NO invite code.
create or replace function public.list_public_group_challenges(p_group_id uuid, p_limit int default 20)
returns table (
  id             uuid,
  group_id       uuid,
  title          text,
  category       text,
  mode           challenge_mode,
  start_date     date,
  duration_days  int,
  visibility     visibility,
  is_participant boolean
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not exists (select 1 from public.get_group_access(p_group_id)) then return; end if;
  return query
    select c.id, c.group_id, c.title, c.category, c.mode, c.start_date, c.duration_days,
           c.visibility, public.is_challenge_participant(c.id)
    from public.challenges c
    where c.group_id = p_group_id and c.visibility = 'public' and c.archived_at is null
    order by c.start_date desc
    limit greatest(1, least(coalesce(p_limit, 20), 100));
end $$;
revoke execute on function public.list_public_group_challenges(uuid, int) from public;
grant execute on function public.list_public_group_challenges(uuid, int) to authenticated;

-- The group's globally-visible verified submissions (can_view_submission-filtered; keyset).
create or replace function public.list_public_group_submissions(
  p_group_id          uuid,
  p_limit             int default 20,
  p_before_created_at timestamptz default null,
  p_before_id         uuid default null
)
returns table (
  id                  uuid,
  challenge_id        uuid,
  author_id           uuid,
  challenge_day       int,
  title               text,
  comment             text,
  media_path          text,
  status              submission_status,
  created_at          timestamptz,
  author_username     text,
  author_display_name text,
  challenge_title     text,
  reaction_count      int,
  comment_count       int
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not exists (select 1 from public.get_group_access(p_group_id)) then return; end if;
  return query
    select s.id, s.challenge_id, s.author_id, s.challenge_day, s.title, s.comment, s.media_path,
           s.status, s.created_at, p.username, p.display_name, c.title,
           coalesce(rc.cnt, 0)::int, coalesce(cc.cnt, 0)::int
    from public.submissions s
    join public.challenges c on c.id = s.challenge_id
    join public.profiles p on p.id = s.author_id
    left join lateral (
      select count(*) as cnt from public.submission_reactions r
      where r.submission_id = s.id and not public.is_block_between(r.user_id)
    ) rc on true
    left join lateral (
      select count(*) as cnt from public.submission_comments cm
      where cm.submission_id = s.id and not public.is_block_between(cm.author_id)
    ) cc on true
    where c.group_id = p_group_id
      and public.can_view_submission(s.id)
      and (p_before_created_at is null or (s.created_at, s.id) < (p_before_created_at, p_before_id))
    order by s.created_at desc, s.id desc
    limit greatest(1, least(coalesce(p_limit, 20), 100));
end $$;
revoke execute on function public.list_public_group_submissions(uuid, int, timestamptz, uuid) from public;
grant execute on function public.list_public_group_submissions(uuid, int, timestamptz, uuid) to authenticated;

-- ============================================================
-- Profile overview — streak privacy fix (Goal 5)
-- ============================================================
-- The streak day-walk previously counted ALL of the target's verified submissions, leaking
-- hidden/private-challenge activity to other viewers. Now non-owners only count submissions they
-- can_view_submission (owner still sees full). active_challenge_count/group_count already gated.
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
  if v_vis is null then return; end if;
  if not (p_user_id = v_uid or v_vis = 'public' or public.shares_group_or_challenge(v_uid, p_user_id)) then
    return;
  end if;

  select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = p_user_id;
  v_tz := coalesce(v_tz, 'UTC');
  v_today := (now() at time zone v_tz)::date;

  -- current streak (only counting submissions the viewer is allowed to see — owner sees all).
  if exists (
    select 1 from public.submissions s join public.challenges c on c.id = s.challenge_id
    where s.author_id = p_user_id and s.status = 'verified' and (c.start_date + s.challenge_day) = v_today
      and (p_user_id = v_uid or public.can_view_submission(s.id))
  ) then v_anchor := v_today;
  elsif exists (
    select 1 from public.submissions s join public.challenges c on c.id = s.challenge_id
    where s.author_id = p_user_id and s.status = 'verified' and (c.start_date + s.challenge_day) = v_today - 1
      and (p_user_id = v_uid or public.can_view_submission(s.id))
  ) then v_anchor := v_today - 1;
  else v_anchor := null;
  end if;

  if v_anchor is not null then
    v_day := v_anchor;
    while exists (
      select 1 from public.submissions s join public.challenges c on c.id = s.challenge_id
      where s.author_id = p_user_id and s.status = 'verified' and (c.start_date + s.challenge_day) = v_day
        and (p_user_id = v_uid or public.can_view_submission(s.id))
    ) loop
      v_cur := v_cur + 1;
      v_day := v_day - 1;
    end loop;
  end if;

  with verified_days as (
    select distinct (c.start_date + s.challenge_day) as d
      from public.submissions s join public.challenges c on c.id = s.challenge_id
      where s.author_id = p_user_id and s.status = 'verified'
        and (p_user_id = v_uid or public.can_view_submission(s.id))
  ),
  with_island as (select d, d - (row_number() over (order by d))::int as island from verified_days),
  runs as (select count(*)::int as run_len from with_island group by island)
  select coalesce(max(run_len), 0) into v_best from runs;

  select count(*)::int into v_active
  from public.challenges c
  where c.archived_at is null
    and (c.start_date + c.duration_days - 1) >= v_today
    and public.user_participates_in_challenge(p_user_id, c.id)
    and public.viewer_can_see_user_challenge(v_uid, p_user_id, c.id);

  select count(*)::int into v_groups
  from public.groups g
  where g.archived_at is null
    and exists (select 1 from public.group_members gm where gm.group_id = g.id and gm.user_id = p_user_id)
    and public.viewer_can_see_user_group(v_uid, p_user_id, g.id);

  return query select v_cur, v_best, v_active, v_groups;
end $$;
revoke execute on function public.get_profile_overview(uuid) from public;
grant execute on function public.get_profile_overview(uuid) to authenticated;
