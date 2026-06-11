// Social API — reactions + short comments on submissions. Writes via RPC (participant-gated);
// reads are direct SELECTs (RLS limits them to challenge participants).
import { supabase } from '@/shared/lib/supabase';
import type { CommentLiker, SubmissionComment } from '@/entities';
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

type ReactionReactorRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  reacted_at: string;
};

export type ReactionReactor = {
  userId: string;
  username?: string;
  displayName?: string;
  reactedAt: string;
};

/** Users who reacted with a given emoji — for the long-press popover (W-036). */
export async function listReactionReactors(
  submissionId: string,
  emoji: string,
): Promise<ReactionReactor[]> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('list_submission_reactors', {
        p_submission_id: submissionId,
        p_emoji: emoji,
      })
      .abortSignal(c.signal);
    if (error) throw error;
    return ((data ?? []) as ReactionReactorRow[]).map((r) => ({
      userId: r.user_id,
      username: r.username ?? undefined,
      displayName: r.display_name ?? undefined,
      reactedAt: r.reacted_at,
    }));
  } catch (e) {
    console.error('[basta] listReactionReactors failed:', e);
    throw e;
  }
}

// ---------- Comments ----------

type CommentRow = {
  id: string;
  submission_id: string;
  author_id: string;
  author_username: string | null;
  author_display_name: string | null;
  body: string;
  created_at: string;
  likes_count: number;
  liked_by_me: boolean;
};

function toComment(r: CommentRow): SubmissionComment {
  const displayName = r.author_display_name ?? undefined;
  const username = r.author_username ?? undefined;
  return {
    id: r.id,
    submissionId: r.submission_id,
    authorId: r.author_id,
    authorUsername: username,
    authorDisplayName: displayName,
    authorName: displayName ?? (username ? `@${username}` : undefined),
    body: r.body,
    createdAt: r.created_at,
    likesCount: r.likes_count ?? 0,
    likedByMe: !!r.liked_by_me,
  };
}

/** Comments on a submission, oldest first, with author + like aggregate (W-035 RPC). */
export async function getComments(submissionId: string): Promise<SubmissionComment[]> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('list_submission_comments', { p_submission_id: submissionId })
      .abortSignal(c.signal);
    if (error) throw error;
    return ((data ?? []) as CommentRow[]).map(toComment);
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

// ---------- Comment likes (W-035) ----------

/** Toggle the current user's like on a comment. Optimistic-friendly. */
export async function setCommentLike(commentId: string, liked: boolean): Promise<void> {
  const c = ctrl();
  try {
    const fn = liked ? 'like_comment' : 'unlike_comment';
    const { error } = await supabase
      .rpc(fn, { p_comment_id: commentId })
      .abortSignal(c.signal);
    if (error) throw new Error(error.message || 'Could not update like');
  } catch (e) {
    console.error('[basta] setCommentLike failed:', e);
    throw e;
  }
}

type CommentLikerRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  liked_at: string;
};

/** Users who liked a given comment (for the long-press popover). */
export async function listCommentLikers(commentId: string): Promise<CommentLiker[]> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('list_comment_likers', { p_comment_id: commentId })
      .abortSignal(c.signal);
    if (error) throw error;
    return ((data ?? []) as CommentLikerRow[]).map((r) => ({
      userId: r.user_id,
      username: r.username ?? undefined,
      displayName: r.display_name ?? undefined,
      likedAt: r.liked_at,
    }));
  } catch (e) {
    console.error('[basta] listCommentLikers failed:', e);
    throw e;
  }
}
