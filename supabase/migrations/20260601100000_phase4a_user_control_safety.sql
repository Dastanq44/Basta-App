-- Phase 4A migration: user-control + trust/safety basics.
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. See W-019 in
-- BUGS_AND_WARNINGS. Idempotent (uses `add column if not exists`, `create table if not exists`,
-- `create or replace function`, conditional enum block, and `drop policy if exists` + `create
-- policy` for the RLS policies since PostgreSQL doesn't support `create policy if not exists`).
--
-- SCOPE:
--   * Archive (NOT hard-delete) for groups and challenges.
--   * leave_group / archive_group / archive_challenge RPCs (SECURITY DEFINER).
--   * reports / blocks / account_deletion_requests tables + supporting RPCs.
--   * `is_blocked_by_me(uid)` helper (SECURITY DEFINER) for future server-side filtering.
--
-- ALL CLIENT WRITES go through SECURITY DEFINER RPCs (consistent with B-006/B-008/D-009 path).
-- Direct INSERT/UPDATE policies on these new tables are intentionally NOT granted.

-- ============================================================
-- Archive columns (soft-delete pattern)
-- ============================================================
alter table public.groups
  add column if not exists archived_at timestamptz;
alter table public.groups
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

alter table public.challenges
  add column if not exists archived_at timestamptz;
alter table public.challenges
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type report_target as enum ('submission', 'comment', 'user', 'group', 'challenge');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Tables
-- ============================================================
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type report_target not null,
  target_id   uuid not null,
  reason      text not null check (char_length(reason) between 1 and 100),
  details     text check (char_length(details) <= 1000),
  status      text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at  timestamptz not null default now()
);
create index if not exists reports_reporter_idx on public.reports(reporter_id);
create index if not exists reports_target_idx   on public.reports(target_type, target_id);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks(blocked_id);

create table if not exists public.account_deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'processing', 'done', 'cancelled')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  notes        text
);
-- At most one open request per user; reopens after cancel/done.
create unique index if not exists adr_one_pending_per_user
  on public.account_deletion_requests(user_id) where status = 'pending';

-- ============================================================
-- Helpers
-- ============================================================
create or replace function is_blocked_by_me(p_user uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where blocker_id = auth.uid() and blocked_id = p_user
  );
$$;
grant execute on function is_blocked_by_me(uuid) to authenticated;

-- ============================================================
-- RPCs: archive / leave
-- ============================================================
create or replace function leave_group(p_group_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_owner_id      uuid;
  v_my_role       member_role;
  v_other_owners  int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select owner_id into v_owner_id
    from public.groups where id = p_group_id and archived_at is null;
  if v_owner_id is null then
    raise exception 'group not found' using errcode = 'P0002';
  end if;

  select role into v_my_role
    from public.group_members where group_id = p_group_id and user_id = v_uid;
  if v_my_role is null then
    raise exception 'you are not a member of this group' using errcode = 'P0002';
  end if;

  -- A sole owner cannot leave (would orphan the group).
  if v_owner_id = v_uid then
    select count(*) into v_other_owners
      from public.group_members
      where group_id = p_group_id
        and user_id <> v_uid
        and role in ('owner', 'admin');
    if v_other_owners = 0 then
      raise exception 'cannot leave as sole owner — archive the group or promote another member first' using errcode = 'P0001';
    end if;
  end if;

  delete from public.group_members where group_id = p_group_id and user_id = v_uid;
end $$;
grant execute on function leave_group(uuid) to authenticated;

create or replace function archive_group(p_group_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_owner_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select owner_id into v_owner_id from public.groups where id = p_group_id;
  if v_owner_id is null then raise exception 'group not found' using errcode = 'P0002'; end if;
  if v_owner_id <> v_uid then
    raise exception 'only the owner can archive a group' using errcode = '42501';
  end if;
  update public.groups
     set archived_at = now(), archived_by = v_uid
     where id = p_group_id and archived_at is null;
end $$;
grant execute on function archive_group(uuid) to authenticated;

create or replace function archive_challenge(p_challenge_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_creator_id  uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select creator_id into v_creator_id from public.challenges where id = p_challenge_id;
  if v_creator_id is null then raise exception 'challenge not found' using errcode = 'P0002'; end if;
  if v_creator_id <> v_uid then
    raise exception 'only the creator can archive this challenge' using errcode = '42501';
  end if;
  update public.challenges
     set archived_at = now(), archived_by = v_uid
     where id = p_challenge_id and archived_at is null;
end $$;
grant execute on function archive_challenge(uuid) to authenticated;

-- ============================================================
-- RPCs: report / block / deletion
-- ============================================================
create or replace function report_target(
  p_target_type report_target,
  p_target_id   uuid,
  p_reason      text,
  p_details     text
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'reason is required' using errcode = 'P0001';
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
    values (v_uid, p_target_type, p_target_id, trim(p_reason), p_details)
    returning id into v_id;
  return v_id;
end $$;
grant execute on function report_target(report_target, uuid, text, text) to authenticated;

create or replace function block_user(p_user_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if v_uid = p_user_id then raise exception 'cannot block yourself' using errcode = 'P0001'; end if;
  insert into public.blocks (blocker_id, blocked_id)
    values (v_uid, p_user_id)
    on conflict (blocker_id, blocked_id) do nothing;
end $$;
grant execute on function block_user(uuid) to authenticated;

create or replace function unblock_user(p_user_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  delete from public.blocks where blocker_id = v_uid and blocked_id = p_user_id;
end $$;
grant execute on function unblock_user(uuid) to authenticated;

create or replace function request_account_deletion()
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  -- Idempotent: if a pending request exists, return it.
  select id into v_id from public.account_deletion_requests
    where user_id = v_uid and status = 'pending' limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.account_deletion_requests (user_id) values (v_uid) returning id into v_id;
  return v_id;
end $$;
grant execute on function request_account_deletion() to authenticated;

-- ============================================================
-- RLS — read-only for owners; writes happen through the RPCs above.
-- ============================================================
alter table public.reports                      enable row level security;
alter table public.blocks                       enable row level security;
alter table public.account_deletion_requests    enable row level security;

-- PostgreSQL doesn't support `create policy if not exists`; use drop-then-create for idempotency.
drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports for select
  using (reporter_id = auth.uid());

drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own on public.blocks for select
  using (blocker_id = auth.uid());

drop policy if exists adr_select_own on public.account_deletion_requests;
create policy adr_select_own on public.account_deletion_requests for select
  using (user_id = auth.uid());
