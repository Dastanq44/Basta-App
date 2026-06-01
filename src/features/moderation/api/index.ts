// Moderation API — RPC-first per the project convention (B-006/B-008/D-009 pattern).
// Direct INSERT/UPDATE on the trust/safety tables is intentionally NOT granted;
// these wrappers go through SECURITY DEFINER RPCs only.
import { supabase } from '@/shared/lib/supabase';
import type { Block } from '@/entities';
import type { ReportInput } from '../model';

const TIMEOUT_MS = 10_000;
function ctrl(): AbortController {
  const c = new AbortController();
  setTimeout(() => c.abort(new Error('request timed out')), TIMEOUT_MS);
  return c;
}

/** Submit a report against a target. Returns the new report id. */
export async function reportTarget(input: ReportInput): Promise<string> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('report_target', {
        p_target_type: input.targetType,
        p_target_id: input.targetId,
        p_reason: input.reason,
        p_details: input.details ?? null,
      })
      .abortSignal(c.signal);
    if (error) throw new Error(error.message || 'Could not submit report');
    return data as string;
  } catch (e) {
    console.error('[basta] reportTarget failed:', e);
    throw e;
  }
}

/** Block a user. Idempotent server-side. */
export async function blockUser(userId: string): Promise<void> {
  const c = ctrl();
  try {
    const { error } = await supabase
      .rpc('block_user', { p_user_id: userId })
      .abortSignal(c.signal);
    if (error) throw new Error(error.message || 'Could not block user');
  } catch (e) {
    console.error('[basta] blockUser failed:', e);
    throw e;
  }
}

/** Unblock a user. No-op if not currently blocked. */
export async function unblockUser(userId: string): Promise<void> {
  const c = ctrl();
  try {
    const { error } = await supabase
      .rpc('unblock_user', { p_user_id: userId })
      .abortSignal(c.signal);
    if (error) throw new Error(error.message || 'Could not unblock user');
  } catch (e) {
    console.error('[basta] unblockUser failed:', e);
    throw e;
  }
}

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

/** Lists users the current viewer has blocked. RLS limits this to own rows. */
export async function listMyBlocks(): Promise<Block[]> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .from('blocks')
      .select('blocker_id, blocked_id, created_at')
      .order('created_at', { ascending: false })
      .abortSignal(c.signal);
    if (error) throw error;
    return (data ?? []).map((r) => {
      const row = r as BlockRow;
      return { blockerId: row.blocker_id, blockedId: row.blocked_id, createdAt: row.created_at };
    });
  } catch (e) {
    console.error('[basta] listMyBlocks failed:', e);
    throw e;
  }
}

/**
 * Request account deletion. Server is idempotent — if a pending request exists, the same
 * `id` is returned (no duplicate row created).
 */
export async function requestAccountDeletion(): Promise<string> {
  const c = ctrl();
  try {
    const { data, error } = await supabase
      .rpc('request_account_deletion')
      .abortSignal(c.signal);
    if (error) throw new Error(error.message || 'Could not request account deletion');
    return data as string;
  } catch (e) {
    console.error('[basta] requestAccountDeletion failed:', e);
    throw e;
  }
}
