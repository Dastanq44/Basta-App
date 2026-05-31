// Social API — reactions + short comments on submissions. Writes via RPC (participant-gated);
// reads are direct SELECTs (RLS limits them to challenge participants).
import { supabase } from '@/shared/lib/supabase';
import type { SubmissionComment } from '@/entities';
import type { ReactionSummary } from '../model';

const TIMEOUT_MS = 10_000;
function ctrl(): AbortController {
  const c = new AbortController();
  setTimeout(() => c.abort(new Error('request timed out')), TIMEOUT_MS);
  return c;
}

// ---------- Reactions ----------

/** Aggregated reaction summary for a submission (counts per emoji + the caller's own choice). */
export async function getReactions(submissionId: string): Promise<ReactionSummary> {
  const c = ctrl();
  try {
    const [{ data: auth }, { data, error }] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from('submission_reactions')
        .select('user_id, emoji')
        .eq('submission_id', submissionId)
        .abortSignal(c.signal),
    ]);
    if (error) throw error;
    const uid = auth.user?.id;
    const counts: Record<string, number> = {};
    let mine: string | undefined;
    for (const row of (data ?? []) as { user_id: string; emoji: string }[]) {
      counts[row.emoji] = (counts[row.emoji] ?? 0) + 1;
      if (row.user_id === uid) mine = row.emoji;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { counts, total, mine };
  } catch (e) {
    console.error('[basta] getReactions failed:', e);
    throw e;
  }
}

/** Set (or, with `emoji = null`, clear) the current user's reaction on a submission. */
export async function reactToSubmission(submissionId: string, emoji: string | null): Promise<void> {
  const c = ctrl();
  try {
    const { error } = await supabase
      .rpc('react_to_submission', { p_submission_id: submissionId, p_emoji: emoji })
      .abortSignal(c.signal);
    if (error) throw new Error(error.message || 'Could not react');
  } catch (e) {
    console.error('[basta] reactToSubmission failed:', e);
    throw e;
  }
}

// ---------- Comments ----------

type CommentRow = {
  id: string;
  submission_id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles: { username: string | null; display_name: string | null } | null;
};

function toComment(r: CommentRow): SubmissionComment {
  return {
    id: r.id,
    submissionId: r.submission_id,
    authorId: r.author_id,
    authorName: r.profiles?.display_name ?? r.profiles?.username ?? undefined,
    body: r.body,
    createdAt: r.created_at,
  };
}

/** Comments on a submission, oldest first, with author display name resolved. */
export async function getComments(submissionId: string): Promise<SubmissionComment[]> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .from('submission_comments')
      .select('id, submission_id, author_id, body, created_at, profiles(username, display_name)')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true })
      .abortSignal(c.signal);
    if (error) throw error;
    return ((data ?? []) as unknown as CommentRow[]).map(toComment);
  } catch (e) {
    console.error('[basta] getComments failed:', e);
    throw e;
  }
}

/** Add a short comment; returns the new comment id. */
export async function addComment(submissionId: string, body: string): Promise<string> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('add_comment', { p_submission_id: submissionId, p_body: body })
      .abortSignal(c.signal);
    if (error) throw new Error(error.message || 'Could not post comment');
    return (data as { id: string }).id;
  } catch (e) {
    console.error('[basta] addComment failed:', e);
    throw e;
  }
}
