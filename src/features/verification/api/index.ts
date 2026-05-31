// Verification API — RPC-first (same pattern as challenges/groups). The server enforces who may
// verify and owns the verified/rejected transition (D-003); the client only requests a vote.
import { supabase } from '@/shared/lib/supabase';
import type { ServerSubmissionStatus, VerificationResult } from '@/entities';

const TIMEOUT_MS = 10_000;
function ctrl(): AbortController {
  const c = new AbortController();
  setTimeout(() => c.abort(new Error('request timed out')), TIMEOUT_MS);
  return c;
}

/**
 * Records the current user's verify/reject vote on a submission and returns the resulting
 * server-side status. Throws (with the Supabase message) if the user may not verify — e.g. it's
 * their own proof or they aren't a participant.
 */
export async function verifySubmission(
  submissionId: string,
  result: VerificationResult,
): Promise<ServerSubmissionStatus> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('verify_submission', { p_submission_id: submissionId, p_result: result })
      .abortSignal(c.signal);
    if (error) throw new Error(error.message || 'Could not record verification');
    return (data as { status: ServerSubmissionStatus }).status;
  } catch (e) {
    console.error('[basta] verifySubmission failed:', e);
    throw e;
  }
}
