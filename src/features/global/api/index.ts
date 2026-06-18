// Global feed API — read-only via the `list_global_submissions` RPC. The server enforces
// visibility (is_submission_globally_visible); the client NEVER filters for privacy. Global v1 =
// chronological public verified submissions only (no challenge/group/profile discovery, no ranking).
import { supabase } from '@/shared/lib/supabase';
import type { GlobalPost } from '@/entities';

const TIMEOUT_MS = 10_000;
function ctrl(): AbortController {
  const c = new AbortController();
  setTimeout(() => c.abort(new Error('request timed out')), TIMEOUT_MS);
  return c;
}

type GlobalRow = {
  id: string;
  challenge_id: string;
  author_id: string;
  title: string;
  comment: string | null;
  media_path: string | null;
  created_at: string;
  challenge_day: number;
  author_username: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  challenge_title: string;
  challenge_category: string;
  group_id: string | null;
  group_name: string | null;
  reaction_count: number;
  comment_count: number;
};

function toGlobalPost(r: GlobalRow): GlobalPost {
  return {
    id: r.id,
    challengeId: r.challenge_id,
    authorId: r.author_id,
    title: r.title,
    comment: r.comment ?? undefined,
    mediaPath: r.media_path ?? undefined,
    createdAt: r.created_at,
    challengeDay: r.challenge_day,
    authorUsername: r.author_username ?? undefined,
    authorDisplayName: r.author_display_name ?? undefined,
    authorAvatarPath: r.author_avatar_url ?? undefined,
    challengeTitle: r.challenge_title,
    challengeCategory: r.challenge_category,
    groupId: r.group_id ?? undefined,
    groupName: r.group_name ?? undefined,
    reactionCount: r.reaction_count ?? 0,
    commentCount: r.comment_count ?? 0,
  };
}

export const GLOBAL_FEED_PAGE_SIZE = 20;

/** One chronological page of public verified submissions. `before` is the `createdAt` of the last
 *  item from the previous page (cursor); omit for the first page. */
export async function listGlobalSubmissions(
  before?: string,
  limit = GLOBAL_FEED_PAGE_SIZE,
): Promise<GlobalPost[]> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('list_global_submissions', { p_limit: limit, p_before: before ?? null })
      .abortSignal(c.signal);
    if (error) throw error;
    return ((data ?? []) as GlobalRow[]).map(toGlobalPost);
  } catch (e) {
    console.error('[basta] listGlobalSubmissions failed:', e);
    throw e;
  }
}
