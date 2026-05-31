// Local SQLite schema (D-007: Expo SQLite + MMKV; MMKV deferred — Expo Go incompat).
// One physical table for the queue; we'll add more (drafts mirror, server cache mirror) as
// features need them. Keep migrations append-only — never DROP columns in place.

export const DB_NAME = 'basta.db';
/** Bump when schema needs migrating. Increment + add a migration step in `migrations.ts`. */
export const SCHEMA_VERSION = 1;

export const QUEUE_ITEMS_DDL = `
CREATE TABLE IF NOT EXISTS queue_items (
  id              TEXT PRIMARY KEY,        -- client UUID (also the idempotency key)
  type            TEXT NOT NULL,           -- e.g. 'SUBMIT_PROOF'
  payload         TEXT NOT NULL,           -- JSON-encoded
  status          TEXT NOT NULL,           -- SyncStatus
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,        -- epoch ms
  last_error      TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_queue_status_next ON queue_items(status, next_attempt_at);
`;
