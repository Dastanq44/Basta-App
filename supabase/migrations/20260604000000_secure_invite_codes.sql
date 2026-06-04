-- Security follow-up: replace short, guessable invite codes with high-entropy ones.
--
-- WHY: the 20260601 migration made codes 4-digit numeric (10,000 combinations). That is
-- brute-forceable — anyone can enumerate 0000..9999 and join arbitrary groups. This migration
-- supersedes that decision (see DECISIONS.md / BUGS_AND_WARNINGS W-026): codes become
-- **12 characters from [A-Za-z0-9]** (62^12 ≈ 3.2×10^21 — infeasible to guess), generated from
-- a cryptographic source (pgcrypto `gen_random_bytes`). Codes are CASE-SENSITIVE (both cases in
-- the alphabet), so the client must not upper/lower-case them and the join compares exactly
-- (`join_group_by_invite` already does `invite_code = p_code`, no normalization — unchanged).
--
-- Idempotent: `create or replace` function; `set default` is repeatable; the regen only touches
-- codes that aren't already 12-char base62 (so re-runs don't churn codes); the CHECK is dropped
-- then re-added. Column is already `text` (no length cap) and has no prior format CHECK.

create or replace function generate_invite_code()
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
    -- Cryptographically strong randomness (pgcrypto). 256 mod 62 introduces negligible bias.
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

-- New groups use the strong generator by default.
alter table public.groups
  alter column invite_code set default generate_invite_code();

-- Upgrade any existing weak codes (4-digit, or anything not already 12-char base62).
-- One UPDATE per row so each iteration sees prior updates (MVCC) and avoids in-statement collisions.
-- Codes that are already 12-char [A-Za-z0-9] (e.g. legacy 12-hex) are strong enough and left as-is.
do $$
declare
  r record;
begin
  for r in select id from public.groups where invite_code !~ '^[A-Za-z0-9]{12}$' loop
    update public.groups set invite_code = generate_invite_code() where id = r.id;
  end loop;
end $$;

-- Enforce the format at the DB level so a weak code can never be inserted again.
alter table public.groups drop constraint if exists groups_invite_code_format;
alter table public.groups add constraint groups_invite_code_format
  check (invite_code ~ '^[A-Za-z0-9]{12}$');

-- The 4-digit generator is no longer used (default now points at generate_invite_code()).
drop function if exists generate_short_invite_code();
