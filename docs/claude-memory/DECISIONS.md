# DECISIONS.md

> **Architecture Decision Record.** These are LOCKED unless the user agrees to change them. Do not
> silently diverge. If you think a decision is wrong, propose a change to the user and, if accepted,
> add a new dated decision that supersedes the old one (mark the old one Superseded — don't delete).

### Format
```
## D-NNN — <title>   [Accepted | Superseded by D-XXX]
Date · Status · Decision · Why · Consequences
```

---

## D-001 — Stack: React Native + Expo + Supabase   [Accepted]
- **Date:** 2026-05-27
- **Decision:** React Native + TypeScript with Expo Development Builds + EAS for the app; Supabase
  (Postgres + Auth + Storage + Edge Functions + pg_cron) for the backend.
- **Why:** End-to-end TypeScript with Supabase-generated DB types collapses the DTO↔model risk;
  EAS Update gives safe OTA hotfixes for an early product; mature media/push/navigation ecosystem;
  fast iteration with a small team. Supabase gives RLS + server-side functions for authoritative
  scoring without standing up a custom server.
- **Consequences:** RN perf needs discipline (memoization, FlashList). Flutter alternative noted
  but not chosen. If chosen instead, Flutter would use Riverpod / Drift / ThemeExtension / GoRouter.

## D-002 — Feature-sliced, layered architecture; thin screens   [Accepted]
- **Date:** 2026-05-27
- **Decision:** `app/` = thin route screens (expo-router). Business logic lives in
  `src/features/<domain>/` (api / hooks / model / ui), with `src/entities/` for domain models and
  DTO→domain mappers, `src/shared/` for the design system + clients, `src/offline/` for db/queue/
  upload, `src/services/` for analytics/notifications/crash, `src/navigation/` for linking + guards.
- **Why:** Prevents god components and mega-stores; keeps files focused and reasoning reliable;
  enforces clear boundaries between UI, domain, and data.
- **Consequences:** Enforce import boundaries with ESLint (`import/no-restricted-paths`). Screens
  never import raw DB row types — only domain entities.

## D-003 — Server-authoritative scoring   [Accepted]
- **Date:** 2026-05-27
- **Decision:** Streaks, leaderboards, verification results, and day-boundary math are computed and
  stored on the server (Postgres functions + pg_cron). The day boundary uses the **user's stored
  timezone**, not UTC. The client is authoritative ONLY for drafts and the offline upload queue
  until the server acknowledges.
- **Why:** Clients lie, clocks drift, users reinstall. A client-authored streak is a cheat surface
  and causes cross-device inconsistency.
- **Consequences:** Client renders optimistic "pending" states, then reconciles to server values.
  No client-side merge of scored state — server wins, always.

## D-004 — Offline-first with a durable mutation/upload queue   [Accepted]
- **Date:** 2026-05-27
- **Decision:** Proof drafts + captured media are saved to the app sandbox at capture time, before
  any network attempt. Writes flow through a durable, persisted mutation queue with exponential
  backoff + jitter and client UUID idempotency keys. This offline drafts + upload queue is the
  **MVP critical path.** _(The specific local persistence engine and the upload mechanism are
  separate decisions — see D-007 and D-008; this decision no longer hard-commits WatermelonDB or
  tus.)_
- **Why:** Users capture proof in elevators/tunnels. We must never lose user-generated content to
  connectivity, and retries must not double-submit.
- **Consequences:** A unique constraint `(challenge, user, day)` guards double submission; the
  unique-violation error is treated as success and the queue job is dropped.

## D-007 — Local persistence engine: Expo SQLite + MMKV   [Accepted]
- **Date:** 2026-05-27 (settled before Phase 1)
- **Decision:** Use **`expo-sqlite` for relational/structured local data** (drafts, queued
  mutations, cached lists) and **MMKV for key/value** (flags, cursors, lightweight prefs). This is
  the MVP local persistence engine.
- **Why:** MVP list sizes are bounded (≤50 members/group, per-challenge feeds), so we don't need a
  reactive ORM. `expo-sqlite` is first-party (no extra native-config burden under Expo), gives full
  SQL control, and keeps the dependency surface small; MMKV is synchronous and fast for KV. Fewer
  moving parts = less to get wrong on the critical path.
- **WatermelonDB is DEFERRED**, not rejected. Revisit it only if offline **relational sync** gets
  materially more complex — e.g. large/unbounded lists needing lazy loading, reactive observable
  queries driving the UI, or multi-table sync/migration churn that hand-rolled SQL makes painful.
  The `src/offline/db` layer is kept behind an engine-agnostic interface (see `LocalDatabase`), so
  swapping to WatermelonDB later would not touch feature/data callers.
- **Consequences:** Add `expo-sqlite` + an MMKV package in Phase 2 when the queue/draft store is
  implemented (not now — this is a decision, not an implementation). Auth tokens still go in
  `expo-secure-store`, never SQLite/MMKV (W-005).

## D-008 — Media upload: standard Supabase Storage first, tus/resumable deferred   [Accepted]
- **Date:** 2026-05-27
- **Decision:** Use **standard Supabase Storage upload** for MVP photo proof. **Defer
  tus/resumable uploads** until video proof (larger files on flaky networks) actually needs them.
- **Why:** Photos are small; resumable adds client setup + server config complexity not justified
  by the photo-first MVP scope.
- **Consequences:** The upload layer (`src/offline/upload`) is abstracted behind the queue so the
  implementation can be swapped to tus later without touching feature code.

## D-005 — Mobile-first UI; shadcn as a mindset, not a runtime dep   [Accepted]
- **Date:** 2026-05-27
- **Decision:** Native, thumb-friendly, accessible UI. Adopt the shadcn *philosophy* (open code,
  semantic design tokens in background/foreground pairs, a variant API, light/dark via token
  override) implemented natively — NOT shadcn/ui the web library as a runtime dependency.
- **Why:** shadcn renders to the DOM and can't run in RN; the mindset (owned, composable, token-
  driven components) is what's valuable and ports cleanly.
