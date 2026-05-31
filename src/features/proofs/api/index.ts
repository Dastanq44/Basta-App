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
