// Leaderboard API — server-authoritative read via the group_leaderboard RPC (D-003).
import { supabase } from '@/shared/lib/supabase';
import type { LeaderboardEntry } from '@/entities';

const TIMEOUT_MS = 10_000;
function ctrl(): AbortController {
  const c = new AbortController();
  setTimeout(() => c.abort(new Error('request timed out')), TIMEOUT_MS);
  return c;
}

type LeaderboardRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  verified_count: number | string;
};

function toEntries(rows: LeaderboardRow[]): LeaderboardEntry[] {
  return rows.map((r, i) => ({
    userId: r.user_id,
    username: r.username ?? undefined,
    displayName: r.display_name ?? undefined,
    avatarUrl: r.avatar_url ?? undefined,
    verifiedCount: Number(r.verified_count) || 0,
    rank: i + 1,
  }));
}

/** Ranked members of a group by verified-proof count (server-ordered; rank assigned here). */
export async function getGroupLeaderboard(groupId: string): Promise<LeaderboardEntry[]> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('group_leaderboard', { p_group_id: groupId })
      .abortSignal(c.signal);
    if (error) throw error;
    return toEntries((data ?? []) as LeaderboardRow[]);
  } catch (e) {
    console.error('[basta] getGroupLeaderboard failed:', e);
    throw e;
  }
}

/** Same leaderboard, but gated on `get_group_access` (member OR public preview) — for the public
 *  group preview, where the member-only `group_leaderboard` RPC would raise. */
export async function getPublicGroupLeaderboard(groupId: string): Promise<LeaderboardEntry[]> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('list_public_group_leaderboard', { p_group_id: groupId })
      .abortSignal(c.signal);
    if (error) throw error;
    return toEntries((data ?? []) as LeaderboardRow[]);
  } catch (e) {
    console.error('[basta] getPublicGroupLeaderboard failed:', e);
    throw e;
  }
}
