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
  verified_count: number | string;
};

/** Ranked members of a group by verified-proof count (server-ordered; rank assigned here). */
export async function getGroupLeaderboard(groupId: string): Promise<LeaderboardEntry[]> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('group_leaderboard', { p_group_id: groupId })
      .abortSignal(c.signal);
    if (error) throw error;
    return ((data ?? []) as LeaderboardRow[]).map((r, i) => ({
      userId: r.user_id,
      username: r.username ?? undefined,
      displayName: r.display_name ?? undefined,
      verifiedCount: Number(r.verified_count) || 0,
      rank: i + 1,
    }));
  } catch (e) {
    console.error('[basta] getGroupLeaderboard failed:', e);
    throw e;
  }
}
