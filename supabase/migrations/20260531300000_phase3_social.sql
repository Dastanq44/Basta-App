-- Phase 3 migration: reactions + short comments on submissions (T-041).
-- Apply via Supabase Dashboard → SQL editor or `supabase db push`. See W-017 in BUGS_AND_WARNINGS.
--
-- DESIGN (consistent with Phase 1/2/3):
--   * Writes go through SECURITY DEFINER RPCs (participant-gated); RLS is read-only.
--   * One reaction per user per submission (re-selectable / removable). Comments are short (≤280).
--   * Visibility = challenge participants (same as submissions): is_challenge_participant(challenge).

-- ============================================================
-- Tables
-- ============================================================
create table if not exists submission_reactions (
  submission_id uuid not null references submissions(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  emoji         text not null check (char_length(emoji) between 1 and 8),
  created_at    timestamptz not null default now(),
  primary key (submission_id, user_id)
);
create index if not exists submission_reactions_sub_idx on submission_reactions(submission_id);

create table if not exists submission_comments (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  author_id     uuid not null references profiles(id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 280),
  created_at    timestamptz not null default now()
);
create index if not exists submission_comments_sub_idx on submission_comments(submission_id, created_at);

-- ============================================================
-- RLS — read for challenge participants; writes via the RPCs below.
-- ============================================================
alter table submission_reactions enable row level security;
alter table submission_comments  enable row level security;

drop policy if exists sr_select_participant on submission_reactions;
create policy sr_select_participant on submission_reactions for select using (
  exists (select 1 from public.submissions s
          where s.id = submission_reactions.submission_id and is_challenge_participant(s.challenge_id))
);

drop policy if exists sc_select_participant on submission_comments;
create policy sc_select_participant on submission_comments for select using (
  exists (select 1 from public.submissions s
          where s.id = submission_comments.submission_id and is_challenge_participant(s.challenge_id))
);

-- ============================================================
-- RPC: react_to_submission — upsert my reaction; null/blank emoji removes it.
-- ============================================================
create or replace function react_to_submission(p_submission_id uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ch  uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select challenge_id into v_ch from public.submissions where id = p_submission_id;
  if v_ch is null then raise exception 'submission not found'; end if;
  if not is_challenge_participant(v_ch) then
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
grant execute on function react_to_submission(uuid, text) to authenticated;

-- ============================================================
-- RPC: add_comment — participant-gated insert; returns the new id + timestamp.
-- ============================================================
create or replace function add_comment(p_submission_id uuid, p_body text)
returns json
language plpgsql
security definer
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
  if not is_challenge_participant(v_ch) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  insert into public.submission_comments (submission_id, author_id, body)
    values (p_submission_id, v_uid, left(trim(p_body), 280))
    returning id, created_at into v_id, v_created;

  return json_build_object('id', v_id, 'created_at', v_created);
end $$;
grant execute on function add_comment(uuid, text) to authenticated;
