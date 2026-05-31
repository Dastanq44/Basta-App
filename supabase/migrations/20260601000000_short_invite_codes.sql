-- Follow-up to Phase 1: switch `groups.invite_code` from 12-char hex to 4-digit numeric for
-- friendlier sharing (e.g. "1023", "5056", "0490"). Idempotent — safe to re-run.
--
-- DESIGN:
--   * 4 digits = 10,000 codes. Plenty for MVP (≤50 groups; collision probability tiny).
--   * `generate_short_invite_code()` retries up to 30 attempts before raising — long-running
--     collisions surface as an error rather than an infinite loop.
--   * Existing groups with old hex codes are regenerated one row at a time so each call sees
--     prior updates and avoids in-statement collisions.
--   * Column stays `unique not null`, so on the rare collision we never get a duplicate.

create or replace function generate_short_invite_code()
returns text
language plpgsql
as $$
declare
  v_code text;
  v_attempts int := 0;
begin
  loop
    v_code := lpad((floor(random() * 10000))::int::text, 4, '0');
    if not exists (select 1 from public.groups where invite_code = v_code) then
      return v_code;
    end if;
    v_attempts := v_attempts + 1;
    if v_attempts >= 30 then
      raise exception 'could not generate unique invite code after 30 attempts' using errcode = 'P0002';
    end if;
  end loop;
end $$;

-- Make new groups use the 4-digit generator by default.
alter table public.groups
  alter column invite_code set default generate_short_invite_code();

-- Regenerate codes for any existing groups still in the old hex format.
-- One UPDATE per row so the next iteration sees prior updates (Postgres MVCC visibility).
do $$
declare
  r record;
begin
  for r in select id from public.groups where invite_code !~ '^[0-9]{4}$' loop
    update public.groups set invite_code = generate_short_invite_code() where id = r.id;
  end loop;
end $$;
