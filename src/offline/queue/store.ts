// Queue store — thin CRUD over the SQLite `queue_items` table. The processor (and feature
// code that creates drafts) call into these; nothing else touches SQL directly.
import { getDb } from '@/offline/db';
import type { SyncStatus } from '@/entities';
import type { MutationType, QueuedMutation } from './types';

type Row = {
  id: string;
  type: string;
  payload: string;
  status: string;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
};

function rowToMutation<T = unknown>(r: Row): QueuedMutation<T> {
  return {
    id: r.id,
    type: r.type as MutationType,
    payload: JSON.parse(r.payload) as T,
    status: r.status as SyncStatus,
    attempts: r.attempts,
    nextAttemptAt: r.next_attempt_at,
    createdAt: r.created_at,
  };
}

export async function enqueue(input: {
  id: string;
  type: MutationType;
  payload: unknown;
  initialStatus?: SyncStatus;
}): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    `INSERT OR IGNORE INTO queue_items
     (id, type, payload, status, attempts, next_attempt_at, last_error, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, NULL, ?, ?)`,
    [
      input.id,
      input.type,
      JSON.stringify(input.payload),
      input.initialStatus ?? 'queued',
      now,
      now,
      now,
    ],
  );
}

/** Items whose nextAttemptAt has elapsed and that are eligible to run (not terminal). */
export async function due<T = unknown>(now: number): Promise<QueuedMutation<T>[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM queue_items
     WHERE next_attempt_at <= ?
       AND status IN ('queued', 'offline_retry')
     ORDER BY created_at ASC`,
    [now],
  );
  return rows.map((r) => rowToMutation<T>(r));
}

/**
 * Recover jobs left in the transient `uploading` state by a previous app session that was
 * killed mid-upload. `due()` only returns `queued`/`offline_retry`, so without this an
 * interrupted upload would be orphaned forever — silently losing the proof (violates D-004).
 * Re-running is safe: the storage path is deterministic (upsert overwrites) and `submit_proof`
 * is idempotent. Call once on processor startup, before the first `kick()`.
 */
export async function recoverInterrupted(now: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE queue_items SET status = 'offline_retry', next_attempt_at = ?, updated_at = ?
     WHERE status = 'uploading'`,
    [now, now],
  );
}

/** Items that need user attention (failed) or are in flight (uploading) — for UI. */
export async function listAll<T = unknown>(): Promise<QueuedMutation<T>[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(`SELECT * FROM queue_items ORDER BY created_at DESC`);
  return rows.map((r) => rowToMutation<T>(r));
}

export async function getById<T = unknown>(id: string): Promise<QueuedMutation<T> | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<Row>(`SELECT * FROM queue_items WHERE id = ?`, [id]);
  return r ? rowToMutation<T>(r) : null;
}

export async function setStatus(id: string, status: SyncStatus, lastError?: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE queue_items SET status = ?, last_error = ?, updated_at = ? WHERE id = ?`,
    [status, lastError ?? null, Date.now(), id],
  );
}

export async function reschedule(id: string, attempts: number, nextAttemptAt: number, lastError?: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE queue_items SET attempts = ?, next_attempt_at = ?, status = 'offline_retry', last_error = ?, updated_at = ? WHERE id = ?`,
    [attempts, nextAttemptAt, lastError ?? null, Date.now(), id],
  );
}

export async function remove(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM queue_items WHERE id = ?`, [id]);
}
