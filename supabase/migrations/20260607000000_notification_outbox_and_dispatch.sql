-- T-050B / W-033: notification outbox + verification-flow triggers + dispatch RPCs.
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. Idempotent.
--
-- DEPENDS ON: W-032 (push_tokens) AND W-019 (blocks table used to suppress
--   notifications across blocked relationships). If W-019 is not applied, the
--   `verify_needed` trigger will fail on the `from public.blocks` reference — apply
--   both before this migration.
--
-- SCOPE:
--   1. `notification_outbox` table with status lifecycle pending → processing → sent
--      or failed, attempts counter, last_error, claimed_at/sent_at.
--   2. Enqueue triggers:
--        a. AFTER INSERT submissions → `verify_needed` to each eligible group member
--           (excluding the author + blocked pairs in either direction). Group-mode
--           challenges only.
--        b. AFTER UPDATE OF status submissions → `verify_result` to the author when
--           the new status is verified or rejected. Includes the result in the data
--           payload + the duplicate-pending check is keyed on (user, submission,
--           category, status).
--   3. Dispatch RPCs (claim/sent/failed/revoke_push_token) — restricted to
--      service_role; PUBLIC/anon/authenticated have no execute rights.
--   4. Hardening of the W-032 register/unregister RPCs (REVOKE FROM public, explicit
--      GRANT TO authenticated). The previous migration relied on the default PUBLIC
--      grant. anon (signed-out) callers wouldn't pass the `auth.uid() IS NULL` guard
--      anyway, but explicit grants are clearer and safer.
--
-- NOT IN THIS SLICE: notification_preferences, quiet hours, daily cap, daily
-- reminder + streak-at-risk categories, pg_cron schedule, pg_net invocation,
-- deep-link tap handling. Those land in T-050C.

-- ============================================================
-- 0. Hardening — revoke W-032 RPC execute from PUBLIC; grant only to authenticated.
-- ============================================================
revoke all on function public.register_push_token(text, text, text) from public;
grant execute on function public.register_push_token(text, text, text) to authenticated;
revoke all on function public.unregister_push_token(text) from public;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ============================================================
-- 1. notification_outbox table
-- ============================================================
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

create index if not exists notification_outbox_status_created_idx
  on public.notification_outbox (status, created_at);

create index if not exists notification_outbox_user_created_idx
  on public.notification_outbox (user_id, created_at desc);

alter table public.notification_outbox enable row level security;

-- The outbox is server-managed; clients have no business reading or writing it.
-- (A future debug screen could expose own-row SELECT, but that's not T-050B's scope.)
-- No policies = default-deny on every operation. The triggers + dispatch RPCs run
-- with SECURITY DEFINER so they bypass RLS for their own writes.

-- ============================================================
-- 2a. Enqueue trigger: verify_needed (AFTER INSERT submissions, group + pending only)
-- ============================================================
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
  if new.status <> 'pending_verification' then
    return null;
  end if;

  select c.group_id, c.mode into v_group_id, v_mode
    from public.challenges c
   where c.id = new.challenge_id;

  if v_mode is null or v_mode <> 'group' or v_group_id is null then
    return null;
  end if;

  v_title := 'Proof needs review';

  -- One outbox row per eligible group member. Excludes the author and any pair
  -- with a block in either direction. The NOT EXISTS dedup ensures repeated
  -- triggers (resubmits hitting the idempotency path do NOT re-enqueue) don't
  -- pile up duplicates.
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

-- ============================================================
-- 2b. Enqueue trigger: verify_result (AFTER UPDATE OF status, to verified/rejected)
-- ============================================================
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
  if new.status not in ('verified','rejected') then
    return null;
  end if;
  if old.status is not distinct from new.status then
    return null;
  end if;

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

-- ============================================================
-- 3a. claim_pending_notifications(p_limit int)
-- Claims up to p_limit pending outbox rows (FOR UPDATE SKIP LOCKED), bumps
-- attempts, sets status='processing', sets claimed_at=now(), and returns one row
-- per (outbox, active push token) pair. If a claimed outbox has zero active tokens
-- for its user, exactly one row is emitted with expo_token = NULL so the caller can
-- mark it failed.
-- ============================================================
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
language plpgsql
security definer
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
  select
    c.id          as outbox_id,
    c.user_id,
    c.category,
    c.title,
    c.body,
    c.data,
    c.attempts,
    pt.expo_token,
    pt.platform
  from claimed c
  left join public.push_tokens pt
    on pt.user_id = c.user_id and pt.revoked_at is null;
end $$;

-- ============================================================
-- 3b. mark_notification_sent(p_outbox_id uuid, p_ticket_id text default null)
-- Idempotent: only updates rows still in 'processing'. Repeated calls (from per-
-- token tickets that resolved 'ok' on different devices) are no-ops after the first.
-- ============================================================
create or replace function public.mark_notification_sent(
  p_outbox_id uuid,
  p_ticket_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_outbox
     set status     = 'sent',
         sent_at    = now(),
         last_error = null
   where id = p_outbox_id
     and status = 'processing';
  -- p_ticket_id is accepted for future receipt-checking work; not stored yet.
  perform p_ticket_id;
end $$;

-- ============================================================
-- 3c. mark_notification_failed(p_outbox_id uuid, p_error text, p_retryable boolean)
-- Retryable + attempts < 3 → status='pending' (the next claim picks it up again,
-- claimed_at cleared so it sorts naturally with newer pendings); otherwise
-- terminal 'failed'.
-- ============================================================
create or replace function public.mark_notification_failed(
  p_outbox_id uuid,
  p_error     text,
  p_retryable boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_outbox o
     set status     = case
                        when p_retryable and o.attempts < 3 then 'pending'
                        else 'failed'
                      end,
         claimed_at = case
                        when p_retryable and o.attempts < 3 then null
                        else o.claimed_at
                      end,
         last_error = left(coalesce(p_error, ''), 500)
   where o.id = p_outbox_id
     and o.status = 'processing';
end $$;

-- ============================================================
-- 3d. revoke_push_token(p_expo_token text, p_reason text)
-- Used by the Edge Function on DeviceNotRegistered + similar terminal token
-- errors. p_reason is accepted for future audit but not stored yet.
-- ============================================================
create or replace function public.revoke_push_token(
  p_expo_token text,
  p_reason     text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.push_tokens
     set revoked_at = now()
   where expo_token = p_expo_token
     and revoked_at is null;
  perform p_reason;
end $$;

-- ============================================================
-- 4. Hardening — restrict dispatch RPCs to service_role. PUBLIC/anon/authenticated
-- have NO execute rights. The Edge Function authenticates with the project's
-- service-role key (stored in the function's secrets, never bundled with the app).
-- ============================================================
revoke all on function public.claim_pending_notifications(int)            from public;
revoke all on function public.mark_notification_sent(uuid, text)          from public;
revoke all on function public.mark_notification_failed(uuid, text, boolean) from public;
revoke all on function public.revoke_push_token(text, text)               from public;

grant execute on function public.claim_pending_notifications(int)            to service_role;
grant execute on function public.mark_notification_sent(uuid, text)          to service_role;
grant execute on function public.mark_notification_failed(uuid, text, boolean) to service_role;
grant execute on function public.revoke_push_token(text, text)               to service_role;
