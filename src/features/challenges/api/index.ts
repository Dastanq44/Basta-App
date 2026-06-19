// Challenges API — RPC-first for write ops (same pattern as Phase 1: avoids RLS edge cases).
import { supabase } from '@/shared/lib/supabase';
import type { Challenge, ChallengeStreak, MemberRole, Submission } from '@/entities';
import type { CreateChallengeInput, UpdateChallengeInput } from '../model';

const TIMEOUT_MS = 10_000;
function ctrl(): AbortController {
  const c = new AbortController();
  setTimeout(() => c.abort(new Error('request timed out')), TIMEOUT_MS);
  return c;
}

type ChallengeRow = {
  id: string;
  group_id: string | null;
  creator_id: string;
  title: string;
  category: string;
  mode: 'solo' | 'group';
  start_date: string;
  duration_days: number;
  proof_requirement: string | null;
  verification_threshold: number;
  archived_at: string | null;
  visibility: 'private' | 'public';
};

function toChallenge(r: ChallengeRow): Challenge {
  return {
    id: r.id,
    groupId: r.group_id,
    creatorId: r.creator_id,
    title: r.title,
    category: r.category,
    mode: r.mode,
    startDate: r.start_date,
    durationDays: r.duration_days,
    proofRequirement: r.proof_requirement ?? undefined,
    verificationThreshold: r.verification_threshold,
    archivedAt: r.archived_at ?? undefined,
    isPublic: r.visibility === 'public',
  };
}

const COLUMNS =
  'id, group_id, creator_id, title, category, mode, start_date, duration_days, proof_requirement, verification_threshold, archived_at, visibility';

/** All challenges visible to the current user (participant + visible group challenges; excludes archived). */
export async function listMyChallenges(): Promise<Challenge[]> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .from('challenges')
      .select(COLUMNS)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .abortSignal(c.signal);
    if (error) throw error;
    return (data ?? []).map((r) => toChallenge(r as ChallengeRow));
  } catch (e) {
    console.error('[basta] listMyChallenges failed:', e);
    throw e;
  }
}

export async function getChallenge(id: string): Promise<Challenge> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .from('challenges')
      .select(COLUMNS)
      .eq('id', id)
      .abortSignal(c.signal)
      .single();
    if (error) throw error;
    return toChallenge(data as ChallengeRow);
  } catch (e) {
    console.error('[basta] getChallenge failed:', e);
    throw e;
  }
}

/**
 * The current user's server-authoritative streak on a challenge (computed from verified days).
 * Returns null when the RPC reports the caller has no streak on this challenge — e.g. a true
 * outsider on a challenge they happen to have an id for. Valid viewers (participant or group
 * member of a group challenge) always get a real object, possibly all zeros.
 */
export async function getChallengeStreak(challengeId: string): Promise<ChallengeStreak | null> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('challenge_streak', { p_challenge_id: challengeId })
      .abortSignal(c.signal);
    if (error) throw error;
    if (data == null) return null;
    const d = data as { current: number; longest: number; today_done: boolean };
    return { current: d.current ?? 0, longest: d.longest ?? 0, todayDone: d.today_done ?? false };
  } catch (e) {
    console.error('[basta] getChallengeStreak failed:', e);
    throw e;
  }
}

/** Creator edits the mutable fields on an active challenge via `update_challenge` RPC.
 *  Server enforces creator-only, not-archived, and a duration-shrink guard so submissions
 *  past day N can't be orphaned. */
export async function updateChallenge(
  challengeId: string,
  input: UpdateChallengeInput,
): Promise<void> {
  const c = ctrl();
  try {
    const { error } = await supabase
      .rpc('update_challenge', {
        p_challenge_id: challengeId,
        p_title: input.title,
        p_category: input.category,
        p_duration_days: input.durationDays,
        p_proof_requirement: input.proofRequirement ?? null,
        p_visibility: input.isPublic === undefined ? null : input.isPublic ? 'public' : 'private',
      })
      .abortSignal(c.signal);
    if (error) throw new Error(error.message || 'Could not update challenge');
  } catch (e) {
    console.error('[basta] updateChallenge failed:', e);
    throw e;
  }
}

/** Creator permanently deletes a challenge via the `delete_challenge` RPC. Cascades to its
 *  submissions/participants/verifications/comments/reactions (FK on delete cascade). Irreversible. */
export async function deleteChallenge(challengeId: string): Promise<void> {
  const c = ctrl();
  try {
    const { error } = await supabase
      .rpc('delete_challenge', { p_challenge_id: challengeId })
      .abortSignal(c.signal);
    if (error) throw new Error(error.message || 'Could not delete challenge');
  } catch (e) {
    console.error('[basta] deleteChallenge failed:', e);
    throw e;
  }
}

