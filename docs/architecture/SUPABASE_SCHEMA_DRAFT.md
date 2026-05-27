# Basta — Supabase Schema Draft

> ⛔ **DRAFT — DO NOT APPLY YET.** This is illustrative intent, not a final migration. RLS here is
> sketched and **must be hardened and tested (pgTAP) before being trusted.** When implementation
> begins, the reviewed version moves into `supabase/migrations/`. No migrations have been applied.
>
> Domain model: [`DATA_MODEL.md`](DATA_MODEL.md). Server-authoritative scoring is locked (D-003).

## Enums

```sql
create type challenge_mode      as enum ('solo','group');
create type submission_status   as enum ('pending_verification','verified','rejected');
create type verification_result as enum ('approve','reject');
create type member_role         as enum ('owner','admin','member');
create type report_target       as enum ('submission','comment','user');
```

## Tables

```sql
-- Profiles (1:1 with auth.users)
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  display_name  text not null,
  avatar_url    text,
  timezone      text not null default 'UTC',     -- drives day-boundary math (D-003)
  onboarded     boolean not null default false,
  terms_version text,                            -- versioned T&S acceptance
  created_at    timestamptz not null default now()
);

-- Groups & membership
create table groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references profiles(id),
  invite_code text unique not null default encode(gen_random_bytes(6),'hex'),
  created_at  timestamptz not null default now()
);
create table group_members (
  group_id  uuid references groups(id) on delete cascade,
  user_id   uuid references profiles(id) on delete cascade,
  role      member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Challenges & participants
create table challenges (
  id                     uuid primary key default gen_random_uuid(),
  group_id               uuid references groups(id) on delete cascade, -- NULL for solo
  creator_id             uuid not null references profiles(id),
  title                  text not null,
  category               text not null,
  mode                   challenge_mode not null,
  start_date             date not null,
  duration_days          int  not null check (duration_days between 1 and 365),
  verification_threshold int  not null default 1 check (verification_threshold >= 1),
  created_at             timestamptz not null default now(),
  check ((mode = 'group') = (group_id is not null))
);
create table challenge_participants (
  challenge_id uuid references challenges(id) on delete cascade,
  user_id      uuid references profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

-- Submissions (proof)
create table submissions (
  id            uuid primary key default gen_random_uuid(),  -- client-generated UUID (idempotency)
  challenge_id  uuid not null references challenges(id) on delete cascade,
  author_id     uuid not null references profiles(id),
  challenge_day int  not null,                                -- server-assigned, author tz
  comment       text,
  media_path    text,                                         -- private Storage object path
  status        submission_status not null default 'pending_verification',
  verified_at   timestamptz,
  rejected_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (challenge_id, author_id, challenge_day)             -- one proof per day
);

-- Verifications / comments / reactions
create table verifications (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  verifier_id   uuid not null references profiles(id),
  result        verification_result not null,
  created_at    timestamptz not null default now(),
  unique (submission_id, verifier_id)
);
create table comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null check (char_length(body) <= 500),
  created_at timestamptz not null default now()
);
create table reactions (
  submission_id uuid references submissions(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  type text not null default 'like',
  primary key (submission_id, user_id, type)
);

-- Streaks (server-maintained projection)
create table streaks (
  challenge_id   uuid references challenges(id) on delete cascade,
  user_id        uuid references profiles(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_day       int,
  primary key (challenge_id, user_id)
);

-- Trust & safety + push
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id),
  target_type report_target not null,
  target_id   uuid not null,
  reason      text not null,
  created_at  timestamptz not null default now()
);
create table blocks (
  blocker_id uuid references profiles(id) on delete cascade,
  blocked_id uuid references profiles(id) on delete cascade,
  primary key (blocker_id, blocked_id)
);
create table push_tokens (
  user_id  uuid references profiles(id) on delete cascade,
  token    text not null,
  platform text not null,
  primary key (user_id, token)
);
create table notification_prefs (
  user_id      uuid primary key references profiles(id) on delete cascade,
  quiet_start  time,
  quiet_end    time,
  daily_cap    int not null default 3,
  reminders_on boolean not null default true
);
```

## Server-authoritative logic (client must never do this)

```sql
-- Forbid verifying your own submission
create or replace function assert_not_self_verify() returns trigger language plpgsql as $$
begin
  if exists (select 1 from submissions s
             where s.id = new.submission_id and s.author_id = new.verifier_id) then
    raise exception 'cannot verify your own submission';
  end if;
  return new;
end $$;
create trigger trg_no_self_verify before insert on verifications
  for each row execute function assert_not_self_verify();

-- Flip submission to verified once the threshold of approvals is reached
create or replace function maybe_mark_verified() returns trigger language plpgsql as $$
declare approvals int; threshold int;
begin
  select count(*) into approvals from verifications
    where submission_id = new.submission_id and result = 'approve';
  select c.verification_threshold into threshold
    from submissions s join challenges c on c.id = s.challenge_id
    where s.id = new.submission_id;
  if approvals >= threshold then
    update submissions set status='verified', verified_at=now()
      where id = new.submission_id and status <> 'verified';
    -- TODO (implementation): recompute streak for that author/challenge here
  end if;
  return new;
end $$;
create trigger trg_mark_verified after insert on verifications
  for each row execute function maybe_mark_verified();

-- Leaderboard: verified-day counts per group challenge (a VIEW; never client-stored)
create view group_leaderboard as
  select c.group_id, s.challenge_id, s.author_id,
         count(*) filter (where s.status='verified') as verified_days
  from submissions s join challenges c on c.id = s.challenge_id
  where c.group_id is not null
  group by c.group_id, s.challenge_id, s.author_id;
```

## RLS intent (SKETCH — must be hardened + tested before trust)

```sql
alter table submissions enable row level security;

-- Read submissions in challenges you participate in, excluding blocked users.
create policy sub_read on submissions for select using (
  exists (select 1 from challenge_participants p
          where p.challenge_id = submissions.challenge_id and p.user_id = auth.uid())
  and not exists (select 1 from blocks b
          where b.blocker_id = auth.uid() and b.blocked_id = submissions.author_id)
);

-- Insert only your own submissions.
create policy sub_insert on submissions for insert with check (author_id = auth.uid());

-- TODO: equivalent RLS for profiles, groups, group_members, challenges,
-- challenge_participants, verifications, comments, reactions, reports, blocks,
-- push_tokens, notification_prefs. Add pgTAP tests for: can't verify own submission,
-- blocked-user filtering both directions, one-proof-per-day uniqueness.
```

## Known traps (see ../claude-memory/BUGS_AND_WARNINGS.md)

- **W-003** — `challenge_day` / day-boundary MUST use `profiles.timezone`, not UTC. DST will look
  right locally and break server-side if shortcut.
- Streaks/leaderboards are server-authoritative — never compute on-device.