- **Consequences:** Either NativeWind + react-native-reusables, or a hand-rolled token module +
  cva-style variant helper. Accessibility (≥44pt targets, labels, focus rings) is built into the
  primitives, not added later.

## D-009 — Verification model: threshold-approve / single-reject; solo auto-verifies   [Accepted]
- **Date:** 2026-05-31 (Phase 3, T-040; user-confirmed both forks)
- **Decision:**
  - **Group challenges:** a proof becomes `verified` once its **approve** votes reach the
    challenge's `verification_threshold` (default 1); **any single `reject`** flips it to
    `rejected`. Votes are recorded in a `verifications` table, one (re-votable) row per verifier,
    and the `verify_submission` SECURITY DEFINER RPC recomputes status after every vote.
  - **Verifier eligibility:** must be a **challenge participant** and **not the author**
    (no self-verify). Enforced server-side in the RPC.
  - **Solo challenges:** have no friend to verify, so `submit_proof` **auto-verifies** solo
    submissions on submit (`status='verified'` immediately). The verification feature is therefore
    a group-only concern.
- **Why:** Matches the existing `verification_threshold` column and the "a friend verifies" MVP
  model; single-reject gives any participant a veto, which is the simplest honest MVP rule. Solo
  auto-verify keeps solo streaks (T-042) from being permanently blocked by a verifier who can't
  exist.
- **Consequences:** T-042 (streak fn) can treat `status='verified'` uniformly for solo and group.
  If later we want multi-reject tolerance or solo self-attestation UX, revisit here. Storage SELECT
  RLS was widened so co-participants (verifiers) can view each other's proof media.

## D-006 — MVP scope guardrails   [Accepted]
- **Date:** 2026-05-27
- **Decision:** Build only the MVP scope in `PROJECT_BRIEF.md`. Do NOT build AI verification,
  Explore feed, global leaderboards, full chat, health integrations, XP/badges/duels, widgets, or
  monetization. Architecture may leave thin placeholders (e.g. a `verification_source` column).
- **Why:** Ship the accountability loop first; avoid scope creep that delays a usable product.
- **Consequences:** Reviewers should push back on PRs that implement excluded features.
