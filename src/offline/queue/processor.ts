// Durable mutation/upload queue processor (D-004 critical path).
//
// One processor at a time (per app instance). Wakes on:
//   - NetInfo connectivity-regained events
//   - AppState foregrounded
//   - explicit kick() from feature code right after enqueue
//
// Per job:
//   1. mark `uploading`
//   2. upload media → Storage (SECURITY-DEFINER RPC then receives `media_path`)
//   3. call `submit_proof` RPC. Idempotent: a previous successful run that lost its ack
//      returns `{ already_submitted: true }`, mapped to a clean drop.
//   4. on success → remove from queue (the server is now the source of truth)
//   5. on failure → exponential backoff with jitter; after MAX_ATTEMPTS → `failed`
//      (manual retry only — drafts are NEVER auto-discarded).
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '@/shared/lib/supabase';
import { uploadProofMedia } from '@/offline/upload';
import type { SubmitProofPayload } from './types';
import { due, reschedule, remove, setStatus } from './store';

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 5 * 60_000;
const MAX_ATTEMPTS = 8;

export function backoffDelayMs(attempts: number): number {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempts);
  return exp + Math.random() * 1_000; // jitter to avoid thundering herd
}

let running = false;
let stopped = false;
let netUnsub: (() => void) | null = null;
let appStateSub: { remove: () => void } | null = null;

/** Public: kick the processor once. Safe to call from anywhere; coalesced internally. */
export async function kick(): Promise<void> {
  if (running || stopped) return;
  running = true;
  try {
    const { isConnected } = await NetInfo.fetch();
    if (!isConnected) return;

    const jobs = await due(Date.now());
    for (const job of jobs) {
      try {
        if (job.type === 'SUBMIT_PROOF') {
          await handleSubmitProof(job.id, job.payload as SubmitProofPayload);
        } else {
          // No other types in Phase 2 — defensive: mark failed so it doesn't loop silently.
          await setStatus(job.id, 'failed', `unknown queue type: ${job.type}`);
        }
      } catch (e) {
        await onJobError(job.id, job.attempts, e);
        // Don't break — give the next job a chance.
      }
    }
  } finally {
    running = false;
  }
}

async function handleSubmitProof(jobId: string, payload: SubmitProofPayload): Promise<void> {
  await setStatus(jobId, 'uploading');

  // 1) Upload media to Storage.
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('Not signed in');

  const { remotePath } = await uploadProofMedia({
    userId: uid,
    challengeId: payload.challengeId,
    submissionId: payload.submissionId,
    localUri: payload.mediaLocalUri,
  });

  // 2) Call the RPC. Idempotent server-side.
  // Title-missing fallback: jobs queued before W-034 don't carry a title; substitute
  // "Untitled" so the upgrade-window job still goes through (server enforces 1..80 chars).
  const fallbackTitle = ((payload.title as string | undefined) ?? '').trim() || 'Untitled';
  const { error } = await supabase.rpc('submit_proof', {
    p_submission_id: payload.submissionId,
    p_challenge_id: payload.challengeId,
    p_title: fallbackTitle,
    p_media_path: remotePath,
    p_comment: payload.comment ?? null,
  });
  if (error) {
    // Special-case the "already submitted" unique-violation (mapped to a server exception by
    // the RPC's own check; if the RPC itself returned the existing row this branch won't run).
    const msg = error.message || '';
    if (/already submitted|unique/i.test(msg)) {
      // Treat as success.
      await remove(jobId);
      return;
    }
    throw error;
  }

  // 3) Done — server owns the submission now. Drop the local job.
  await remove(jobId);
}

async function onJobError(jobId: string, attempts: number, err: unknown): Promise<void> {
  const next = attempts + 1;
  const message = err instanceof Error ? err.message : String(err);
  console.error('[basta] queue job failed:', jobId, message);
  if (next >= MAX_ATTEMPTS) {
    await setStatus(jobId, 'failed', message);
    return;
  }
  await reschedule(jobId, next, Date.now() + backoffDelayMs(attempts), message);
}

/** Wire the processor to NetInfo + AppState. Call ONCE from the root layout on mount. */
export function startProcessor(): () => void {
  stopped = false;

  // 1) Connectivity events.
  netUnsub = NetInfo.addEventListener((s) => {
    if (s.isConnected) {
      void kick();
    }
  });

  // 2) App foregrounded.
  appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') void kick();
  });

  // 3) Initial pass once we have a chance to mount.
  void kick();

  return () => {
    stopped = true;
    netUnsub?.();
    netUnsub = null;
    appStateSub?.remove();
    appStateSub = null;
  };
}
