-- Fix: editing a submission with a NEW photo failed with "new row violates row-level
-- security policy". proof-media had only INSERT + SELECT storage policies — no UPDATE/DELETE.
--
-- WHY: editing re-uploads the photo to the SAME deterministic path
--   (<uid>/<challengeId>/<submissionId>.jpg) with upsert=true. When the object already
--   exists (it does on edit), the upsert is an UPDATE of storage.objects, which has no
--   policy -> denied. (New submissions worked because that's a fresh INSERT.)
--
-- FIX: add own-folder UPDATE + DELETE policies for proof-media, gated on the uid path
--   segment exactly like the INSERT policy. Mirrors what user-avatars already has (which is
--   why user-avatar re-upload works).
--
-- NOTE (D-013): new migration on top of the frozen bootstrap.
-- Apply via Supabase Dashboard -> SQL editor or `supabase db push`. Idempotent.

drop policy if exists storage_proof_media_update on storage.objects;
create policy storage_proof_media_update on storage.objects for update to authenticated
  using (
    bucket_id = 'proof-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_proof_media_delete on storage.objects;
create policy storage_proof_media_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'proof-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
