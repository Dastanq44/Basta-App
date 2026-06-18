-- Delete challenge — creator-only HARD delete (replaces the removed archive feature). The existing
-- FKs (submissions/challenge_participants → challenges, and verifications/reactions/comments/likes →
-- submissions) are all `on delete cascade`, so removing the challenge cleans up its dependents.
-- (Storage proof-media objects are not DB rows, so they orphan harmlessly.) Bootstrap frozen
-- (D-013). Idempotent. Apply via Dashboard -> SQL editor or `supabase db push`.
create or replace function public.delete_challenge(p_challenge_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_creator uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select creator_id into v_creator from public.challenges where id = p_challenge_id;
  if v_creator is null then raise exception 'challenge not found' using errcode = 'P0002'; end if;
  if v_creator <> v_uid then
    raise exception 'only the creator can delete this challenge' using errcode = '42501';
  end if;
  delete from public.challenges where id = p_challenge_id;
end $$;
revoke execute on function public.delete_challenge(uuid) from public;
grant execute on function public.delete_challenge(uuid) to authenticated;
