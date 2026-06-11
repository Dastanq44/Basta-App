-- BASTA database bootstrap. ONE migration to apply on a fresh database.
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. Idempotent
-- (uses CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION, DROP POLICY IF
-- EXISTS + CREATE POLICY, conditional DO blocks for enums).
--
-- Replaces W-010 … W-038 (the prior 25 incremental migrations) with a single
-- flat bootstrap that captures only the final intended state. The prior
-- intermediate DROP/CREATE history is preserved in git for archaeology.
--
-- ============================================================================
-- USER STEPS REQUIRED OUTSIDE THIS FILE
-- ============================================================================
-- 1. Storage buckets — create in Dashboard → Storage → New bucket:
--      * `proof-media`     — Public: OFF (RLS policies below grant the right SELECT/INSERT)
--      * `group-avatars`   — Public: ON  (public read; writes RLS-gated to owner)
--      * `user-avatars`    — Public: ON  (public read; writes RLS-gated to self)
--    Buckets are NOT created here because Supabase manages bucket metadata in
--    `storage.buckets` and that table's writes typically require Dashboard /
--    service-role rather than a migration.
--
-- 2. Auth email template ("Magic link" / "Confirm signup") must contain the
--    `{{ .Token }}` placeholder — the mobile PKCE flow uses the 6-digit token,
--    not the magic-link URL.
--
-- 3. Push notifications (T-050B):
--      `npx supabase secrets set DISPATCH_PUSH_SECRET=<long-random>`
--      `npx supabase functions deploy dispatch-pushes --no-verify-jwt`
--    Without these, the verification-flow push pipeline is inert (triggers
--    enqueue rows; nothing consumes them).
--
-- 4. EAS projectId for ExpoPushToken (T-050A):
--      `npx eas init`
--    (only if `app.json` doesn't already have `expo.extra.eas.projectId`)
--
-- ============================================================================
-- SECTIONS
-- ============================================================================
-- 1. Extensions
-- 2. Enums
-- 3. Tables
-- 4. Indexes
-- 5. Helper functions (RLS-bypassing, referenced by policies + RPCs)
-- 6. Trigger functions + triggers
-- 7. Application RPCs (SECURITY DEFINER)
-- 8. RLS policies (public.*)
-- 9. Storage RLS (storage.objects for proof-media / group-avatars / user-avatars)
-- 10. Grants
-- ============================================================================

-- ============================================================================
-- 1. Extensions
-- ============================================================================
create extension if not exists pgcrypto;

-- ============================================================================
-- 2. Enums
-- ============================================================================
do $$ begin
  create type member_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type challenge_mode as enum ('solo', 'group');
exception when duplicate_object then null; end $$;

do $$ begin
  create type submission_status as enum ('pending_verification', 'verified', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type verification_result as enum ('approve', 'reject');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_target as enum ('submission', 'comment', 'user', 'group', 'challenge');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- 3. Tables
-- ============================================================================

-- profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique,
  display_name  text,
  avatar_url    text,
  description   text,
  timezone      text not null default 'UTC',
  onboarded     boolean not null default false,
  terms_version text,
  created_at    timestamptz not null default now()
);
alter table public.profiles drop constraint if exists profiles_description_len_chk;
alter table public.profiles
  add constraint profiles_description_len_chk
  check (description is null or char_length(description) <= 280);

-- groups
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  owner_id    uuid not null references public.profiles(id) on delete restrict,
  invite_code text unique not null,
  description text,
  avatar_path text,
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.groups drop constraint if exists groups_description_len;
alter table public.groups
  add constraint groups_description_len
  check (description is null or char_length(description) <= 280);
alter table public.groups drop constraint if exists groups_invite_code_format;
alter table public.groups
  add constraint groups_invite_code_format
  check (invite_code ~ '^[A-Za-z0-9]{12}$');

-- group_members
create table if not exists public.group_members (
  group_id  uuid references public.groups(id)   on delete cascade,
  user_id   uuid references public.profiles(id) on delete cascade,
  role      member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- challenges
create table if not exists public.challenges (
  id                      uuid primary key default gen_random_uuid(),
  group_id                uuid references public.groups(id) on delete cascade,
  creator_id              uuid not null references public.profiles(id) on delete restrict,
  title                   text not null check (char_length(title) between 1 and 100),
  category                text not null check (char_length(category) between 1 and 60),
  mode                    challenge_mode not null,
  start_date              date not null,
  duration_days           int not null check (duration_days between 1 and 365),
  proof_requirement       text check (char_length(proof_requirement) <= 280),
  verification_threshold  int  not null default 1 check (verification_threshold >= 1),
  archived_at             timestamptz,
  archived_by             uuid references public.profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  check ((mode = 'group') = (group_id is not null))
);

-- challenge_participants
create table if not exists public.challenge_participants (
  challenge_id uuid references public.challenges(id) on delete cascade,
  user_id      uuid references public.profiles(id)   on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

-- submissions
create table if not exists public.submissions (
  id            uuid primary key,
  challenge_id  uuid not null references public.challenges(id) on delete cascade,
  author_id     uuid not null references public.profiles(id)   on delete cascade,
  challenge_day int not null check (challenge_day >= 0),
  title         text not null,
  comment       text check (char_length(comment) <= 500),
  media_path    text,
  status        submission_status not null default 'pending_verification',
  verified_at   timestamptz,
  rejected_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (challenge_id, author_id, challenge_day)
);
alter table public.submissions drop constraint if exists submissions_title_len_chk;
alter table public.submissions
  add constraint submissions_title_len_chk
  check (char_length(btrim(title)) between 1 and 80);

-- verifications
create table if not exists public.verifications (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  verifier_id   uuid not null references public.profiles(id)    on delete cascade,
  result        verification_result not null,
  created_at    timestamptz not null default now(),
  unique (submission_id, verifier_id)
);

-- submission_reactions (free-form emoji since W-036)
create table if not exists public.submission_reactions (
  submission_id uuid not null references public.submissions(id) on delete cascade,
  user_id       uuid not null references public.profiles(id)    on delete cascade,
  emoji         text not null,
  created_at    timestamptz not null default now(),
  primary key (submission_id, user_id)
);
alter table public.submission_reactions drop constraint if exists submission_reactions_emoji_check;
alter table public.submission_reactions
  add constraint submission_reactions_emoji_check
  check (char_length(emoji) between 1 and 32);

-- submission_comments
create table if not exists public.submission_comments (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  author_id     uuid not null references public.profiles(id)    on delete cascade,
  body          text not null check (char_length(body) between 1 and 280),
  created_at    timestamptz not null default now()
);

-- submission_comment_likes (W-035)
create table if not exists public.submission_comment_likes (
  comment_id uuid not null references public.submission_comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id)            on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

-- blocks
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- reports
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

-- account_deletion_requests
create table if not exists public.account_deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'processing', 'done', 'cancelled')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  notes        text
);

-- push_tokens (T-050A)
create table if not exists public.push_tokens (
  expo_token   text primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  platform     text not null check (platform in ('ios','android','web')),
  device_name  text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at   timestamptz
);

-- notification_outbox (T-050B)
create table if not exists public.notification_outbox (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  category     text not null check (category in ('verify_needed','verify_result')),
  title        text not null,
  body         text not null,
  data         jsonb not null default '{}'::jsonb,
  status       text not null default 'pending'
               check (status in ('pending','processing','sent','failed')),
  attempts     int  not null default 0,
  last_error   text,
  claimed_at   timestamptz,
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- 4. Indexes
-- ============================================================================
create index if not exists challenges_group_id_idx          on public.challenges(group_id) where group_id is not null;
create index if not exists challenges_creator_id_idx        on public.challenges(creator_id);
create index if not exists cp_user_idx                      on public.challenge_participants(user_id);
create index if not exists submissions_challenge_day_idx    on public.submissions(challenge_id, challenge_day);
create index if not exists submissions_author_idx           on public.submissions(author_id);
create index if not exists verifications_submission_idx     on public.verifications(submission_id);
create index if not exists submission_reactions_sub_idx     on public.submission_reactions(submission_id);
create index if not exists submission_comments_sub_idx      on public.submission_comments(submission_id, created_at);
create index if not exists submission_comment_likes_comment_idx on public.submission_comment_likes(comment_id);
create index if not exists blocks_blocked_idx               on public.blocks(blocked_id);
create index if not exists reports_reporter_idx             on public.reports(reporter_id);
create index if not exists reports_target_idx               on public.reports(target_type, target_id);
create unique index if not exists adr_one_pending_per_user  on public.account_deletion_requests(user_id) where status = 'pending';
create index if not exists push_tokens_user_active_idx      on public.push_tokens(user_id) where revoked_at is null;
create index if not exists notification_outbox_status_created_idx on public.notification_outbox (status, created_at);
create index if not exists notification_outbox_user_created_idx   on public.notification_outbox (user_id, created_at desc);

-- ============================================================================
-- 5. Helper functions
-- (SECURITY DEFINER → bypass RLS to prevent recursion on policies that reference
-- the same tables.)
-- ============================================================================

create or replace function public.is_group_member(p_group uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(p_group uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group
      and user_id  = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- A group member of a `mode='group'` challenge counts as a participant for
-- read/verify purposes (W-022 widening — fixes B-011).
create or replace function public.is_challenge_participant(p_challenge uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.challenge_participants
      where challenge_id = p_challenge and user_id = auth.uid()
    )
    or exists (
      select 1
      from public.challenges c
      join public.group_members gm on gm.group_id = c.group_id
      where c.id = p_challenge
        and c.mode = 'group'
        and gm.user_id = auth.uid()
    );
$$;

create or replace function public.is_blocked_by_me(p_user uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where blocker_id = auth.uid() and blocked_id = p_user
  );
$$;

-- Generate a 12-char [A-Za-z0-9] invite code from a cryptographic source.
create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  v_code text;
  v_bytes bytea;
  i int;
  v_attempts int := 0;
begin
  loop
    v_code := '';
    v_bytes := gen_random_bytes(12);
    for i in 0..11 loop
      v_code := v_code || substr(alphabet, 1 + (get_byte(v_bytes, i) % 62), 1);
    end loop;
    if not exists (select 1 from public.groups where invite_code = v_code) then
      return v_code;
    end if;
    v_attempts := v_attempts + 1;
    if v_attempts >= 30 then
      raise exception 'could not generate unique invite code after 30 attempts' using errcode = 'P0002';
    end if;
  end loop;
end $$;

-- Now wire groups.invite_code default to the generator.
alter table public.groups
  alter column invite_code set default public.generate_invite_code();

-- ============================================================================
-- 6. Trigger functions + triggers
-- ============================================================================

-- When a group is created, auto-insert the owner as a member. SECURITY DEFINER
-- so the INSERT bypasses the gm_insert_admin RLS that would otherwise reject
-- the row (chicken-and-egg: the user isn't admin until this trigger runs).
create or replace function public.add_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
    values (new.id, new.owner_id, 'owner');
  return new;
end $$;

drop trigger if exists trg_groups_add_owner on public.groups;
create trigger trg_groups_add_owner
  after insert on public.groups
  for each row execute function public.add_owner_member();

-- Auto-add the challenge creator as a participant.
create or replace function public.add_creator_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.challenge_participants (challenge_id, user_id) values (new.id, new.creator_id);
  return new;
end $$;

drop trigger if exists trg_challenges_add_creator on public.challenges;
create trigger trg_challenges_add_creator
  after insert on public.challenges
  for each row execute function public.add_creator_participant();

-- Touch updated_at on submissions changes.
create or replace function public.touch_submissions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_submissions_touch_updated_at on public.submissions;
create trigger trg_submissions_touch_updated_at
  before update on public.submissions
  for each row execute function public.touch_submissions_updated_at();

-- Push notification enqueue triggers (T-050B). Both write into notification_outbox
-- with SECURITY DEFINER so the default-deny RLS on the outbox doesn't block them.
create or replace function public.enqueue_verify_needed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_mode     challenge_mode;
  v_title    text;
begin
  if new.status <> 'pending_verification' then return null; end if;

  select c.group_id, c.mode into v_group_id, v_mode
    from public.challenges c
   where c.id = new.challenge_id;

  if v_mode is null or v_mode <> 'group' or v_group_id is null then return null; end if;

  v_title := 'Proof needs review';

  insert into public.notification_outbox (user_id, category, title, body, data)
  select
    gm.user_id,
    'verify_needed',
    v_title,
    'Tap to verify the latest proof in your group challenge.',
    jsonb_build_object(
      'kind',          'verify_needed',
      'submission_id', new.id,
      'challenge_id',  new.challenge_id
    )
  from public.group_members gm
  where gm.group_id = v_group_id
    and gm.user_id  <> new.author_id
    and not exists (
      select 1 from public.blocks b
       where (b.blocker_id = gm.user_id and b.blocked_id = new.author_id)
          or (b.blocker_id = new.author_id and b.blocked_id = gm.user_id)
    )
    and not exists (
      select 1 from public.notification_outbox nx
       where nx.user_id = gm.user_id
         and nx.category = 'verify_needed'
         and nx.status = 'pending'
         and nx.data->>'submission_id' = new.id::text
    );

  return null;
end $$;

drop trigger if exists trg_enqueue_verify_needed on public.submissions;
create trigger trg_enqueue_verify_needed
  after insert on public.submissions
  for each row execute function public.enqueue_verify_needed();

create or replace function public.enqueue_verify_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body  text;
begin
  if new.status not in ('verified','rejected') then return null; end if;
  if old.status is not distinct from new.status then return null; end if;

  if new.status = 'verified' then
    v_title := 'Your proof was verified ✅';
    v_body  := 'Your submission was approved by your group.';
  else
    v_title := 'Your proof was rejected';
    v_body  := 'A group member rejected your submission. You can edit and resubmit.';
  end if;

  insert into public.notification_outbox (user_id, category, title, body, data)
  select
    new.author_id,
    'verify_result',
    v_title,
    v_body,
    jsonb_build_object(
      'kind',          'verify_result',
      'submission_id', new.id,
      'challenge_id',  new.challenge_id,
      'status',        new.status::text
    )
  where not exists (
    select 1 from public.notification_outbox nx
     where nx.user_id = new.author_id
       and nx.category = 'verify_result'
       and nx.status = 'pending'
       and nx.data->>'submission_id' = new.id::text
       and nx.data->>'status'        = new.status::text
  );

  return null;
end $$;

drop trigger if exists trg_enqueue_verify_result on public.submissions;
create trigger trg_enqueue_verify_result
  after update of status on public.submissions
  for each row execute function public.enqueue_verify_result();

-- ============================================================================
-- 7. Application RPCs (SECURITY DEFINER)
-- ============================================================================

-- ─── Groups ──────────────────────────────────────────────────────────────────

create or replace function public.create_group(p_name text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  insert into public.groups (name, owner_id)
    values (p_name, v_uid)
    returning id into v_group_id;
  return v_group_id;
end $$;

create or replace function public.join_group_by_invite(p_code text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.groups where invite_code = p_code;
  if v_group_id is null then
    raise exception 'invalid invite code' using errcode = 'P0001';
  end if;
  insert into public.group_members (group_id, user_id, role)
    values (v_group_id, auth.uid(), 'member')
    on conflict (group_id, user_id) do nothing;
  return v_group_id;
end $$;

-- Owner-only: edit name + description + avatar in one round-trip.
create or replace function public.update_group_meta(
  p_group_id    uuid,
  p_name        text,
  p_description text,
  p_avatar_path text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_owner    uuid;
  v_archived timestamptz;
  v_name     text;
  v_desc     text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select g.owner_id, g.archived_at into v_owner, v_archived
    from public.groups g where g.id = p_group_id;
  if v_owner is null then raise exception 'group not found' using errcode = 'P0002'; end if;
  if v_owner <> v_uid then
    raise exception 'only the owner can edit this group' using errcode = '42501';
  end if;
  if v_archived is not null then
    raise exception 'cannot edit an archived group' using errcode = '22023';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'group name must be 1–60 characters' using errcode = '22023';
  end if;
  v_desc := nullif(btrim(coalesce(p_description, '')), '');
  if v_desc is not null and char_length(v_desc) > 280 then
    raise exception 'description must be at most 280 characters' using errcode = '22023';
  end if;

  update public.groups
     set name        = v_name,
         description = v_desc,
         avatar_path = coalesce(p_avatar_path, avatar_path)
   where id = p_group_id;
end $$;

create or replace function public.get_group_overview(p_group_id uuid)
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_desc    text;
  v_avatar  text;
  v_created timestamptz;
  v_count   int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not public.is_group_member(p_group_id) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  select g.description, g.avatar_path, g.created_at into v_desc, v_avatar, v_created
    from public.groups g where g.id = p_group_id;
  select count(*) into v_count from public.group_members gm where gm.group_id = p_group_id;
  return json_build_object(
    'description', v_desc,
    'avatar_path', v_avatar,
    'created_at', v_created,
    'member_count', coalesce(v_count, 0)
  );
end $$;

create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_owner_id     uuid;
  v_my_role      member_role;
  v_other_owners int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select owner_id into v_owner_id
    from public.groups where id = p_group_id and archived_at is null;
  if v_owner_id is null then raise exception 'group not found' using errcode = 'P0002'; end if;
  select role into v_my_role
    from public.group_members where group_id = p_group_id and user_id = v_uid;
  if v_my_role is null then
    raise exception 'you are not a member of this group' using errcode = 'P0002';
  end if;
  if v_owner_id = v_uid then
    select count(*) into v_other_owners
      from public.group_members
      where group_id = p_group_id and user_id <> v_uid and role in ('owner', 'admin');
    if v_other_owners = 0 then
      raise exception 'cannot leave as sole owner — archive the group or promote another member first'
        using errcode = 'P0001';
    end if;
  end if;
  delete from public.group_members where group_id = p_group_id and user_id = v_uid;
end $$;

create or replace function public.archive_group(p_group_id uuid)
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

create or replace function public.restore_group(p_group_id uuid)
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
    raise exception 'only the owner can restore a group' using errcode = '42501';
  end if;
  update public.groups
     set archived_at = null, archived_by = null
     where id = p_group_id and archived_at is not null;
end $$;

create or replace function public.transfer_group_leadership(
  p_group_id     uuid,
  p_new_owner_id uuid
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_current     uuid;
  v_archived    timestamptz;
  v_new_exists  boolean;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_new_owner_id is null then
    raise exception 'new owner is required' using errcode = '22023';
  end if;
  if p_new_owner_id = v_uid then
    raise exception 'you are already the owner' using errcode = '22023';
  end if;

  select owner_id, archived_at into v_current, v_archived
    from public.groups where id = p_group_id;
  if v_current is null then raise exception 'group not found' using errcode = 'P0002'; end if;
  if v_current <> v_uid then
    raise exception 'only the current owner can transfer leadership' using errcode = '42501';
  end if;
  if v_archived is not null then
    raise exception 'cannot transfer leadership on an archived group' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_new_owner_id
  ) into v_new_exists;
  if not v_new_exists then
    raise exception 'new owner must be a member of the group' using errcode = '22023';
  end if;

  update public.groups        set owner_id = p_new_owner_id where id = p_group_id;
  update public.group_members set role     = 'member'        where group_id = p_group_id and user_id = v_uid;
  update public.group_members set role     = 'owner'         where group_id = p_group_id and user_id = p_new_owner_id;
end $$;

create or replace function public.group_leaderboard(p_group_id uuid)
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
  if not public.is_group_member(p_group_id) then
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

-- ─── Challenges ──────────────────────────────────────────────────────────────

create or replace function public.create_challenge(
  p_group_id          uuid,
  p_title             text,
  p_category          text,
  p_mode              challenge_mode,
  p_start_date        date,
  p_duration_days     int,
  p_proof_requirement text
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
    (group_id, creator_id, title, category, mode, start_date, duration_days, proof_requirement)
  values
    (p_group_id, v_uid, p_title, p_category, p_mode, p_start_date, p_duration_days, p_proof_requirement)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.join_challenge(p_challenge uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_mode     challenge_mode;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select group_id, mode into v_group_id, v_mode from public.challenges where id = p_challenge;
  if v_mode is null then raise exception 'challenge not found'; end if;
  if v_mode = 'group' and not public.is_group_member(v_group_id) then
    raise exception 'not a member of the group' using errcode = '42501';
  end if;
  insert into public.challenge_participants (challenge_id, user_id)
    values (p_challenge, v_uid)
    on conflict (challenge_id, user_id) do nothing;
end $$;

create or replace function public.update_challenge(
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
  v_trimmed_title := btrim(coalesce(p_title, ''));
  if length(v_trimmed_title) = 0 then
    raise exception 'title is required' using errcode = '22023';
  end if;
  if length(v_trimmed_title) > 100 then
    raise exception 'title must be at most 100 characters' using errcode = '22023';
  end if;
  v_category_norm := lower(btrim(coalesce(p_category, '')));
  if v_category_norm not in (
    'fitness','reading','meditation','creativity','study','language','work','other'
  ) then
    raise exception 'unknown category' using errcode = '22023';
  end if;
  if p_duration_days is null or p_duration_days < 1 or p_duration_days > 365 then
    raise exception 'duration must be between 1 and 365 days' using errcode = '22023';
  end if;
  v_trimmed_proof := btrim(coalesce(p_proof_requirement, ''));
  if length(v_trimmed_proof) > 280 then
    raise exception 'proof requirement must be at most 280 characters' using errcode = '22023';
  end if;
  if length(v_trimmed_proof) = 0 then v_trimmed_proof := null; end if;

  select creator_id, archived_at into v_creator_id, v_archived
    from public.challenges where id = p_challenge_id;
  if v_creator_id is null then raise exception 'challenge not found' using errcode = 'P0002'; end if;
  if v_creator_id <> v_uid then
    raise exception 'only the creator can edit this challenge' using errcode = '42501';
  end if;
  if v_archived is not null then
    raise exception 'cannot edit an archived challenge' using errcode = '22023';
  end if;

  select max(challenge_day) into v_max_day
    from public.submissions where challenge_id = p_challenge_id;
  if v_max_day is not null and p_duration_days < v_max_day + 1 then
    raise exception 'duration cannot be shorter than existing submissions (need at least % days)',
      v_max_day + 1 using errcode = '22023';
  end if;

  update public.challenges
     set title = v_trimmed_title, category = v_category_norm,
         duration_days = p_duration_days, proof_requirement = v_trimmed_proof
   where id = p_challenge_id;
end $$;

create or replace function public.archive_challenge(p_challenge_id uuid)
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

-- ─── Proofs (submit / read / redact) ─────────────────────────────────────────

create or replace function public.submit_proof(
  p_submission_id uuid,
  p_challenge_id  uuid,
  p_title         text,
  p_media_path    text,
  p_comment       text
) returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid              uuid := auth.uid();
  v_tz               text;
  v_start            date;
  v_mode             challenge_mode;
  v_today_local      date;
  v_day              int;
  v_existing_id      uuid;
  v_existing_status  submission_status;
  v_status           submission_status;
  v_verified_at      timestamptz;
  v_trimmed_title    text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not public.is_challenge_participant(p_challenge_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  v_trimmed_title := btrim(coalesce(p_title, ''));
  if length(v_trimmed_title) < 1 or length(v_trimmed_title) > 80 then
    raise exception 'title must be 1..80 characters' using errcode = '22023';
  end if;

  select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = v_uid;
  select start_date, mode into v_start, v_mode from public.challenges where id = p_challenge_id;
  if v_start is null then raise exception 'challenge not found'; end if;

  v_today_local := (now() at time zone v_tz)::date;
  v_day := v_today_local - v_start;
  if v_day < 0 then raise exception 'challenge has not started'; end if;

  select id, status into v_existing_id, v_existing_status
    from public.submissions
    where challenge_id = p_challenge_id and author_id = v_uid and challenge_day = v_day
    limit 1;
  if v_existing_id is not null then
    return json_build_object(
      'id', v_existing_id, 'challenge_day', v_day,
      'status', v_existing_status, 'already_submitted', true
    );
  end if;

  if v_mode = 'solo' then
    v_status := 'verified'; v_verified_at := now();
  else
    v_status := 'pending_verification'; v_verified_at := null;
  end if;

  insert into public.submissions
    (id, challenge_id, author_id, challenge_day, title, comment, media_path, status, verified_at)
  values
    (p_submission_id, p_challenge_id, v_uid, v_day, v_trimmed_title, p_comment, p_media_path, v_status, v_verified_at);

  return json_build_object(
    'id', p_submission_id, 'challenge_day', v_day,
    'status', v_status, 'already_submitted', false
  );
end $$;

create or replace function public.redact_my_submission(
  p_submission_id uuid,
  p_title         text,
  p_media_path    text,
  p_comment       text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid              uuid := auth.uid();
  v_author_id        uuid;
  v_status           submission_status;
  v_challenge_id     uuid;
  v_challenge_day    int;
  v_mode             challenge_mode;
  v_archived         timestamptz;
  v_start_date       date;
  v_tz               text;
  v_today_day        int;
  v_trimmed_comment  text;
  v_trimmed_title    text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select s.author_id, s.status, s.challenge_id, s.challenge_day
    into v_author_id, v_status, v_challenge_id, v_challenge_day
    from public.submissions s where s.id = p_submission_id;
  if v_author_id is null then raise exception 'submission not found' using errcode = 'P0002'; end if;
  if v_author_id <> v_uid then
    raise exception 'only the author can edit this submission' using errcode = '42501';
  end if;

  select c.mode, c.archived_at, c.start_date
    into v_mode, v_archived, v_start_date
    from public.challenges c where c.id = v_challenge_id;
  if v_archived is not null then
    raise exception 'cannot edit a submission on an archived challenge' using errcode = '22023';
  end if;
  if v_mode = 'group' and v_status = 'verified' then
    raise exception 'verified submissions cannot be edited' using errcode = '22023';
  end if;
  if v_mode = 'solo' then
    select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = v_uid;
    v_today_day := ((now() at time zone v_tz)::date - v_start_date);
    if v_challenge_day <> v_today_day then
      raise exception 'solo submissions can only be edited on the same day' using errcode = '22023';
    end if;
  end if;

  v_trimmed_title := btrim(coalesce(p_title, ''));
  if length(v_trimmed_title) < 1 or length(v_trimmed_title) > 80 then
    raise exception 'title must be 1..80 characters' using errcode = '22023';
  end if;

  v_trimmed_comment := btrim(coalesce(p_comment, ''));
  if length(v_trimmed_comment) > 500 then
    raise exception 'comment must be at most 500 characters' using errcode = '22023';
  end if;

  if p_media_path is null or length(btrim(p_media_path)) = 0 then
    raise exception 'media_path is required' using errcode = '22023';
  end if;

  update public.submissions
     set title = v_trimmed_title, media_path = p_media_path,
         comment = nullif(v_trimmed_comment, '')
   where id = p_submission_id;

  if v_mode = 'group' then
    delete from public.verifications where submission_id = p_submission_id;
    update public.submissions
       set status = 'pending_verification', verified_at = null, rejected_at = null
     where id = p_submission_id;
  end if;
end $$;

create or replace function public.get_my_today_submission(p_challenge_id uuid)
returns table (
  id            uuid,
  challenge_id  uuid,
  author_id     uuid,
  challenge_day int,
  title         text,
  comment       text,
  media_path    text,
  status        submission_status,
  verified_at   timestamptz,
  rejected_at   timestamptz,
  created_at    timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_tz        text;
  v_start     date;
  v_today_day int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not public.is_challenge_participant(p_challenge_id) then return; end if;

  select coalesce(profiles.timezone, 'UTC') into v_tz
    from public.profiles where profiles.id = v_uid;
  select challenges.start_date into v_start
    from public.challenges where challenges.id = p_challenge_id;
  if v_start is null then return; end if;
  v_today_day := ((now() at time zone v_tz)::date - v_start);

  return query
    select s.id, s.challenge_id, s.author_id, s.challenge_day, s.title, s.comment,
           s.media_path, s.status, s.verified_at, s.rejected_at, s.created_at
    from public.submissions s
    where s.challenge_id = p_challenge_id
      and s.author_id    = v_uid
      and s.challenge_day = v_today_day
    limit 1;
end $$;

create or replace function public.list_challenge_submissions(
  p_challenge_id uuid,
  p_limit        int default 20
) returns table (
  id                   uuid,
  challenge_id         uuid,
  author_id            uuid,
  challenge_day        int,
  title                text,
  comment              text,
  media_path           text,
  status               submission_status,
  verified_at          timestamptz,
  rejected_at          timestamptz,
  created_at           timestamptz,
  author_username      text,
  author_display_name  text
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not public.is_challenge_participant(p_challenge_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  return query
    select s.id, s.challenge_id, s.author_id, s.challenge_day, s.title, s.comment,
           s.media_path, s.status, s.verified_at, s.rejected_at, s.created_at,
           p.username, p.display_name
    from public.submissions s
    join public.profiles p on p.id = s.author_id
    where s.challenge_id = p_challenge_id
    order by s.created_at desc
    limit greatest(coalesce(p_limit, 20), 1);
end $$;

create or replace function public.get_submission_with_author(p_submission_id uuid)
returns table (
  id                   uuid,
  challenge_id         uuid,
  author_id            uuid,
  challenge_day        int,
  title                text,
  comment              text,
  media_path           text,
  status               submission_status,
  verified_at          timestamptz,
  rejected_at          timestamptz,
  created_at           timestamptz,
  author_username      text,
  author_display_name  text
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_challenge_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select s.challenge_id into v_challenge_id
    from public.submissions s where s.id = p_submission_id;
  if v_challenge_id is null then return; end if;
  if not public.is_challenge_participant(v_challenge_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  return query
    select s.id, s.challenge_id, s.author_id, s.challenge_day, s.title, s.comment,
           s.media_path, s.status, s.verified_at, s.rejected_at, s.created_at,
           p.username, p.display_name
    from public.submissions s
    join public.profiles p on p.id = s.author_id
    where s.id = p_submission_id;
end $$;

-- ─── Verification ────────────────────────────────────────────────────────────

create or replace function public.verify_submission(
  p_submission_id uuid,
  p_result        verification_result
) returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_challenge_id  uuid;
  v_author_id     uuid;
  v_threshold     int;
  v_approve_count int;
  v_new_status    submission_status;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select s.challenge_id, s.author_id into v_challenge_id, v_author_id
    from public.submissions s where s.id = p_submission_id;
  if v_challenge_id is null then raise exception 'submission not found'; end if;
  if v_author_id = v_uid then
    raise exception 'cannot verify your own proof' using errcode = '42501';
  end if;
  if not public.is_challenge_participant(v_challenge_id) then
    raise exception 'not a participant of this challenge' using errcode = '42501';
  end if;

  insert into public.verifications (submission_id, verifier_id, result)
    values (p_submission_id, v_uid, p_result)
    on conflict (submission_id, verifier_id)
    do update set result = excluded.result, created_at = now();

  select c.verification_threshold into v_threshold
    from public.challenges c join public.submissions s on s.challenge_id = c.id
    where s.id = p_submission_id;

  if exists (
    select 1 from public.verifications where submission_id = p_submission_id and result = 'reject'
  ) then
    v_new_status := 'rejected';
  else
    select count(*) into v_approve_count
      from public.verifications where submission_id = p_submission_id and result = 'approve';
    if v_approve_count >= v_threshold then v_new_status := 'verified';
    else v_new_status := 'pending_verification';
    end if;
  end if;

  update public.submissions
    set status      = v_new_status,
        verified_at = case when v_new_status = 'verified' then now() else null end,
        rejected_at = case when v_new_status = 'rejected' then now() else null end
    where id = p_submission_id;

  return json_build_object('id', p_submission_id, 'status', v_new_status);
end $$;

-- ─── Streaks + Home + Leaderboard ────────────────────────────────────────────

create or replace function public.challenge_streak(p_challenge_id uuid)
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_tz         text;
  v_start      date;
  v_today_day  int;
  v_current    int := 0;
  v_longest    int := 0;
  v_run        int := 0;
  v_prev       int := null;
  v_today_done boolean := false;
  r record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not public.is_challenge_participant(p_challenge_id) then return null; end if;

  select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = v_uid;
  select start_date into v_start from public.challenges where id = p_challenge_id;
  if v_start is null then raise exception 'challenge not found'; end if;
  v_today_day := ((now() at time zone v_tz)::date - v_start);

  for r in
    select challenge_day from public.submissions
    where challenge_id = p_challenge_id and author_id = v_uid and status = 'verified'
    order by challenge_day
  loop
    if v_prev is not null and r.challenge_day = v_prev + 1 then v_run := v_run + 1;
    else v_run := 1;
    end if;
    if v_run > v_longest then v_longest := v_run; end if;
    v_prev := r.challenge_day;
    if r.challenge_day = v_today_day then v_today_done := true; end if;
  end loop;

  declare
    v_anchor int;
    v_day    int;
  begin
    if exists (select 1 from public.submissions
               where challenge_id = p_challenge_id and author_id = v_uid
                 and status = 'verified' and challenge_day = v_today_day) then
      v_anchor := v_today_day;
    elsif exists (select 1 from public.submissions
                  where challenge_id = p_challenge_id and author_id = v_uid
                    and status = 'verified' and challenge_day = v_today_day - 1) then
      v_anchor := v_today_day - 1;
    else v_anchor := null;
    end if;
    if v_anchor is not null then
      v_day := v_anchor;
      while exists (select 1 from public.submissions
                    where challenge_id = p_challenge_id and author_id = v_uid
                      and status = 'verified' and challenge_day = v_day) loop
        v_current := v_current + 1;
        v_day := v_day - 1;
      end loop;
    end if;
  end;

  return json_build_object('current', v_current, 'longest', v_longest, 'today_done', v_today_done);
end $$;

create or replace function public.list_challenge_streaks(p_challenge_id uuid)
returns table (
  user_id              uuid,
  username             text,
  display_name         text,
  current_streak       int,
  longest_streak       int,
  today_done           boolean
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_mode       challenge_mode;
  v_group_id   uuid;
  v_start      date;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not public.is_challenge_participant(p_challenge_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  select c.mode, c.group_id, c.start_date into v_mode, v_group_id, v_start
    from public.challenges c where c.id = p_challenge_id;
  if v_start is null then raise exception 'challenge not found' using errcode = 'P0002'; end if;

  return query
  with participants as (
    select v_uid as uid where v_mode = 'solo'
    union
    select gm.user_id as uid
    from public.group_members gm
    where v_mode = 'group' and gm.group_id = v_group_id
  ),
  per_user as (
    select pa.uid,
           coalesce(pr.timezone, 'UTC') as tz,
           ((now() at time zone coalesce(pr.timezone, 'UTC'))::date - v_start) as today_day
    from participants pa
    left join public.profiles pr on pr.id = pa.uid
  ),
  verified_days as (
    select s.author_id, s.challenge_day
    from public.submissions s
    where s.challenge_id = p_challenge_id and s.status = 'verified'
  ),
  longest as (
    select pu.uid, coalesce(max(run_len), 0) as longest
    from per_user pu
    left join lateral (
      select count(*) as run_len
      from (
        select challenge_day,
               challenge_day - row_number() over (order by challenge_day) as grp
        from verified_days vd where vd.author_id = pu.uid
      ) g group by grp
    ) l on true
    group by pu.uid
  ),
  current_run as (
    select pu.uid,
           case
             when exists (select 1 from verified_days vd
                          where vd.author_id = pu.uid and vd.challenge_day = pu.today_day) then pu.today_day
             when exists (select 1 from verified_days vd
                          where vd.author_id = pu.uid and vd.challenge_day = pu.today_day - 1) then pu.today_day - 1
             else null
           end as anchor,
           pu.today_day
    from per_user pu
  ),
  current_len as (
    select cr.uid, cr.anchor, cr.today_day,
           case when cr.anchor is null then 0 else (
             select count(*)::int
             from generate_series(0, 365) gs
             where exists (select 1 from verified_days vd
                           where vd.author_id = cr.uid and vd.challenge_day = cr.anchor - gs)
               and (not exists (
                 select 1 from generate_series(0, gs) gg
                 where not exists (
                   select 1 from verified_days vd2
                   where vd2.author_id = cr.uid and vd2.challenge_day = cr.anchor - gg
                 )
               ))
           ) end as current_streak
    from current_run cr
  ),
  today_done_per as (
    select pu.uid,
           exists (
             select 1 from verified_days vd
             where vd.author_id = pu.uid and vd.challenge_day = pu.today_day
           ) as today_done
    from per_user pu
  )
  select pu.uid as user_id, pr.username, pr.display_name,
         coalesce(cl.current_streak, 0)::int as current_streak,
         coalesce(lo.longest, 0)::int        as longest_streak,
         coalesce(td.today_done, false)      as today_done
  from per_user pu
  left join public.profiles pr on pr.id = pu.uid
  left join longest        lo on lo.uid = pu.uid
  left join current_len    cl on cl.uid = pu.uid
  left join today_done_per td on td.uid = pu.uid
  order by current_streak desc, longest_streak desc, pr.username asc nulls last;
end $$;

create or replace function public.get_home_overview()
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_tz             text;
  v_today          date;
  v_today_total    int := 0;
  v_today_done     int := 0;
  v_week_days      int := 0;
  v_current_streak int := 0;
  v_pending        int := 0;
  v_anchor         date;
  v_day            date;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = v_uid;
  v_tz := coalesce(v_tz, 'UTC');
  v_today := (now() at time zone v_tz)::date;

  with my_ch as (
    select c.id, c.start_date, c.duration_days,
           ((now() at time zone v_tz)::date - c.start_date) as today_day
    from public.challenges c
    where c.archived_at is null
      and (
        exists (select 1 from public.challenge_participants cp
                where cp.challenge_id = c.id and cp.user_id = v_uid)
        or (c.mode = 'group' and c.group_id is not null
            and exists (select 1 from public.group_members gm
                        where gm.group_id = c.group_id and gm.user_id = v_uid))
      )
  ),
  active_today as (
    select id, today_day from my_ch where today_day >= 0 and today_day < duration_days
  )
  select
    count(*)::int,
    count(*) filter (where exists (
      select 1 from public.submissions s
      where s.challenge_id = active_today.id
        and s.author_id = v_uid
        and s.challenge_day = active_today.today_day
    ))::int
  into v_today_total, v_today_done
  from active_today;

  select count(distinct (c.start_date + s.challenge_day))
    into v_week_days
    from public.submissions s
    join public.challenges c on c.id = s.challenge_id
    where s.author_id = v_uid and s.status = 'verified'
      and (c.start_date + s.challenge_day) between v_today - 6 and v_today;

  if exists (select 1 from public.submissions s join public.challenges c on c.id = s.challenge_id
             where s.author_id = v_uid and s.status = 'verified'
               and (c.start_date + s.challenge_day) = v_today) then
    v_anchor := v_today;
  elsif exists (select 1 from public.submissions s join public.challenges c on c.id = s.challenge_id
                where s.author_id = v_uid and s.status = 'verified'
                  and (c.start_date + s.challenge_day) = v_today - 1) then
    v_anchor := v_today - 1;
  else
    v_anchor := null;
  end if;

  if v_anchor is not null then
    v_day := v_anchor;
    while exists (select 1 from public.submissions s join public.challenges c on c.id = s.challenge_id
                  where s.author_id = v_uid and s.status = 'verified'
                    and (c.start_date + s.challenge_day) = v_day) loop
      v_current_streak := v_current_streak + 1;
      v_day := v_day - 1;
    end loop;
  end if;

  select count(*) into v_pending
    from public.submissions s
    join public.challenges c on c.id = s.challenge_id
    where s.status = 'pending_verification'
      and s.author_id <> v_uid
      and c.mode = 'group'
      and c.archived_at is null
      and public.is_challenge_participant(s.challenge_id)
      and not exists (select 1 from public.verifications v
                      where v.submission_id = s.id and v.verifier_id = v_uid);

  return json_build_object(
    'current_streak', v_current_streak,
    'week_active_days', v_week_days,
    'today_total', v_today_total,
    'today_done', v_today_done,
    'pending_verifications', v_pending
  );
end $$;

create or replace function public.list_pending_verifications_for_me()
returns table (
  submission_id       uuid,
  challenge_id        uuid,
  challenge_title     text,
  author_id           uuid,
  author_username     text,
  author_display_name text,
  challenge_day       int,
  created_at          timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  return query
    select s.id, s.challenge_id, c.title, s.author_id, p.username, p.display_name,
           s.challenge_day, s.created_at
    from public.submissions s
    join public.challenges c on c.id = s.challenge_id
    left join public.profiles p on p.id = s.author_id
    where s.status = 'pending_verification'
      and s.author_id <> v_uid
      and c.mode = 'group'
      and c.archived_at is null
      and public.is_challenge_participant(s.challenge_id)
      and not exists (select 1 from public.verifications v
                      where v.submission_id = s.id and v.verifier_id = v_uid)
    order by s.created_at asc;
end $$;

create or replace function public.get_my_streak_aggregate()
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_tz             text;
  v_today          date;
  v_current_streak int := 0;
  v_best_streak    int := 0;
  v_anchor         date;
  v_day            date;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = v_uid;
  v_tz   := coalesce(v_tz, 'UTC');
  v_today := (now() at time zone v_tz)::date;

  if exists (
    select 1 from public.submissions s
    join public.challenges c on c.id = s.challenge_id
    where s.author_id = v_uid and s.status = 'verified'
      and (c.start_date + s.challenge_day) = v_today
  ) then v_anchor := v_today;
  elsif exists (
    select 1 from public.submissions s
    join public.challenges c on c.id = s.challenge_id
    where s.author_id = v_uid and s.status = 'verified'
      and (c.start_date + s.challenge_day) = v_today - 1
  ) then v_anchor := v_today - 1;
  else v_anchor := null;
  end if;

  if v_anchor is not null then
    v_day := v_anchor;
    while exists (
      select 1 from public.submissions s
      join public.challenges c on c.id = s.challenge_id
      where s.author_id = v_uid and s.status = 'verified'
        and (c.start_date + s.challenge_day) = v_day
    ) loop
      v_current_streak := v_current_streak + 1;
      v_day := v_day - 1;
    end loop;
  end if;

  with verified_days as (
    select distinct (c.start_date + s.challenge_day) as d
      from public.submissions s
      join public.challenges c on c.id = s.challenge_id
      where s.author_id = v_uid and s.status = 'verified'
  ),
  with_island as (
    select d, d - (row_number() over (order by d))::int as island
      from verified_days
  ),
  runs as (
    select count(*)::int as run_len from with_island group by island
  )
  select coalesce(max(run_len), 0) into v_best_streak from runs;

  return json_build_object('current_streak', v_current_streak, 'best_streak', v_best_streak);
end $$;

-- ─── Social: reactions ───────────────────────────────────────────────────────

create or replace function public.react_to_submission(p_submission_id uuid, p_emoji text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ch  uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select challenge_id into v_ch from public.submissions where id = p_submission_id;
  if v_ch is null then raise exception 'submission not found'; end if;
  if not public.is_challenge_participant(v_ch) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  if p_emoji is null or char_length(trim(p_emoji)) = 0 then
    delete from public.submission_reactions where submission_id = p_submission_id and user_id = v_uid;
  else
    insert into public.submission_reactions (submission_id, user_id, emoji)
      values (p_submission_id, v_uid, p_emoji)
      on conflict (submission_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
end $$;

create or replace function public.list_submission_reactors(
  p_submission_id uuid,
  p_emoji         text
)
returns table (
  user_id      uuid,
  username     text,
  display_name text,
  reacted_at   timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
declare v_ch uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_emoji is null or char_length(btrim(p_emoji)) = 0 then return; end if;
  select challenge_id into v_ch from public.submissions where id = p_submission_id;
  if v_ch is null then return; end if;
  if not public.is_challenge_participant(v_ch) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  return query
    select p.id, p.username, p.display_name, r.created_at
      from public.submission_reactions r
      join public.profiles p on p.id = r.user_id
     where r.submission_id = p_submission_id and r.emoji = p_emoji
     order by r.created_at asc;
end $$;

-- ─── Social: comments + likes ────────────────────────────────────────────────

create or replace function public.add_comment(p_submission_id uuid, p_body text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_ch      uuid;
  v_id      uuid;
  v_created timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_body is null or char_length(trim(p_body)) = 0 then raise exception 'empty comment'; end if;
  select challenge_id into v_ch from public.submissions where id = p_submission_id;
  if v_ch is null then raise exception 'submission not found'; end if;
  if not public.is_challenge_participant(v_ch) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  insert into public.submission_comments (submission_id, author_id, body)
    values (p_submission_id, v_uid, left(trim(p_body), 280))
    returning id, created_at into v_id, v_created;
  return json_build_object('id', v_id, 'created_at', v_created);
end $$;

create or replace function public.list_submission_comments(p_submission_id uuid)
returns table (
  id                  uuid,
  submission_id       uuid,
  author_id           uuid,
  author_username     text,
  author_display_name text,
  body                text,
  created_at          timestamptz,
  likes_count         int,
  liked_by_me         boolean
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ch  uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select challenge_id into v_ch from public.submissions where id = p_submission_id;
  if v_ch is null then return; end if;
  if not public.is_challenge_participant(v_ch) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  return query
    select
      c.id, c.submission_id, c.author_id, p.username, p.display_name, c.body, c.created_at,
      coalesce(lk.cnt, 0)::int as likes_count,
      coalesce(lk.mine, false) as liked_by_me
    from public.submission_comments c
    join public.profiles p on p.id = c.author_id
    left join lateral (
      select count(*) as cnt, bool_or(l.user_id = v_uid) as mine
      from public.submission_comment_likes l
      where l.comment_id = c.id
    ) lk on true
    where c.submission_id = p_submission_id
    order by c.created_at asc;
end $$;

create or replace function public.like_comment(p_comment_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ch  uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select s.challenge_id into v_ch
    from public.submission_comments c
    join public.submissions s on s.id = c.submission_id
   where c.id = p_comment_id;
  if v_ch is null then raise exception 'comment not found' using errcode = 'P0002'; end if;
  if not public.is_challenge_participant(v_ch) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  insert into public.submission_comment_likes (comment_id, user_id)
    values (p_comment_id, v_uid)
    on conflict (comment_id, user_id) do nothing;
end $$;

create or replace function public.unlike_comment(p_comment_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  delete from public.submission_comment_likes
    where comment_id = p_comment_id and user_id = v_uid;
end $$;

create or replace function public.list_comment_likers(p_comment_id uuid)
returns table (
  user_id      uuid,
  username     text,
  display_name text,
  liked_at     timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
declare v_ch uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select s.challenge_id into v_ch
    from public.submission_comments c
    join public.submissions s on s.id = c.submission_id
   where c.id = p_comment_id;
  if v_ch is null then return; end if;
  if not public.is_challenge_participant(v_ch) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  return query
    select p.id, p.username, p.display_name, l.created_at
      from public.submission_comment_likes l
      join public.profiles p on p.id = l.user_id
     where l.comment_id = p_comment_id
     order by l.created_at asc;
end $$;

-- ─── Moderation: report / block / account-deletion ───────────────────────────

create or replace function public.report_target(
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

create or replace function public.block_user(p_user_id uuid)
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

create or replace function public.unblock_user(p_user_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  delete from public.blocks where blocker_id = v_uid and blocked_id = p_user_id;
end $$;

create or replace function public.request_account_deletion()
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select id into v_id from public.account_deletion_requests
    where user_id = v_uid and status = 'pending' limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.account_deletion_requests (user_id) values (v_uid) returning id into v_id;
  return v_id;
end $$;

-- ─── Push notifications: register / unregister + dispatch ────────────────────

create or replace function public.register_push_token(
  p_token       text,
  p_platform    text,
  p_device_name text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_trimmed text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  v_trimmed := btrim(coalesce(p_token, ''));
  if length(v_trimmed) = 0 then raise exception 'token is required' using errcode = '22023'; end if;
  if p_platform not in ('ios','android','web') then
    raise exception 'unknown platform' using errcode = '22023';
  end if;
  insert into public.push_tokens (expo_token, user_id, platform, device_name)
    values (v_trimmed, v_uid, p_platform, p_device_name)
  on conflict (expo_token) do update
    set user_id = excluded.user_id, platform = excluded.platform,
        device_name = excluded.device_name, last_seen_at = now(), revoked_at = null;
end $$;

create or replace function public.unregister_push_token(p_token text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_trimmed text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  v_trimmed := btrim(coalesce(p_token, ''));
  if length(v_trimmed) = 0 then return; end if;
  update public.push_tokens
     set revoked_at = now()
   where expo_token = v_trimmed and user_id = v_uid and revoked_at is null;
end $$;

create or replace function public.claim_pending_notifications(p_limit int)
returns table (
  outbox_id   uuid,
  user_id     uuid,
  category    text,
  title       text,
  body        text,
  data        jsonb,
  attempts    int,
  expo_token  text,
  platform    text
)
language plpgsql security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    update public.notification_outbox o
       set status     = 'processing',
           claimed_at = now(),
           attempts   = o.attempts + 1
     where o.id in (
       select id from public.notification_outbox
        where status = 'pending'
        order by created_at
        limit greatest(coalesce(p_limit, 50), 1)
        for update skip locked
     )
    returning o.id, o.user_id, o.category, o.title, o.body, o.data, o.attempts
  )
  select c.id as outbox_id, c.user_id, c.category, c.title, c.body, c.data, c.attempts,
         pt.expo_token, pt.platform
  from claimed c
  left join public.push_tokens pt on pt.user_id = c.user_id and pt.revoked_at is null;
end $$;

create or replace function public.mark_notification_sent(
  p_outbox_id uuid,
  p_ticket_id text default null
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update public.notification_outbox
     set status = 'sent', sent_at = now(), last_error = null
   where id = p_outbox_id and status = 'processing';
  perform p_ticket_id;
end $$;

create or replace function public.mark_notification_failed(
  p_outbox_id uuid,
  p_error     text,
  p_retryable boolean
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update public.notification_outbox o
     set status     = case when p_retryable and o.attempts < 3 then 'pending' else 'failed' end,
         claimed_at = case when p_retryable and o.attempts < 3 then null else o.claimed_at end,
         last_error = left(coalesce(p_error, ''), 500)
   where o.id = p_outbox_id and o.status = 'processing';
end $$;

create or replace function public.revoke_push_token(
  p_expo_token text,
  p_reason     text
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update public.push_tokens set revoked_at = now()
   where expo_token = p_expo_token and revoked_at is null;
  perform p_reason;
end $$;

-- ============================================================================
-- 8. RLS — enable + policies (public.*)
-- ============================================================================

alter table public.profiles                    enable row level security;
alter table public.groups                      enable row level security;
alter table public.group_members               enable row level security;
alter table public.challenges                  enable row level security;
alter table public.challenge_participants      enable row level security;
alter table public.submissions                 enable row level security;
alter table public.verifications               enable row level security;
alter table public.submission_reactions        enable row level security;
alter table public.submission_comments         enable row level security;
alter table public.submission_comment_likes    enable row level security;
alter table public.blocks                      enable row level security;
alter table public.reports                     enable row level security;
alter table public.account_deletion_requests   enable row level security;
alter table public.push_tokens                 enable row level security;
alter table public.notification_outbox         enable row level security;

-- profiles
drop policy if exists profiles_select_own    on public.profiles;
drop policy if exists profiles_select_public on public.profiles;
drop policy if exists profiles_insert_own    on public.profiles;
drop policy if exists profiles_update_own    on public.profiles;
create policy profiles_select_own    on public.profiles for select using (id = auth.uid());
create policy profiles_select_public on public.profiles for select to authenticated using (true);
create policy profiles_insert_own    on public.profiles for insert with check (id = auth.uid());
create policy profiles_update_own    on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- groups
drop policy if exists groups_select_member     on public.groups;
drop policy if exists groups_insert_self_owned on public.groups;
drop policy if exists groups_update_owner      on public.groups;
drop policy if exists groups_delete_owner      on public.groups;
create policy groups_select_member     on public.groups for select using (public.is_group_member(id));
create policy groups_insert_self_owned on public.groups for insert with check (owner_id = auth.uid());
create policy groups_update_owner      on public.groups for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy groups_delete_owner      on public.groups for delete using (owner_id = auth.uid());

-- group_members
drop policy if exists gm_select_member on public.group_members;
drop policy if exists gm_insert_admin  on public.group_members;
drop policy if exists gm_delete_self   on public.group_members;
drop policy if exists gm_delete_admin  on public.group_members;
create policy gm_select_member on public.group_members for select using (public.is_group_member(group_id));
create policy gm_insert_admin  on public.group_members for insert with check (public.is_group_admin(group_id));
create policy gm_delete_self   on public.group_members for delete using (user_id = auth.uid());
create policy gm_delete_admin  on public.group_members for delete using (public.is_group_admin(group_id));

-- challenges
drop policy if exists challenges_select         on public.challenges;
drop policy if exists challenges_update_creator on public.challenges;
create policy challenges_select         on public.challenges for select using (
  public.is_challenge_participant(id) or (group_id is not null and public.is_group_member(group_id))
);
create policy challenges_update_creator on public.challenges for update
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());

-- challenge_participants
drop policy if exists cp_select_in_challenge on public.challenge_participants;
drop policy if exists cp_delete_self         on public.challenge_participants;
create policy cp_select_in_challenge on public.challenge_participants for select using (public.is_challenge_participant(challenge_id));
create policy cp_delete_self         on public.challenge_participants for delete using (user_id = auth.uid());

-- submissions
drop policy if exists submissions_select_participant on public.submissions;
create policy submissions_select_participant on public.submissions for select using (public.is_challenge_participant(challenge_id));

-- verifications
drop policy if exists verifications_select_participant on public.verifications;
create policy verifications_select_participant on public.verifications for select using (
  exists (
    select 1 from public.submissions s
    where s.id = verifications.submission_id and public.is_challenge_participant(s.challenge_id)
  )
);

-- submission_reactions
drop policy if exists sr_select_participant on public.submission_reactions;
create policy sr_select_participant on public.submission_reactions for select using (
  exists (select 1 from public.submissions s
          where s.id = submission_reactions.submission_id
            and public.is_challenge_participant(s.challenge_id))
);

-- submission_comments
drop policy if exists sc_select_participant on public.submission_comments;
create policy sc_select_participant on public.submission_comments for select using (
  exists (select 1 from public.submissions s
          where s.id = submission_comments.submission_id
            and public.is_challenge_participant(s.challenge_id))
);

-- submission_comment_likes
drop policy if exists scl_select_participant on public.submission_comment_likes;
create policy scl_select_participant on public.submission_comment_likes for select using (
  exists (
    select 1
      from public.submission_comments c
      join public.submissions s on s.id = c.submission_id
     where c.id = submission_comment_likes.comment_id
       and public.is_challenge_participant(s.challenge_id)
  )
);

-- blocks / reports / account_deletion_requests
drop policy if exists blocks_select_own  on public.blocks;
drop policy if exists reports_select_own on public.reports;
drop policy if exists adr_select_own     on public.account_deletion_requests;
create policy blocks_select_own  on public.blocks  for select using (blocker_id = auth.uid());
create policy reports_select_own on public.reports for select using (reporter_id = auth.uid());
create policy adr_select_own     on public.account_deletion_requests for select using (user_id = auth.uid());

-- push_tokens
drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens for select using (user_id = auth.uid());

-- notification_outbox: no policies — default deny; trigger functions write with SECURITY DEFINER.

-- ============================================================================
-- 9. Storage RLS
--   Requires the buckets `proof-media` (PRIVATE), `group-avatars` (PUBLIC), and
--   `user-avatars` (PUBLIC) to exist (USER step 1 at the top of this file).
-- ============================================================================

-- proof-media (private)
drop policy if exists storage_proof_media_insert on storage.objects;
create policy storage_proof_media_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'proof-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_proof_media_select on storage.objects;
create policy storage_proof_media_select on storage.objects for select to authenticated
  using (
    bucket_id = 'proof-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_challenge_participant(((storage.foldername(name))[2])::uuid)
    )
  );

-- group-avatars (public read; writes RLS-gated to owner)
drop policy if exists storage_group_avatars_insert on storage.objects;
create policy storage_group_avatars_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'group-avatars'
    and exists (
      select 1 from public.groups g
      where g.id = ((storage.foldername(name))[1])::uuid and g.owner_id = auth.uid()
    )
  );

drop policy if exists storage_group_avatars_update on storage.objects;
create policy storage_group_avatars_update on storage.objects for update to authenticated
  using (
    bucket_id = 'group-avatars'
    and exists (
      select 1 from public.groups g
      where g.id = ((storage.foldername(name))[1])::uuid and g.owner_id = auth.uid()
    )
  );

-- user-avatars (public read; self-write)
drop policy if exists storage_user_avatars_select on storage.objects;
create policy storage_user_avatars_select on storage.objects for select
  using (bucket_id = 'user-avatars');

drop policy if exists storage_user_avatars_insert on storage.objects;
create policy storage_user_avatars_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_user_avatars_update on storage.objects;
create policy storage_user_avatars_update on storage.objects for update to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_user_avatars_delete on storage.objects;
create policy storage_user_avatars_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- 10. Grants
-- ============================================================================

-- Helpers
grant execute on function public.is_group_member(uuid)          to authenticated;
grant execute on function public.is_group_admin(uuid)           to authenticated;
grant execute on function public.is_challenge_participant(uuid) to authenticated;
grant execute on function public.is_blocked_by_me(uuid)         to authenticated;

-- Groups
grant execute on function public.create_group(text)                       to authenticated;
grant execute on function public.join_group_by_invite(text)               to authenticated;
grant execute on function public.update_group_meta(uuid, text, text, text) to authenticated;
grant execute on function public.get_group_overview(uuid)                 to authenticated;
grant execute on function public.leave_group(uuid)                        to authenticated;
grant execute on function public.archive_group(uuid)                      to authenticated;
grant execute on function public.restore_group(uuid)                      to authenticated;
grant execute on function public.transfer_group_leadership(uuid, uuid)    to authenticated;
grant execute on function public.group_leaderboard(uuid)                  to authenticated;

-- Challenges
grant execute on function public.create_challenge(uuid, text, text, challenge_mode, date, int, text) to authenticated;
grant execute on function public.join_challenge(uuid)                                                 to authenticated;
grant execute on function public.update_challenge(uuid, text, text, int, text)                        to authenticated;
grant execute on function public.archive_challenge(uuid)                                              to authenticated;

-- Proofs / submissions
grant execute on function public.submit_proof(uuid, uuid, text, text, text)              to authenticated;
grant execute on function public.redact_my_submission(uuid, text, text, text)            to authenticated;
grant execute on function public.get_my_today_submission(uuid)                           to authenticated;
grant execute on function public.list_challenge_submissions(uuid, int)                   to authenticated;
grant execute on function public.get_submission_with_author(uuid)                        to authenticated;
grant execute on function public.verify_submission(uuid, verification_result)            to authenticated;

-- Streaks / Home
grant execute on function public.challenge_streak(uuid)                  to authenticated;
grant execute on function public.list_challenge_streaks(uuid)            to authenticated;
grant execute on function public.get_home_overview()                     to authenticated;
grant execute on function public.list_pending_verifications_for_me()     to authenticated;
grant execute on function public.get_my_streak_aggregate()               to authenticated;

-- Social
grant execute on function public.react_to_submission(uuid, text)         to authenticated;
grant execute on function public.list_submission_reactors(uuid, text)    to authenticated;
grant execute on function public.add_comment(uuid, text)                 to authenticated;
grant execute on function public.list_submission_comments(uuid)          to authenticated;
grant execute on function public.like_comment(uuid)                      to authenticated;
grant execute on function public.unlike_comment(uuid)                    to authenticated;
grant execute on function public.list_comment_likers(uuid)               to authenticated;

-- Moderation
grant execute on function public.report_target(report_target, uuid, text, text) to authenticated;
grant execute on function public.block_user(uuid)                                to authenticated;
grant execute on function public.unblock_user(uuid)                              to authenticated;
grant execute on function public.request_account_deletion()                      to authenticated;

-- Push: register/unregister are caller-facing; dispatch RPCs are service-role only.
revoke all on function public.register_push_token(text, text, text) from public;
grant execute on function public.register_push_token(text, text, text) to authenticated;
revoke all on function public.unregister_push_token(text) from public;
grant execute on function public.unregister_push_token(text) to authenticated;

revoke all on function public.claim_pending_notifications(int)              from public;
revoke all on function public.mark_notification_sent(uuid, text)            from public;
revoke all on function public.mark_notification_failed(uuid, text, boolean) from public;
revoke all on function public.revoke_push_token(text, text)                 from public;

grant execute on function public.claim_pending_notifications(int)              to service_role;
grant execute on function public.mark_notification_sent(uuid, text)            to service_role;
grant execute on function public.mark_notification_failed(uuid, text, boolean) to service_role;
grant execute on function public.revoke_push_token(text, text)                 to service_role;

