# Offline & Sync Reference

The single most important subsystem in a social/proof app. If this is wrong, users
lose content and trust. Design it before features that depend on it.

## Local storage choices

- **Structured/relational, large lists** → SQLite via WatermelonDB (RN) or Drift
  (Flutter). Lazy-loads, scales to thousands of rows in a feed.
- **Small key/value, flags, cursors** → MMKV (synchronous, fast). Don't put auth
  tokens here — use secure storage.
- **Captured media** → copy to the app sandbox immediately on capture; store the
  local URI in the draft row. Never rely on a temp cache path surviving.

## The durable mutation queue

Every write becomes a persisted `QueuedMutation`:

```
{ id, type, payload, status, attempts, nextAttemptAt, idempotencyKey }
```

- **One processor**, woken by: connectivity regained, app foreground, and a
  background task (expo-task-manager / WorkManager / BGTaskScheduler).
- **FIFO per entity.** A failing job reschedules itself but must not block other
  entities' jobs.
- **Idempotency key = client-generated UUID**, sent with the RPC, so a retry after
  a dropped response doesn't double-submit.
- Media-bearing jobs upload media FIRST (resumable), then call the RPC with the
  resulting storage path.

## Resumable upload (tus)

Use the tus protocol for any media beyond a thumbnail. A 90%-uploaded video must
resume from 90% after a dropped connection, not restart. Supabase Storage supports
resumable uploads; configure chunk size for mobile networks. Show upload progress
from the queue, not from a per-screen state that dies on navigation.

## Backoff

```
delay = min(maxDelay, base * 2^attempts) + jitter   // jitter avoids thundering herd
```

After N attempts (e.g. 8) → `failed`, surfaced with a manual Retry on the item.
Drafts are NEVER auto-discarded.

## Sync state machine

`draft → uploading → pending_verification → verified | rejected`
orthogonal transport: `failed → offline_retry`.

Client owns `draft → uploading`. Server owns `pending_verification →
verified/rejected`. Render a sync badge from this so the user always knows where
their content stands.

## Conflict resolution

- **Scored/social state** (streaks, leaderboards, verification): **server wins,
  always.** Render optimistic "pending", then reconcile to the server value on the
  next read. No client-side merge — there's nothing to merge, the server is truth.
- **Append-only** data (comments): no real conflict; last-write-wins is fine.
- **Uniqueness collisions** (e.g. "already submitted today",
  `unique(challenge,user,day)`): map the unique-violation error code to a success
  state, drop the queue job, don't retry forever.

## Read sync

TanStack Query with per-resource `staleTime`; realtime channels invalidate the
relevant queries on server events. Persist the query cache (or the DB mirror) so
the app opens populated offline.

## What to test (this subsystem specifically)

Backoff increments on transient failure; idempotency prevents dupes; unique-
violation is treated as success and the job is dropped; partial upload resumes;
and an end-to-end "airplane-mode submit → reconnect → reconciles" flow. That E2E is
the product's whole promise — it must exist.