export async function createChallenge(input: CreateChallengeInput): Promise<string> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('create_challenge', {
        p_group_id: input.mode === 'group' ? (input.groupId ?? null) : null,
        p_title: input.title,
        p_category: input.category,
        p_mode: input.mode,
        p_start_date: input.startDate,
        p_duration_days: input.durationDays,
        p_proof_requirement: input.proofRequirement ?? null,
        p_visibility: input.isPublic ? 'public' : 'private',
      })
      .abortSignal(c.signal);
    if (error) throw new Error(error.message || 'Could not create challenge');
    return data as string;
  } catch (e) {
    console.error('[basta] createChallenge failed:', e);
    throw e;
  }
}

// ── Public-preview access (get_challenge_access) ─────────────────────────────

export type ChallengeAccessMode = 'member' | 'public';

/** Whether + how the viewer can open a challenge (full member detail vs read-only public preview),
 *  with the safe fields + action flags. Null when neither access mode applies. */
export type ChallengeAccess = {
  id: string;
  groupId: string | null;
  creatorId: string;
  title: string;
  category: string;
  mode: 'solo' | 'group';
  startDate: string;
  durationDays: number;
  proofRequirement?: string;
  isPublic: boolean;
  archivedAt?: string;
  groupName?: string;
  groupIsPublic?: boolean;
  viewerIsParticipant: boolean;
  viewerIsCreator: boolean;
  viewerGroupRole?: MemberRole;
  accessMode: ChallengeAccessMode;
  canSubmit: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canReport: boolean;
};

type ChallengeAccessRow = {
  id: string;
  group_id: string | null;
  creator_id: string;
  title: string;
  category: string;
  mode: 'solo' | 'group';
  start_date: string;
  duration_days: number;
  proof_requirement: string | null;
  visibility: 'private' | 'public';
  archived_at: string | null;
  group_name: string | null;
  group_visibility: 'private' | 'public' | null;
  viewer_is_participant: boolean;
  viewer_is_creator: boolean;
  viewer_group_role: MemberRole | null;
  access_mode: ChallengeAccessMode;
  can_submit: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_report: boolean;
};

export async function getChallengeAccess(challengeId: string): Promise<ChallengeAccess | null> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('get_challenge_access', { p_challenge_id: challengeId })
      .abortSignal(c.signal);
    if (error) throw error;
    const r = ((data ?? []) as ChallengeAccessRow[])[0];
    if (!r) return null;
    return {
      id: r.id,
      groupId: r.group_id,
      creatorId: r.creator_id,
      title: r.title,
      category: r.category,
      mode: r.mode,
      startDate: r.start_date,
      durationDays: r.duration_days,
      proofRequirement: r.proof_requirement ?? undefined,
      isPublic: r.visibility === 'public',
      archivedAt: r.archived_at ?? undefined,
      groupName: r.group_name ?? undefined,
      groupIsPublic: r.group_visibility ? r.group_visibility === 'public' : undefined,
      viewerIsParticipant: !!r.viewer_is_participant,
      viewerIsCreator: !!r.viewer_is_creator,
      viewerGroupRole: r.viewer_group_role ?? undefined,
      accessMode: r.access_mode,
      canSubmit: !!r.can_submit,
      canEdit: !!r.can_edit,
      canDelete: !!r.can_delete,
      canReport: !!r.can_report,
    };
  } catch (e) {
    console.error('[basta] getChallengeAccess failed:', e);
    throw e;
  }
}

type PublicSubmissionRow = {
  id: string;
  challenge_id: string;
  author_id: string;
  challenge_day: number;
  title: string;
  comment: string | null;
  media_path: string | null;
  status: Submission['status'];
  created_at: string;
  author_username: string | null;
  author_display_name: string | null;
  challenge_title?: string | null;
  reaction_count: number;
  comment_count: number;
};

function toPublicSubmission(r: PublicSubmissionRow): Submission {
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
    authorUsername: r.author_username ?? undefined,
    authorDisplayName: r.author_display_name ?? undefined,
    challengeTitle: r.challenge_title ?? undefined,
    reactionCount: r.reaction_count ?? 0,
    commentCount: r.comment_count ?? 0,
  };
}

/** Public-preview submissions for a challenge (globally-visible verified ones for non-participants). */
export async function listPublicChallengeSubmissions(challengeId: string, limit = 20): Promise<Submission[]> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('list_public_challenge_submissions', { p_challenge_id: challengeId, p_limit: limit })
      .abortSignal(c.signal);
    if (error) throw error;
    return ((data ?? []) as PublicSubmissionRow[]).map(toPublicSubmission);
  } catch (e) {
    console.error('[basta] listPublicChallengeSubmissions failed:', e);
    throw e;
  }
}

export { toPublicSubmission };
export type { PublicSubmissionRow };
