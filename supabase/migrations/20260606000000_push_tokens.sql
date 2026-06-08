-- T-050A / W-031: push_tokens table for ExpoPushToken registration.
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. Idempotent.
--
-- SCOPE: registration ONLY. No server-side dispatch, no triggers, no pg_cron, no
-- pg_net, no notification_outbox, no preferences. Those land in T-050B/T-050C as
-- separate migrations. The client calls `register_push_token` after permission +
-- token fetch; the row sits in this table until the dispatch layer reads it later.
--
-- DESIGN:
--   * One row per (expo_token). The token itself is the natural PK — Expo guarantees
--     uniqueness per device install.
--   * `user_id` is the OWNER. A token can be re-registered against a different user
--     (same device, new sign-in) — the upsert below replaces user_id in that case so
--     the token never "belongs" to a previous account.
--   * `revoked_at` is set on explicit unregister (e.g. sign-out). Indexes filter on
--     `revoked_at is null` so dispatch (T-050B) ignores revoked tokens cheaply.
--   * RLS: SELECT-own only. INSERT/UPDATE/DELETE happen ONLY through the two
--     SECURITY DEFINER RPCs below — no direct table writes.

create table if not exists public.push_tokens (
  expo_token   text primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  platform     text not null check (platform in ('ios','android','web')),
  device_name  text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at   timestamptz
);

create index if not exists push_tokens_user_active_idx
  on public.push_tokens(user_id)
  where revoked_at is null;

alter table public.push_tokens enable row level security;

-- SELECT-own. (Reading another user's token would be a small information leak.)
drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens for select
  using (user_id = auth.uid());

-- Intentionally NO insert/update/delete policies. All writes go through the
-- SECURITY DEFINER RPCs so the rules are enforced in one place.

-- ============================================================
-- RPC: register_push_token
-- Upserts by `expo_token`. Refreshes last_seen_at; clears any prior revoked_at so a
-- previously-revoked token can be re-activated (e.g. user re-signs in on the same
-- device). Reassigns user_id on conflict so a token previously bound to user A is
-- transferred to user B after a sign-in switch.
-- ============================================================
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
  if length(v_trimmed) = 0 then
    raise exception 'token is required' using errcode = '22023';
  end if;
  if p_platform not in ('ios','android','web') then
    raise exception 'unknown platform' using errcode = '22023';
  end if;

  insert into public.push_tokens (expo_token, user_id, platform, device_name)
    values (v_trimmed, v_uid, p_platform, p_device_name)
  on conflict (expo_token) do update
    set user_id      = excluded.user_id,
        platform     = excluded.platform,
        device_name  = excluded.device_name,
        last_seen_at = now(),
        revoked_at   = null;
end $$;
grant execute on function public.register_push_token(text, text, text) to authenticated;

-- ============================================================
-- RPC: unregister_push_token
-- Soft-revoke. The row stays so we can audit / re-activate later; dispatch (T-050B)
-- filters `revoked_at is null` via the partial index above. Caller can only revoke
-- their own tokens.
-- ============================================================
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
   where expo_token = v_trimmed
     and user_id    = v_uid
     and revoked_at is null;
end $$;
grant execute on function public.unregister_push_token(text) to authenticated;
