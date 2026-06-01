// Challenges API — RPC-first for write ops (same pattern as Phase 1: avoids RLS edge cases).
import { supabase } from '@/shared/lib/supabase';
import type { Challenge, ChallengeStreak } from '@/entities';
import type { CreateChallengeInput } from '../model';

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
  };
}

const COLUMNS =
  'id, group_id, creator_id, title, category, mode, start_date, duration_days, proof_requirement, verification_threshold, archived_at';

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

/** The current user's server-authoritative streak on a challenge (computed from verified days). */
export async function getChallengeStreak(challengeId: string): Promise<ChallengeStreak> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('challenge_streak', { p_challenge_id: challengeId })
      .abortSignal(c.signal);
    if (error) throw error;
    const d = (data ?? {}) as { current: number; longest: number; today_done: boolean };
    return { current: d.current ?? 0, longest: d.longest ?? 0, todayDone: d.today_done ?? false };
  } catch (e) {
    console.error('[basta] getChallengeStreak failed:', e);
    throw e;
  }
}

/** Creator archives a challenge (soft-delete; submissions/streaks preserved). */
export async function archiveChallenge(challengeId: string): Promise<void> {
  const c = ctrl();
  try {
    const { error } = await supabase
      .rpc('archive_challenge', { p_challenge_id: challengeId })
      .abortSignal(c.signal);
    if (error) throw new Error(error.message || 'Could not archive challenge');
  } catch (e) {
    console.error('[basta] archiveChallenge failed:', e);
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
      })
      .abortSignal(c.signal);
    if (error) throw new Error(error.message || 'Could not create challenge');
    return data as string;
  } catch (e) {
    console.error('[basta] createChallenge failed:', e);
    throw e;
  }
}
