// Media upload — standard Supabase Storage (D-008; tus deferred to video).
//
// On React Native, the standard upload path is: fetch the local file URI to get its bytes,
// then pass an ArrayBuffer to the Supabase client with an explicit content-type. The library
// supports this directly under SDK 54 / @supabase/supabase-js 2.x.
import { supabase } from '@/shared/lib/supabase';

export const PROOF_MEDIA_BUCKET = 'proof-media';

export type UploadResult = { remotePath: string };

/**
 * Uploads `localUri` to the `proof-media` bucket at a deterministic path:
 *   <userId>/<challengeId>/<submissionId>.jpg
 *
 * Storage RLS only allows authenticated users to write under their own `<userId>/...`
 * prefix; the path is constructed here so a malformed call is caught early.
 */
export async function uploadProofMedia(args: {
  userId: string;
  challengeId: string;
  submissionId: string;
  localUri: string;
  contentType?: string;
}): Promise<UploadResult> {
  const { userId, challengeId, submissionId, localUri, contentType = 'image/jpeg' } = args;
  const remotePath = `${userId}/${challengeId}/${submissionId}.jpg`;

  // RN-safe binary read.
  const res = await fetch(localUri);
  if (!res.ok) throw new Error(`Could not read local media (${res.status})`);
  const buf = await res.arrayBuffer();

  const { error } = await supabase.storage.from(PROOF_MEDIA_BUCKET).upload(remotePath, buf, {
    contentType,
    // We never want overwrites — same `submissionId` means a retry of the same draft.
    upsert: true,
    cacheControl: '3600',
  });
  if (error) throw error;
  return { remotePath };
}
