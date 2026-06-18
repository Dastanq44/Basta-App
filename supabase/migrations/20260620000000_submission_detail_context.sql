-- Submission detail context — the detail page needs the challenge title + group identity (and
-- whether the VIEWER can open them) for the new user/challenge/group context boxes. Bootstrap stays
-- frozen (D-013). Idempotent. Apply via Dashboard -> SQL editor or `supabase db push`.
--
-- Extends get_submission_with_author (same gate: can_view_submission) with challenge_title, group_id,
-- group_name, and can_open_challenge / can_open_group (the challenge/group detail screens are
-- participant/member-only, so the client only links boxes the viewer can actually open). No invite
-- codes / private fields. The RETURN shape changes, so this DROPs + recreates.

drop function if exists public.get_submission_with_author(uuid);
create function public.get_submission_with_author(p_submission_id uuid)
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
  author_display_name  text,
  is_public            boolean,
  challenge_title      text,
  group_id             uuid,
  group_name           text,
  can_open_challenge   boolean,
  can_open_group       boolean
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not public.can_view_submission(p_submission_id) then return; end if;  -- not found / not allowed
  return query
    select s.id, s.challenge_id, s.author_id, s.challenge_day, s.title, s.comment,
           s.media_path, s.status, s.verified_at, s.rejected_at, s.created_at,
           p.username, p.display_name, s.is_public,
           c.title, c.group_id, g.name,
           public.is_challenge_participant(c.id),
           (g.id is not null and public.is_group_member(g.id))
    from public.submissions s
    join public.profiles   p on p.id = s.author_id
    join public.challenges c on c.id = s.challenge_id
    left join public.groups g on g.id = c.group_id
    where s.id = p_submission_id;
end $$;
revoke execute on function public.get_submission_with_author(uuid) from public;
grant execute on function public.get_submission_with_author(uuid) to authenticated;
