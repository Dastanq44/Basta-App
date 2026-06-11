-- Slice T-053-C / W-036: free-form emoji reactions.
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. Idempotent.
--
-- WHY: the reactions enum was previously a hardcoded 4-emoji set enforced only on the
--   client. Now the user can pick any emoji from a full system-style picker, so the
--   server's char_length CHECK needs to allow multi-codepoint ZWJ sequences (e.g.
--   👨‍🚀, 👨‍❤️‍💋‍👨), which can exceed the old 8-char ceiling. Widen to 32 chars.
--
-- TOUCHES:
--   * `submission_reactions.emoji` CHECK widened 1..8 → 1..32 chars.
--   * `list_submission_reactors` (NEW RPC) — users who reacted with a given emoji,
--     for the long-press popover on a reaction chip.

-- ============================================================
-- 1. Widen the CHECK constraint
-- ============================================================
alter table public.submission_reactions
  drop constraint if exists submission_reactions_emoji_check;

-- Postgres auto-names this `submission_reactions_emoji_check` when the CHECK was inline
-- on the column. Older databases may have it under a different name; do a defensive
-- broader search before re-adding so we don't duplicate.
do $$
declare
  v_old text;
begin
  select conname into v_old
    from pg_constraint
   where conrelid = 'public.submission_reactions'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%char_length(emoji)%';
  if v_old is not null then
    execute format('alter table public.submission_reactions drop constraint %I', v_old);
  end if;
end $$;

alter table public.submission_reactions
  add constraint submission_reactions_emoji_check
  check (char_length(emoji) between 1 and 32);

-- ============================================================
-- 2. list_submission_reactors — who reacted with a given emoji
-- ============================================================
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
declare
  v_ch uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_emoji is null or char_length(btrim(p_emoji)) = 0 then return; end if;

  select challenge_id into v_ch from public.submissions where id = p_submission_id;
  if v_ch is null then return; end if;
  if not is_challenge_participant(v_ch) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  return query
    select p.id, p.username, p.display_name, r.created_at
      from public.submission_reactions r
      join public.profiles p on p.id = r.user_id
     where r.submission_id = p_submission_id
       and r.emoji         = p_emoji
     order by r.created_at asc;
end $$;
grant execute on function public.list_submission_reactors(uuid, text) to authenticated;
