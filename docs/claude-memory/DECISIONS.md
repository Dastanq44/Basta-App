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

## D-010 — Streaks are computed-on-read; no pg_cron rollover for MVP   [Accepted]
- **Date:** 2026-05-31 (Phase 3, T-042)
- **Decision:** The streak is **computed on demand** by the `challenge_streak` SQL function from
  `submissions` (only `status='verified'` days count), never stored on or trusted from the client
  (W-003 / D-003). Timezone correctness comes for free: `submissions.challenge_day` was already
  computed in the user's timezone at submit time, so a streak is just the longest run of
  consecutive verified `challenge_day` values. "Current" allows a one-day grace (anchors on today,
  or yesterday if today isn't done). **No pg_cron job** is created — a computed streak needs no
  nightly rollover to stay correct.
- **Why:** Simplest correct design; zero drift; no dependency on enabling `pg_cron`. MVP list sizes
  are bounded (≤365 days), so on-read computation is cheap.
- **Consequences:** The pg_cron half of T-042 is **deferred to T-050 (push)** — cron is only needed
  to *proactively* notify "your streak is at risk" before midnight, not for read correctness. If
  leaderboard reads (T-043) need denormalized streak columns for performance, revisit then.

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

## D-011 — Invite codes: high-entropy 12-char base62, case-sensitive   [Accepted]
- **Date:** 2026-06-04
- **Decision:** Group invite codes are **12 characters from `[A-Za-z0-9]`** (62^12 keyspace),
  generated server-side from `gen_random_bytes` (`generate_invite_code()`), unique, and
  **case-sensitive**, with a DB CHECK enforcing the format. This **supersedes the 4-digit numeric
  codes** chosen for shareability (BUGS W-018) but which were brute-forceable (10,000 combinations).
- **Why:** Join-by-code is the main way into a group; a 4-digit code lets anyone enumerate
  0000–9999 and join arbitrary groups. 62^12 ≈ 3.2×10^21 makes guessing infeasible while staying
  short enough to copy/paste/share.
- **Consequences:** The join field is a plain text input (no number-pad), case preserved, copy via
  long-press; `inviteCodeSchema = /^[A-Za-z0-9]{12}$/` (trim only — never case-fold). Migration
  `20260604000000_secure_invite_codes.sql` (W-026); the `join_group_by_invite` RPC needed no change
  (already an exact match). If friendlier sharing is wanted later, add deep-link invite URLs rather
  than shortening the code.

## D-013 — Migration workflow: bootstrap is a frozen snapshot; new work is a separate file   [Accepted]
- **Date:** 2026-06-13 (user-mandated)
- **Decision:** `supabase/migrations/20260528000000_bootstrap.sql` is a **frozen consolidation
  snapshot** of all migrations applied up to and including 2026-06-11. **Do NOT add new schema
  changes into the bootstrap.** Every new migration after that point is its own dated file
  (`supabase/migrations/<timestamp>_<name>.sql`), exactly as before the consolidation. The
  bootstrap exists only to collapse the historical 25-file chain into one applied baseline and
  save space — it is not the place ongoing work lands.
  - **One narrow exception:** correctness fixes to the bootstrap *itself* for an environment where
    it has not yet been applied cleanly (e.g. the 2026-06-13 `generate_invite_code` search_path
    `pgcrypto` fix). Those edit the bootstrap in place because they change what a *fresh* apply
    produces. A schema change that adds/alters tables, columns, RPCs, or policies is **never** one
    of these — it is always a new file.
- **Why:** The user has already applied every prior migration (the bootstrap + the live
  `generate_invite_code` patch). Folding new changes back into the bootstrap would (a) make an
  already-applied file dirty so it can't be cleanly re-run on existing databases, and (b) destroy
  the reviewable per-change history that separate migration files give. Discrete files keep each
  change auditable and independently appliable.
- **Consequences:** When a future consolidation is wanted, repeat the flatten-into-bootstrap step
  deliberately (read all post-bootstrap files → fold into a fresh snapshot → delete the folded
  files), and only then. Day-to-day, treat the bootstrap as read-only. The W-### "USER must apply"
  tag convention continues for each new migration file.

## D-014 — Privacy/visibility is server-authoritative; one predicate gates Global   [Accepted]
- **Date:** 2026-06-13
- **Decision:** Public/private is a first-class, **server-enforced** property, never a client-side
  filter. `profiles`/`groups`/`challenges` carry a `visibility` enum (**default `'private'`**) and
  `submissions` carry `is_public bool` (**default `false`**). A single SECURITY DEFINER function
  `is_submission_globally_visible(uuid)` encodes the **entire** Global-eligibility predicate
  (verified + opted-in + author public + challenge public & active + group public & active for group
  challenges + no block either direction). The future Global feed query AND the proof-media Storage
  read policy both call this one function so they can never drift. Client carries a uniform
  `isPublic: boolean` mapped to/from the enum at the API boundary.
- **Why:** Privacy is a security boundary — it must hold even against a malicious client, so it lives
  in RLS + SECURITY DEFINER, not in a `.filter()`. Centralizing the predicate prevents the classic
  bug where the list query and the image-access check disagree (a post shows in the feed but its
  photo 403s, or worse, leaks). Defaults are private/off so nothing is ever exposed by omission.
- **Consequences / relationship to D-012:** This migration **deliberately changes existing RPC
  signatures** (`create_challenge`, `update_challenge`, `update_group_meta`, `submit_proof`,
  `redact_my_submission`) and **adds the `visibility`/`is_public` columns to base `select` lists**
  (`PROFILE_SELECT`, group/challenge `COLUMNS`, submission selects). That **relaxes D-012's "additive
  only / never change a create-RPC signature / don't touch base selects" rule** for this one
  security feature, because a follow-up-RPC + placeholder approach is more fragile for a privacy gate
  (extra round-trips, two places the predicate can drift). Safe because: (a) new RPC params use a
  DEFAULT (old clients still resolve), and the UPDATE RPCs use `default null` + `coalesce(col)` so an
  old client leaves visibility unchanged during the upgrade window; (b) **the USER must apply this
  migration BEFORE running the new build** — adding `visibility` to base selects breaks reads if the
  column doesn't exist yet. D-012 remains the default for ordinary incremental changes; this is the
  narrow, recorded exception. The same migration-per-change / USER-applies workflow as D-013 holds.
- **Enforcement landed separately (2026-06-13, migration `20260615_privacy_enforcement`):** the
  foundation (`20260614`) only *added* fields. Enforcement then (a) dropped the bootstrap's
  `profiles_select_public USING (true)` — which had exposed every profile — and added
  `get_viewable_profile` (safe columns, gated by self/public/shares-group-or-challenge); (b) added
  `can_view_submission` = `(author/participant) OR is_submission_globally_visible`, and re-gated the
  7 submission social RPCs (`get_submission_with_author`, comments, reactions, likes) on it so
  globally-visible posts are readable/interactable by non-blocked viewers while private stays
  participant-only; (c) UUID-guarded the proof-media casts; (d) gave avatar removal real 3-state
  semantics (`update_group_meta.p_clear_avatar` + client null-preservation); (e) added
  `create_group.p_visibility`. Model + manual smoke-test checklist: `docs/architecture/PRIVACY_MODEL.md`.
  **The Global feed itself remains deliberately unbuilt.**
- **Model SIMPLIFIED (2026-06-18, migration `20260618_simplify_visibility_model`):** the original
  model required FOUR separate opt-ins (public profile + public group + public challenge + per-submission
  `is_public`), which created too much friction — users stayed private and Global felt empty. New
  product decision (Spotify-playlist style): **defaults flip to public/visible** (profiles/groups/
  challenges), and **submissions have no public/private toggle** — they *inherit* eligibility from
  author profile + challenge (+ group) + verification + blocks. The per-submission gate `is_public`
  is **deprecated** (kept, not dropped) and replaced by an internal `submissions.hidden_from_global`
  (default false; not surfaced in the composer — for future "hide post"/moderation). UI uses
  "private/hide" language (opt-out), default OFF. `is_submission_globally_visible` no longer checks
  `is_public`; it checks `hidden_from_global = false`. Everything else (block both-ways, archive,
  verified, server-authoritative, no client-side filtering, private proof-media) is unchanged.

## D-012 — UI overhaul (2026-06): indigo theme, additive migrations, post-MVP placeholders   [Accepted; narrowed by D-014 for the privacy feature]
- **Date:** 2026-06-05
- **Decision:** The app's visual language is the "sleek" card/tab system in **INDIGO**
  (`#4F46E5` light / `#6366F1` dark), user-selectable light/dark (persisted locally, no backend).
  Two rules for new surfaces: (a) the **Explore tab** and the group **"Global / international"
  leaderboard are placeholders only** (post-MVP per D-006); (b) **backend changes are ADDITIVE** —
  never change the signature of an existing create RPC (`create_group`, `create_challenge`) and
  don't add columns to base `select` lists; set new fields via a follow-up best-effort RPC and read
  them via a dedicated RPC (`get_group_overview`, `get_home_overview`).
- **Why:** Many migrations are pending at once; breaking a currently-working flow (create
  group/challenge) between commit and migration-apply is worse than a new feature being temporarily
  absent. Mirrors the W-026 invite-code approach (keep the working path, add the new behaviour).
- **Consequences:** Challenge emoji is embedded in the title and start+end→duration (no challenge
  schema change); group description/avatar live behind `get_group_overview` + a public
  `group-avatars` bucket. Supersedes the "Sleek violet" colour note — the palette is now indigo.
