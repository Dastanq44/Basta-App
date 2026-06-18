-- Global feed v1 — chronological list of PUBLIC, VERIFIED submissions (no discovery of
-- challenges/groups/profiles, no ranking/trending). Builds on the privacy foundation
-- (20260614 + 20260615). Bootstrap stays frozen (D-013). Idempotent.
-- Apply via Supabase Dashboard -> SQL editor or `supabase db push`.
--
-- The eligibility gate is is_submission_globally_visible() (the single source of truth):
-- verified + opted-in + author public + challenge public & active + (group public & active for
-- group challenges) + no block between viewer and author, either direction. SECURITY DEFINER so
-- the joins to profiles/challenges/groups aren't blocked by RLS, but auth.uid() (used inside the
-- gate for the block check) still resolves to the caller.

create or replace function public.list_global_submissions(
  p_limit  int default 20,
  p_before timestamptz default null
)
returns table (
  id                   uuid,
  challenge_id         uuid,
  author_id            uuid,
  title                text,
  comment              text,
  media_path           text,
  created_at           timestamptz,
  challenge_day        int,
  author_username      text,
  author_display_name  text,
  author_avatar_url    text,
  challenge_title      text,
  challenge_category   text,
  group_id             uuid,
  group_name           text,
  reaction_count       int,
  comment_count        int
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  return query
    select
      s.id, s.challenge_id, s.author_id, s.title, s.comment, s.media_path, s.created_at, s.challenge_day,
      p.username, p.display_name, p.avatar_url,
      c.title, c.category,
      g.id, g.name,
      coalesce(rc.cnt, 0)::int as reaction_count,
      coalesce(cc.cnt, 0)::int as comment_count
    from public.submissions s
    join public.profiles   p on p.id = s.author_id
    join public.challenges c on c.id = s.challenge_id
    left join public.groups g on g.id = c.group_id
    left join lateral (
      select count(*) as cnt from public.submission_reactions r where r.submission_id = s.id
    ) rc on true
    left join lateral (
      select count(*) as cnt from public.submission_comments cm where cm.submission_id = s.id
    ) cc on true
    where s.status = 'verified'
      and (p_before is null or s.created_at < p_before)
      and public.is_submission_globally_visible(s.id)
    order by s.created_at desc
    limit greatest(1, least(coalesce(p_limit, 20), 100));
end $$;
revoke execute on function public.list_global_submissions(int, timestamptz) from public;
grant execute on function public.list_global_submissions(int, timestamptz) to authenticated;

-- ============================================================
-- Social reads: gate on can_view_submission (not participant-only)
-- ============================================================
-- The submission-detail social rows were SELECT-gated to challenge participants. The reaction
-- summary is read with a DIRECT select (src getReactions), so a Global viewer of a globally-visible
-- submission would see ZERO reactions (and not even their own after reacting). Widen the three
-- submission-social SELECT policies to `can_view_submission` so they match the social write/read
-- RPCs. Private submissions are unaffected (can_view_submission = participant for those). Comments
-- and likers are read via SECURITY DEFINER RPCs, but their policies are widened too for consistency
-- (purely additive — no private row is exposed; can_view_submission still enforces the gate).
drop policy if exists sr_select_participant on public.submission_reactions;
create policy sr_select_participant on public.submission_reactions for select
  using (public.can_view_submission(submission_id));

drop policy if exists sc_select_participant on public.submission_comments;
create policy sc_select_participant on public.submission_comments for select
  using (public.can_view_submission(submission_id));

drop policy if exists scl_select_participant on public.submission_comment_likes;
create policy scl_select_participant on public.submission_comment_likes for select
  using (
    exists (
      select 1 from public.submission_comments c
      where c.id = submission_comment_likes.comment_id
        and public.can_view_submission(c.submission_id)
    )
  );
