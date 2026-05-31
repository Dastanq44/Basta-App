# Basta — Offline & Sync Strategy

> **Status: PROPOSAL (pre-implementation).** Offline proof drafts + the upload queue are the
> **MVP critical path** (D-004). Never lose a user's proof to bad connectivity.

## Sync state machine

Every submission carries a status:

```
draft → uploading → pending_verification → verified | rejected
                         (transport)  failed → offline_retry
```

- **Client owns** `draft → uploading`.
- **Server owns** `pending_verification → verified | rejected` (D-003).
- A sync badge renders this state everywhere the submission appears.

## Client state split

| Kind | Examples | Tool | Persisted |
|---|---|---|---|
| Server state | challenges, verified submissions, leaderboard | TanStack Query + DB mirror | read mirror |
| Persisted local | drafts, queued mutations, media paths, cursors | local DB + KV (engine TBD — D-007) | **source of truth until acked** |
| Ephemeral UI | modals, form focus, scroll | useState / small Zustand | no |
| Secrets | auth tokens | expo-secure-store | secure only |

## Durable mutation/upload queue

Each write → a persisted record:

```
QueuedMutation { id, type, payload, status, attempts, nextAttemptAt, idempotencyKey }
```

- One processor, woken by: connectivity-regained / app-foreground / background task.
- FIFO per entity; a failing job reschedules without blocking other entities' jobs.
- Media-bearing jobs upload media first, then call the RPC with the resulting storage path.
- **Drafts + captured media are written to the app sandbox at capture time**, before any network
  attempt. A crash or navigation must never lose proof.

## Backoff

```
delay = min(maxDelay, base · 2^attempts) + jitter   // jitter avoids thundering herd
```

After N attempts (e.g. 8) → `failed`, surfaced with a manual Retry. **Drafts are never
auto-discarded.**

## Idempotency & conflict resolution

- The client-generated UUID is both the submission `id` and the idempotency key → retries cannot
  double-submit.
- A `unique(challenge_id, author_id, challenge_day)` violation is mapped to **success**
  ("already submitted today") and the job is dropped — never retried forever.
- **Scored/social state: server wins, always.** Client shows optimistic "pending", then reconciles
  to the server value on next read. No client-side merge of scored state.

## Read sync

TanStack Query with per-resource `staleTime`; realtime channels invalidate the relevant queries on
server events. Persist the cache / DB mirror so the app opens populated offline.

## What must be tested

Backoff increments on transient failure; idempotency prevents dupes; unique-violation treated as
success and dropped; (if/when resumable) partial upload resumes; and an end-to-end
**airplane-mode submit → reconnect → reconciles** flow — the product's core promise.

---

## Implementation (Phase 2 landed)

- **Local DB:** `expo-sqlite` singleton via `src/offline/db/init.ts` → `getDb()` (D-007).
  Single table for now (`queue_items`); schema in `src/offline/db/schema.ts`.
- **MMKV:** **DEFERRED** — not Expo Go compatible (needs a dev build). Documented as W-009 /
  W-012; revisit when we move to a dev build.
- **Queue store:** `src/offline/queue/store.ts` — `enqueue / due / setStatus / reschedule /
  remove / listAll`. Idempotency: queue `id` == submission `id` (client UUID), passed to the
  server `submit_proof` RPC.
- **Processor:** `src/offline/queue/processor.ts` — one-at-a-time per app instance, woken by
  NetInfo `isConnected` and `AppState` foregrounding, plus an explicit `kick()` after enqueue.
  Backoff: `min(maxDelay, base · 2^attempts) + jitter`; max 8 attempts then `failed`.
- **Upload:** `src/offline/upload/storage.ts` — standard Supabase Storage upload (D-008).
  Path convention: `<userId>/<challengeId>/<submissionId>.jpg`. Storage RLS enforces it.
- **Initialization:** `src/offline/index.ts` exposes `initOffline()`. `app/_layout.tsx` calls
  it once on mount — opens the DB, starts the processor, returns a teardown.
- **Server reconciliation:** the processor calls `submit_proof` which is idempotent. On a retry
  whose ack was lost, the RPC returns `{ already_submitted: true }` and the queue removes the
  job cleanly — no double-submit, no infinite retry.

## Decision note — local persistence engine (D-007, ACCEPTED)

**Chosen: `expo-sqlite` (relational/structured) + MMKV (key/value).** Settled before Phase 1.

| | WatermelonDB (deferred) | **Expo SQLite + MMKV (chosen)** |
|---|---|---|
| Model | Reactive ORM over SQLite; observables drive UI | Raw/lightly-wrapped SQL + MMKV for KV |
| Strength | Lazy loading, observability, scales to large lists out of the box | Simpler mental model, fewer deps, full SQL control, first-party under Expo |
| Cost | Heavier dep, schema/migration ceremony, learning curve | You hand-roll reactivity/sync glue |
| Fit for Basta | Good if feeds/leaderboards get large and we want reactive queries | Good for a lean MVP where lists are bounded (≤50/group) |

**Rationale:** MVP lists are bounded, so a reactive ORM isn't needed; the simpler, first-party stack
wins on fewer moving parts along the critical path. **WatermelonDB is deferred, not rejected** —
revisit it only if offline *relational sync* becomes materially more complex (large/unbounded lists
needing lazy loading, reactive observable queries, or multi-table sync/migration churn). The
`offline/db` layer stays behind the engine-agnostic `LocalDatabase` interface so a later swap won't
touch callers. Full decision in DECISIONS.md D-007. (Auth tokens use `expo-secure-store`, never
SQLite/MMKV — W-005.)

## Decision note — media upload approach (D-008)

**Start with standard Supabase Storage upload** (`supabase.storage.from(...).upload(...)`) for MVP
photo proof. **Defer tus / resumable uploads** until video proof (larger files on flaky mobile
networks) actually requires it. Rationale: photos are small; resumable adds setup + server config
complexity that isn't justified for the MVP photo-first scope. The queue/abstraction is designed so
the upload implementation can be swapped without touching feature code.
