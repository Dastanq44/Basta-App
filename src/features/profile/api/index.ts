// Profile API — visibility-aware reads for the redesigned profile (stats + Challenges/Groups tabs).
// All gating is server-side (the RPCs); the client never filters for privacy.
import { supabase } from '@/shared/lib/supabase';
import type { MemberRole } from '@/entities';

const TIMEOUT_MS = 10_000;
function ctrl(): AbortController {
  const c = new AbortController();
  setTimeout(() => c.abort(new Error('request timed out')), TIMEOUT_MS);
  return c;
}

// ── Overview (stats row) ─────────────────────────────────────────────────────

export type ProfileOverview = {
  currentStreak: number;
  bestStreak: number;
  activeChallengeCount: number;
  groupCount: number;
};

type OverviewRow = {
  current_streak: number;
  best_streak: number;
  active_challenge_count: number;
  group_count: number;
};

/** Stats for a profile. Returns null when the profile is private to the viewer (the RPC returns
 *  no row) — the screen then shows "This profile is private". */
export async function getProfileOverview(userId: string): Promise<ProfileOverview | null> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('get_profile_overview', { p_user_id: userId })
      .abortSignal(c.signal);
    if (error) throw error;
    const row = ((data ?? []) as OverviewRow[])[0];
    if (!row) return null;
    return {
      currentStreak: row.current_streak ?? 0,
      bestStreak: row.best_streak ?? 0,
      activeChallengeCount: row.active_challenge_count ?? 0,
      groupCount: row.group_count ?? 0,
    };
  } catch (e) {
    console.error('[basta] getProfileOverview failed:', e);
    throw e;
  }
}

// ── Challenges tab ───────────────────────────────────────────────────────────

export type ProfileChallenge = {
  id: string;
  groupId: string | null;
  title: string;
  category: string;
  mode: 'solo' | 'group';
  startDate: string;
  durationDays: number;
  groupName?: string;
  /** Whether the challenge is visible/public (false = hidden — shown only on own profile). */
  isPublic: boolean;
  /** Whether the VIEWER participates — gates tappability (challenge detail RLS is participant-only). */
  isParticipant: boolean;
};

type ChallengeRow = {
  id: string;
  group_id: string | null;
  title: string;
  category: string;
  mode: 'solo' | 'group';
  start_date: string;
  duration_days: number;
  group_name: string | null;
  visibility: 'private' | 'public';
  is_participant: boolean;
};

export async function listViewableUserChallenges(userId: string, limit = 50): Promise<ProfileChallenge[]> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('list_viewable_user_challenges', { p_user_id: userId, p_limit: limit })
      .abortSignal(c.signal);
    if (error) throw error;
    return ((data ?? []) as ChallengeRow[]).map((r) => ({
      id: r.id,
      groupId: r.group_id,
      title: r.title,
      category: r.category,
      mode: r.mode,
      startDate: r.start_date,
      durationDays: r.duration_days,
      groupName: r.group_name ?? undefined,
      isPublic: r.visibility === 'public',
      isParticipant: !!r.is_participant,
    }));
  } catch (e) {
    console.error('[basta] listViewableUserChallenges failed:', e);
    throw e;
  }
}

// ── Groups tab ───────────────────────────────────────────────────────────────

export type ProfileGroup = {
  id: string;
  name: string;
  description?: string;
  avatarPath?: string;
  isPublic: boolean;
  memberCount: number;
  /** Viewer's role, or undefined if not a member — gates tappability (group detail RLS member-only). */
  viewerRole?: MemberRole;
  /** The profiled user's role in the group. */
  targetRole?: MemberRole;
};

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  avatar_path: string | null;
  visibility: 'private' | 'public';
  member_count: number;
  viewer_role: MemberRole | null;
  target_role: MemberRole | null;
};

export async function listViewableUserGroups(userId: string, limit = 50): Promise<ProfileGroup[]> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('list_viewable_user_groups', { p_user_id: userId, p_limit: limit })
      .abortSignal(c.signal);
    if (error) throw error;
    return ((data ?? []) as GroupRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      avatarPath: r.avatar_path ?? undefined,
      isPublic: r.visibility === 'public',
      memberCount: r.member_count ?? 0,
      viewerRole: r.viewer_role ?? undefined,
      targetRole: r.target_role ?? undefined,
    }));
  } catch (e) {
    console.error('[basta] listViewableUserGroups failed:', e);
    throw e;
  }
}
