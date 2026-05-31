// Proofs API — read-side wrappers. WRITES go through the offline queue, not direct API calls,
// because the product must not lose a draft to bad connectivity (D-004).
import { supabase } from '@/shared/lib/supabase';
import type { ServerSubmissionStatus, Submission } from '@/entities';

const TIMEOUT_MS = 10_000;
function ctrl(): AbortController {
  const c = new AbortController();
  setTimeout(() => c.abort(new Error('request timed out')), TIMEOUT_MS);
  return c;
}

type SubmissionRow = {
  id: string;
  challenge_id: string;
  author_id: string;
  challenge_day: number;
  comment: string | null;
  media_path: string | null;
  status: ServerSubmissionStatus;
  verified_at: string | null;
  rejected_at: string | null;
  created_at: string;
};

function toSubmission(r: SubmissionRow): Submission {
  return {
    id: r.id,
    challengeId: r.challenge_id,
    authorId: r.author_id,
    challengeDay: r.challenge_day,
    comment: r.comment ?? undefined,
    mediaRemotePath: r.media_path ?? undefined,
    status: r.status,
    createdAt: r.created_at,
  };
}

const COLS = 'id, challenge_id, author_id, challenge_day, comment, media_path, status, verified_at, rejected_at, created_at';

/** Recent submissions for a challenge — used in the detail screen. */
export async function listSubmissionsForChallenge(challengeId: string, limit = 20): Promise<Submission[]> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(COLS)
      .eq('challenge_id', challengeId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .abortSignal(c.signal);
    if (error) throw error;
    return (data ?? []).map((r) => toSubmission(r as SubmissionRow));
  } catch (e) {
    console.error('[basta] listSubmissionsForChallenge failed:', e);
    throw e;
  }
}

/** A single submission by id (used by the verify screen). RLS limits this to participants. */
export async function getSubmission(submissionId: string): Promise<Submission | null> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(COLS)
      .eq('id', submissionId)
      .abortSignal(c.signal)
      .maybeSingle();
    if (error) throw error;
    return data ? toSubmission(data as SubmissionRow) : null;
  } catch (e) {
    console.error('[basta] getSubmission failed:', e);
    throw e;
  }
}

// Canonical bucket name lives in src/offline/upload/storage.ts (PROOF_MEDIA_BUCKET); kept inline
// here so the read-side API doesn't depend on the upload module.
const PROOF_MEDIA_BUCKET = 'proof-media';

/**
 * Short-lived signed URL for a private proof-media object. Storage RLS (Phase 3) lets challenge
 * co-participants read each other's proofs, so a verifier can fetch this for the captured photo.
 * Returns null when there is no media path.
 */
export async function getProofSignedUrl(mediaPath: string | undefined, expiresInSec = 3600): Promise<string | null> {
  if (!mediaPath) return null;
  try {
    const { data, error } = await supabase.storage
      .from(PROOF_MEDIA_BUCKET)
      .createSignedUrl(mediaPath, expiresInSec);
    if (error) throw error;
    return data?.signedUrl ?? null;
  } catch (e) {
    console.error('[basta] getProofSignedUrl failed:', e);
    throw e;
  }
}

/** The current user's submission for today on this challenge (if any). */
export async function getMyTodaySubmission(challengeId: string): Promise<Submission | null> {
  const c = ctrl();
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return null;
    const { data, error } = await supabase
      .from('submissions')
      .select(COLS)
      .eq('challenge_id', challengeId)
      .eq('author_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
      .abortSignal(c.signal);
    if (error) throw error;
    const rows = data ?? [];
    return rows.length ? toSubmission(rows[0] as SubmissionRow) : null;
  } catch (e) {
    console.error('[basta] getMyTodaySubmission failed:', e);
    throw e;
  }
}
