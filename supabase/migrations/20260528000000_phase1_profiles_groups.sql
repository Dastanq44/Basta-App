-- Phase 1 migration: profiles, groups, group_members + RLS + helpers.
-- Apply via Supabase Dashboard → SQL editor, or `supabase db push` if you use the CLI.
-- This is the FIRST migration applied to the project (T-003). Until it runs, the app's
-- onboarding queries will fail at runtime — see W-010 in BUGS_AND_WARNINGS.
--
-- Scope guardrails:
--   * No challenge/proof/verification tables yet (Phase 2).
--   * No notification_prefs yet (Phase 4 / T-050). Terms acceptance lives in profiles.
--   * RLS policies use SECURITY DEFINER helper functions to avoid recursion on group_members.

-- ============================================================
-- Enums
-- ============================================================
create type member_role as enum ('owner', 'admin', 'member');

-- ============================================================
-- profiles  (1:1 with auth.users)
-- ============================================================
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  -- username/display_name nullable initially: created by the client during profile-setup
  -- (no auto-creation trigger to avoid race conditions on the unique username).
  username      text unique,
  display_name  text,
  avatar_url    text,
  timezone      text not null default 'UTC',     -- drives day-boundary (D-003)
  onboarded     boolean not null default false,
  terms_version text,                            -- compared against CURRENT_TERMS_VERSION client-side
  created_at    timestamptz not null default now()
);

-- ============================================================
-- groups
-- ============================================================
create table groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  owner_id    uuid not null references profiles(id) on delete restrict,
  invite_code text unique not null default encode(gen_random_bytes(6), 'hex'),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- group_members
-- ============================================================
create table group_members (
  group_id  uuid references groups(id) on delete cascade,
  user_id   uuid references profiles(id) on delete cascade,
  role      member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- ============================================================
-- Trigger: when a group is created, auto-insert the owner as a member.
-- Keeps "owner is always a member" invariant without trusting the client.
--
-- MUST be SECURITY DEFINER: the trigger runs as the user who inserted into `groups`, but the
-- RLS policy on `group_members` (`gm_insert_admin`) requires being an admin of that group —
-- which the user only becomes via THIS trigger. Without DEFINER, the trigger's INSERT into
-- `group_members` is rejected by RLS and `createGroup` fails with a confusing RLS error
-- (this was bug B-006). The function only ever copies NEW.id and NEW.owner_id, so the
-- elevated privileges are not abusable.
-- ============================================================
create or replace function add_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into group_members (group_id, user_id, role)
    values (new.id, new.owner_id, 'owner');
  return new;
end $$;

create trigger trg_groups_add_owner
  after insert on groups
  for each row execute function add_owner_member();

-- ============================================================
-- RLS helper functions (SECURITY DEFINER → bypass RLS on group_members
-- to avoid recursion when policies query the same table).
-- ============================================================
create or replace function is_group_member(p_group uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group and user_id = auth.uid()
  );
$$;

create or replace function is_group_admin(p_group uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

grant execute on function is_group_member(uuid) to authenticated;
grant execute on function is_group_admin(uuid) to authenticated;

-- ============================================================
-- RPC: join_group_by_invite — used by clients during onboarding.
-- SECURITY DEFINER lets it look up the group by invite_code (otherwise
-- non-members couldn't SELECT groups). Inserts the caller into
-- group_members; idempotent via ON CONFLICT.
-- ============================================================
create or replace function join_group_by_invite(p_code text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select id into v_group_id
    from public.groups where invite_code = p_code;
  if v_group_id is null then
    raise exception 'invalid invite code' using errcode = 'P0001';
  end if;
  insert into public.group_members (group_id, user_id, role)
    values (v_group_id, auth.uid(), 'member')
    on conflict (group_id, user_id) do nothing;
  return v_group_id;
end $$;

grant execute on function join_group_by_invite(text) to authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table profiles      enable row level security;
alter table groups        enable row level security;
alter table group_members enable row level security;

-- profiles: each user manages their own row only (MVP minimum; broaden later for member lists).
create policy profiles_select_own
  on profiles for select using (id = auth.uid());

create policy profiles_insert_own
  on profiles for insert with check (id = auth.uid());

create policy profiles_update_own
  on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- groups: read if you're a member; create only if you're the owner.
create policy groups_select_member
  on groups for select using (is_group_member(id));

create policy groups_insert_self_owned
  on groups for insert with check (owner_id = auth.uid());

create policy groups_update_owner
  on groups for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy groups_delete_owner
  on groups for delete using (owner_id = auth.uid());

-- group_members: read if you're in the group; insert/delete-other if you're admin/owner;
-- you may always remove yourself.
create policy gm_select_member
  on group_members for select using (is_group_member(group_id));

create policy gm_insert_admin
  on group_members for insert with check (is_group_admin(group_id));

create policy gm_delete_self
  on group_members for delete using (user_id = auth.uid());

create policy gm_delete_admin
  on group_members for delete using (is_group_admin(group_id));
