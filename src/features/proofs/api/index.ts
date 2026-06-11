// Proofs API — read-side wrappers + the in-place redact RPC. Initial submission WRITES go
// through the offline queue, not direct API calls, because the product must not lose a draft
// to bad connectivity (D-004). Redacts (in-place edits of an already-submitted proof) are
// a direct RPC call — they require connectivity by design (no orphaned drafts to recover).
import { supabase } from '@/shared/lib/supabase';
import type { ContestantStreak, ServerSubmissionStatus, Submission } from '@/entities';

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
  title: string;
  comment: string | null;
  media_path: string | null;
  status: ServerSubmissionStatus;
  verified_at: string | null;
  rejected_at: string | null;
  created_at: string;
};

/** Row shape returned by list_challenge_submissions / get_submission_with_author RPCs. */
type SubmissionWithAuthorRow = SubmissionRow & {
  author_username: string | null;
  author_display_name: string | null;
};

function toSubmission(r: SubmissionRow): Submission {
  return {
    id: r.id,
    challengeId: r.challenge_id,
    authorId: r.author_id,
    challengeDay: r.challenge_day,
    title: r.title,
    comment: r.comment ?? undefined,
    mediaRemotePath: r.media_path ?? undefined,
    status: r.status,
    createdAt: r.created_at,
  };
}

function toSubmissionWithAuthor(r: SubmissionWithAuthorRow): Submission {
  return {
    ...toSubmission(r),
    authorUsername: r.author_username ?? undefined,
    authorDisplayName: r.author_display_name ?? undefined,
  };
}

/**
 * Recent submissions for a challenge — used in the detail screen. Calls the
 * `list_challenge_submissions` SECURITY DEFINER RPC so each row carries the author's
 * username + display_name without widening `profiles` RLS (W-023).
 */
export async function listSubmissionsForChallenge(challengeId: string, limit = 20): Promise<Submission[]> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('list_challenge_submissions', { p_challenge_id: challengeId, p_limit: limit })
      .abortSignal(c.signal);
    if (error) throw error;
    const rows = (data ?? []) as SubmissionWithAuthorRow[];
    return rows.map(toSubmissionWithAuthor);
  } catch (e) {
    console.error('[basta] listSubmissionsForChallenge failed:', e);
    throw e;
  }
}

/**
 * A single submission by id, with the author's username + display_name joined in.
 * Calls the `get_submission_with_author` SECURITY DEFINER RPC. Returns null when the
 * submission doesn't exist; throws on permission / network errors.
 */
export async function getSubmission(submissionId: string): Promise<Submission | null> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('get_submission_with_author', { p_submission_id: submissionId })
      .abortSignal(c.signal);
    if (error) throw error;
    const rows = (data ?? []) as SubmissionWithAuthorRow[];
    const first = rows[0];
    return first ? toSubmissionWithAuthor(first) : null;
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

// PostgREST resource expansion shape. supabase-js v2 has been inconsistent about whether
// many-to-one relations come back as an ARRAY or a single OBJECT depending on the
// schema/version, so we accept either at runtime and normalize in the mapper below.
type EmbedChallenge = {
  title: string | null;
  groups: EmbedGroup | EmbedGroup[] | null;
};
type EmbedGroup = { name: string | null };
type SubmissionWithContextRow = SubmissionRow & {
  challenges: EmbedChallenge | EmbedChallenge[] | null;
};

function pickOne<T>(v: T | T[] | null | undefined): T | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

/** All of the current user's recent submissions across every challenge they participate in.
 *  Used by the Profile tab's Submissions section. `is_challenge_participant`-gated via
 *  the standard `submissions_select_participant` RLS — the author IS always a participant.
 *  Joins the parent challenge's title + (for group challenges) the host group name via
 *  PostgREST resource expansion so the list row can render both without a second fetch. */
