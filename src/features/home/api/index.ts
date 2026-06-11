// Home feature API — thin wrappers over the get_home_overview / list_pending_verifications RPCs.
import { supabase } from '@/shared/lib/supabase';

export type HomeOverview = {
  currentStreak: number;
  weekActiveDays: number;
  todayTotal: number;
  todayDone: number;
  pendingVerifications: number;
};

export type PendingVerification = {
  submissionId: string;
  challengeId: string;
  challengeTitle: string;
  authorId: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
  challengeDay: number;
  createdAt: string;
};

/** One round-trip summary for the Home tab. Server-authoritative (D-003). */
export async function getHomeOverview(): Promise<HomeOverview> {
  const { data, error } = await supabase.rpc('get_home_overview');
  if (error) throw error;
  const d = (data ?? {}) as Record<string, number>;
  return {
    currentStreak: d.current_streak ?? 0,
    weekActiveDays: d.week_active_days ?? 0,
    todayTotal: d.today_total ?? 0,
    todayDone: d.today_done ?? 0,
    pendingVerifications: d.pending_verifications ?? 0,
  };
}

type PendingRow = {
  submission_id: string;
  challenge_id: string;
  challenge_title: string;
  author_id: string;
  author_username: string | null;
  author_display_name: string | null;
  challenge_day: number;
  created_at: string;
};

export type StreakAggregate = {
  currentStreak: number;
  bestStreak: number;
};

/** Current + best aggregated streaks across all of the caller's challenges (T-053-E). */
export async function getMyStreakAggregate(): Promise<StreakAggregate> {
  const { data, error } = await supabase.rpc('get_my_streak_aggregate');
  if (error) throw error;
  const d = (data ?? {}) as Record<string, number>;
  return {
    currentStreak: d.current_streak ?? 0,
    bestStreak: d.best_streak ?? 0,
  };
}

/** Group proofs awaiting the caller's verification (the "Verify a friend" inbox). */
export async function listPendingVerifications(): Promise<PendingVerification[]> {
  const { data, error } = await supabase.rpc('list_pending_verifications_for_me');
  if (error) throw error;
  return ((data ?? []) as PendingRow[]).map((r) => ({
    submissionId: r.submission_id,
    challengeId: r.challenge_id,
    challengeTitle: r.challenge_title,
    authorId: r.author_id,
    authorUsername: r.author_username,
    authorDisplayName: r.author_display_name,
    challengeDay: r.challenge_day,
    createdAt: r.created_at,
  }));
}
