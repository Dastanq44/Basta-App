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
- **Decision:** Local SQLite (WatermelonDB) + MMKV for KV. Proof drafts + captured media are saved
  to the app sandbox at capture time, before any network attempt. Writes flow through a durable,
  persisted mutation queue with exponential backoff + jitter and client UUID idempotency keys.
  Media uses **tus** resumable uploads.
- **Why:** Users capture proof in elevators/tunnels. We must never lose user-generated content to
  connectivity, and retries must not double-submit.
- **Consequences:** A unique constraint `(challenge, user, day)` guards double submission; the
  unique-violation error is treated as success and the queue job is dropped.

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

## D-006 — MVP scope guardrails   [Accepted]
- **Date:** 2026-05-27
- **Decision:** Build only the MVP scope in `PROJECT_BRIEF.md`. Do NOT build AI verification,
  Explore feed, global leaderboards, full chat, health integrations, XP/badges/duels, widgets, or
  monetization. Architecture may leave thin placeholders (e.g. a `verification_source` column).
- **Why:** Ship the accountability loop first; avoid scope creep that delays a usable product.
- **Consequences:** Reviewers should push back on PRs that implement excluded features.