export async function listMyRecentSubmissions(limit = 50): Promise<Submission[]> {
  const c = ctrl();
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return [];
    const { data, error } = await supabase
      .from('submissions')
      .select(
        'id, challenge_id, author_id, challenge_day, title, comment, media_path, status, verified_at, rejected_at, created_at, challenges ( title, groups ( name ) )',
      )
      .eq('author_id', uid)
      .order('created_at', { ascending: false })
      .limit(limit)
      .abortSignal(c.signal);
    if (error) throw error;
    return (data ?? []).map((raw) => {
      const r = raw as unknown as SubmissionWithContextRow;
      const base = toSubmission(r);
      const challenge = pickOne(r.challenges);
      const group = pickOne(challenge?.groups);
      return {
        ...base,
        challengeTitle: challenge?.title ?? undefined,
        challengeGroupName: group?.name ?? undefined,
      };
    });
  } catch (e) {
    console.error('[basta] listMyRecentSubmissions failed:', e);
    throw e;
  }
}

/**
 * The current user's submission for today on this challenge (if any). Calls the
 * `get_my_today_submission` SECURITY DEFINER RPC, which computes today's challenge_day
 * server-side in the user's timezone (W-027). Day-rollover correctness matters here:
 * the previous direct-select-latest implementation kept returning yesterday's row
 * after midnight, so the primary button stuck on "Add another (replaces today)".
 */
export async function getMyTodaySubmission(challengeId: string): Promise<Submission | null> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('get_my_today_submission', { p_challenge_id: challengeId })
      .abortSignal(c.signal);
    if (error) throw error;
    const rows = (data ?? []) as SubmissionRow[];
    const first = rows[0];
    return first ? toSubmission(first) : null;
  } catch (e) {
    console.error('[basta] getMyTodaySubmission failed:', e);
    throw e;
  }
}

type ChallengeStreakRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  current_streak: number;
  longest_streak: number;
  today_done: boolean;
};

/**
 * Per-participant streaks on this challenge — powers the "other contestants" ribbon on
 * the challenge detail screen. For group challenges, every group member appears (group
 * membership = participation per T-027). For solo, returns just the caller's row so the
 * client doesn't have to branch on mode for the fetch.
 */
export async function listChallengeStreaks(challengeId: string): Promise<ContestantStreak[]> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('list_challenge_streaks', { p_challenge_id: challengeId })
      .abortSignal(c.signal);
    if (error) throw error;
    const rows = (data ?? []) as ChallengeStreakRow[];
    return rows.map((r) => ({
      userId: r.user_id,
      username: r.username ?? undefined,
      displayName: r.display_name ?? undefined,
      current: r.current_streak,
      longest: r.longest_streak,
      todayDone: r.today_done,
    }));
  } catch (e) {
    console.error('[basta] listChallengeStreaks failed:', e);
    throw e;
  }
}

/**
 * Author-only in-place edit of an existing submission's photo + comment. Server enforces:
 * not-archived, group+verified is locked, solo can only edit same-day. Group edits clear
 * any approve/reject votes (since the proof content changed) and reset status to
 * `pending_verification`. Solo keeps `status='verified'` (auto-verified) — the edit is
 * just a media/comment correction.
 *
 * This is NOT routed through the offline queue. Editing requires connectivity by design:
 * there is no draft to lose, and queuing an edit while offline would race against
 * verifications happening on the prior content.
 */
export async function redactMySubmission(
  submissionId: string,
  title: string,
  mediaPath: string,
  comment: string | undefined,
): Promise<void> {
  const c = ctrl();
  try {
    const { error } = await supabase
      .rpc('redact_my_submission', {
        p_submission_id: submissionId,
        p_title: title,
        p_media_path: mediaPath,
        p_comment: comment ?? null,
      })
      .abortSignal(c.signal);
    if (error) throw new Error(error.message || 'Could not edit submission');
  } catch (e) {
    console.error('[basta] redactMySubmission failed:', e);
    throw e;
  }
}
