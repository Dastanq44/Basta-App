// Durable mutation/upload queue — type contracts only (skeleton).
// The offline drafts + upload queue is the MVP critical path (DECISIONS.md D-004).
// Storage engine is intentionally abstracted (D-007 PENDING — WatermelonDB vs SQLite+MMKV).

// SyncStatus is a domain concept and lives in entities; infra imports it from there.
import type { SyncStatus } from '@/entities';

export type { SyncStatus };

export type MutationType = 'SUBMIT_PROOF' | 'CREATE_CHALLENGE' | 'POST_COMMENT' | 'ADD_REACTION';

export type QueuedMutation<TPayload = unknown> = {
  /** Client-generated UUID. Also the idempotency key — retries must not double-submit (D-004). */
  id: string;
  type: MutationType;
  payload: TPayload;
  status: SyncStatus;
  attempts: number;
  /** Epoch ms; the processor only picks up jobs whose nextAttemptAt <= now. */
  nextAttemptAt: number;
  createdAt: number;
};

/** Persistence-agnostic queue store. Implemented once D-007 is settled. */
export interface QueueStore {
  enqueue(mutation: Omit<QueuedMutation, 'status' | 'attempts' | 'nextAttemptAt' | 'createdAt'>): Promise<void>;
  due(now: number): Promise<QueuedMutation[]>;
  reschedule(id: string, attempts: number, nextAttemptAt: number): Promise<void>;
  setStatus(id: string, status: SyncStatus): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Exponential backoff with jitter (D-004). */
export function backoffDelay(attempts: number, base = 1_000, max = 5 * 60_000): number {
  const exp = Math.min(max, base * 2 ** attempts);
  return exp + Math.random() * 1_000;
}
