# CURRENT_STATE.md

> **Live snapshot of the repo.** Update this at the end of every session. If this disagrees with
> reality, fix it before doing anything else.

_Last updated: 2026-06-03 — by: Claude 1 / T-029 (edit group + challenge; add Work category)_

## Status: PHASE 4A COMPLETE + T-026 + T-027 + T-028 + T-029 · apply 9 migrations + 1 dashboard toggle

Phase 4A-1 (password reset + leave/archive group + archive challenge) is complete and
Phase 4A-2 (report/block UI + account-deletion request UI) is now done too. All MVP-scope
account controls and trust/safety surfaces exist in code. Phase 4A migration also got a
small fix: `create policy if not exists` (unsupported in Postgres for policies) replaced
with `drop policy if exists + create policy`.

T-026: the Groups tab now exposes Create group + Join with code CTAs and a link to a new
Archived groups screen; the create/join UI is shared between onboarding and the main app
via `GroupCreateOrJoinForm` in `src/features/groups/ui/`. Owners can restore archived
groups via a new `restore_group` RPC appended to W-019.

T-027: fixed B-011 — group challenge verification was broken because only the creator
was auto-joined into `challenge_participants`. Widened the `is_challenge_participant(uuid)`
helper so group members of `mode='group'` challenges implicitly count as participants.
Single helper change fixes all four affected RLS policies and three RPCs at once.
`challenge_streak` softened to return null instead of raising for true outsiders;
`getChallengeStreak` typed as `ChallengeStreak | null`. New migration
`20260603000000_group_member_is_participant.sql` (W-022) — USER must apply.

T-028: submission author display name now visible on the challenge detail "Recent
submissions" rows and the submission detail screen. Two new SECURITY DEFINER RPCs
(`list_challenge_submissions`, `get_submission_with_author`) join `profiles.username`/
`display_name` server-side without widening `profiles` RLS — matches the
`group_leaderboard` precedent. `Submission` entity grows optional `authorUsername`/
`authorDisplayName`. Migration `20260603100000_submission_authors.sql` (W-023) —
USER must apply.

T-029 (latest session): owners/creators can now edit group + challenge metadata in
place. Group: name (owner-only). Challenge: title, category, duration, proof
requirement (creator-only). `start_date`/`mode`/`group_id`/`threshold` intentionally
NOT editable (would invalidate existing submissions). New `'work'` category added to
the allow-list. Two SECURITY DEFINER RPCs (`update_group`, `update_challenge`) with
server-side validation + duration-shrink guard. Modal routes `app/group/[id]/edit.tsx`
and `app/challenge/[id]/edit.tsx`; Edit buttons added to both Settings footers.
Migration `20260603200000_update_group_and_challenge.sql` (W-024) — USER must apply.

Latest session shipped a clean Phase 4A-1 slice: password reset + leave group + archive group
+ archive challenge. Phase 4A-2 (report/block UI + account deletion request UI) is deferred,
but its server-side tables/RPCs are already in the same migration (W-019) so the user only
applies one SQL file. All checks green.

**Pending USER actions (idempotent migrations + one dashboard toggle):**
- W-014/W-015/W-016/W-017 — Phase 3 (verification, streaks, leaderboard, social).
- W-018 — 4-digit invite codes.
- W-019 — Phase 4A (archive + trust/safety infra + restore_group).
- W-022 — Patch: treat group members as challenge participants (B-011 fix).
- W-023 — Patch: surface submission author display name (T-028).
- **W-024** — Patch: in-place edit of group + challenge metadata (T-029; this session).
- W-020 — Auth → URL Configuration → add `basta://reset-password` to Redirect URLs.

The full MVP loop now exists in code: register → group → challenge → submit proof (offline) →
friend verifies → streak → group leaderboard, plus reactions + comments on each proof. Remaining
MVP: notifications (T-050 — note: remote push needs a dev build/EAS, not Expo Go), trust/safety
(T-051/T-052), tests (T-060), CI/EAS (T-061/T-062). Optional UI follow-ups: screen-level Retro
polish, exact Retro serif font.

Phase 1 + Phase 2 are applied and smoke-tested on-device (USER confirmed W-011 done: Phase 2
migration applied, `proof-media` bucket created, create-challenge / submit-proof loop works).

**This session (Phase 3 social loop + Retro UI), all committed to `mvp` + pushed:**
- **T-040 verification** — `verifications` table + `verify_submission` RPC (threshold-approve /
  single-reject, D-009); `submit_proof` replaced to auto-verify solo proofs; widened proof-media
  storage SELECT; `src/features/verification`; `app/verify/[submissionId].tsx`; verify affordance.
- **T-042 streaks** — `challenge_streak` computed-on-read RPC (tz-correct via stored
  `challenge_day`, D-010); `useChallengeStreak`; streak stat cards on challenge detail.
- **T-043 leaderboard** — `group_leaderboard` RPC; `src/features/leaderboard`; real Groups tab
  list → `app/group/[id].tsx` (invite code + ranked board).
- **T-041 reactions + comments** — `submission_reactions`/`submission_comments` + RPCs;
  `src/features/social` (ReactionBar + CommentsSection); `app/submission/[id].tsx`.
- **UI** — Retro.app-inspired theme (serif display, outlined pill buttons, white canvas, blue
  accent) at the design-system level; Profile **Sign out** button wired.

**Migrations PENDING (USER) before Phase 3 works at runtime:** W-014 verification · W-015 streaks ·
W-016 leaderboard · W-017 social — all idempotent; paste each into Supabase SQL editor. Phase 1+2
already applied (W-011 done).

**Stack:** Expo SDK 54 · React 19.1.0 · RN 0.81.5 · expo-router 6.0.23 · TS 5.9.2 ·
@types/react 19.1.10 · eslint-config-expo 10. **Native-only** (`platforms: ["ios","android"]`;
`react-native-web` removed — D-006).

**Latest checks (this handoff):** `npm run typecheck` → green ✅ · `npm run lint` → green ✅ ·
tests → none configured (W-007). `npx expo-doctor` was 18/18 ✅ earlier this session. The Phase 3
features have NOT been exercised at runtime — pending the four migrations above.

## How to run
- `npm install` (1131 pkgs; node_modules gitignored). Then `npm start` (Expo dev server).
- `npm run typecheck` (tsc --noEmit) and `npm run lint` (eslint + import boundaries) — both green.
- `expo-env.d.ts` is gitignored; Expo regenerates it on `npx expo start`. A copy was created so a
  fresh checkout can typecheck immediately.

## Repository
- **Git:** ✅ Initialized (branch `main`); local identity set (repo-local).
- **Current branch:** `mvp` (feature branch; pushed to `origin/mvp`).
- **Remote:** `origin` → https://github.com/Dastanq44/Basta-App (`mvp` pushed; `main` local only).
- **Recent commits (mvp), this session (pushed):** `1b04dae` T-040 verification + Retro UI +
  sign-out → `d49b624` T-042 streaks → `05ed44a` T-043 leaderboard → `1111469` T-041
  reactions/comments → + this handoff doc commit (see `git log`).
- **Working dir:** repo root (machine-relative — each Claude clones to their own path).

## What exists
- `.gitignore` (hardened for secrets), `README.md`, `CLAUDE.md`, `AGENTS.md`.
- `docs/claude-memory/*` — shared-memory system (8 files).
- `docs/architecture/*` — **architecture proposal** (ARCHITECTURE, DATA_MODEL, OFFLINE_SYNC,
  NAVIGATION, SUPABASE_SCHEMA_DRAFT). Proposal only — no code, no applied migrations.
- **Shared Claude config (two-agent workflow):** `.claude/settings.json` (model=opus,
  permissions), `.claude/skills/mobile-app-architect/` (project skill), `.githooks/pre-commit`
  (secret scanner — enable per clone with `git config core.hooksPath .githooks`),
  `scripts/bootstrap-claude.md` (Claude 2 onboarding).
- **App foundation (Phase 0):** `package.json`, `tsconfig.json`, `app.json` (expo-router +
  typedRoutes), `babel.config.js`, `.eslintrc.js` (import boundaries), `.env.example`.
  - `app/` — navigation shell: root `_layout` (providers + **session gate / redirect**),
    `(tabs)/` (Today/Challenges/Groups/Profile), `challenge/[id]`, `+not-found`. Phase 1 routes
    **wired**: `(auth)/_layout` + `sign-in` · `sign-up` · `verify-email` (real forms);
    `(onboarding)/_layout` + `profile-setup` · `join-or-create-group` (still placeholders —
    T-022/T-023).
  - `src/shared/ui/` — theme tokens + `ThemeProvider` + primitives (Text, Button, Card, Screen,
    **Input**).
  - `src/shared/lib/` — `queryClient`, `env` (now validates Supabase vars), **`supabase`** (client
    with SecureStore adapter + PKCE).
  - `src/entities/` — domain models (user, group, challenge, submission, verification) + mappers/.
  - `src/offline/` — engine-agnostic skeleton (db, queue types, upload interface). D-007 settled
    = Expo SQLite + MMKV; implementation lands in Phase 2.
  - `src/services/` — analytics (typed events), crash, notifications — no-op interfaces.
  - `src/features/auth/` — **implemented (T-020)**: api/, hooks/ (`useSession`, `useSignIn`,
    `useSignUp`, `useVerifyOtp`, `useSignOut`), model/ (zod schemas). All other features remain
    `index.ts`-only skeletons.
  - `src/navigation/` — `routes` (typed helpers), `guards`, `linking`.

## Per-clone setup (each Claude account must do once)
- `git config core.hooksPath .githooks` to activate the secret-scan hook.
- New accounts: follow `scripts/bootstrap-claude.md` (install shared skills, set identity).

## Decisions (resolved)
- **D-007** — local persistence engine: **Expo SQLite + MMKV** (Accepted; WatermelonDB deferred).
  Implementation lands in Phase 2. No open foundation decisions remain.
- **D-008** — media upload: standard Supabase Storage first; tus/resumable deferred (Accepted).

## What runs
- Nothing yet — there is no app to run.

## Environment / tooling available
- Node v24.16.0, git 2.52 (Windows). `gh` CLI not installed. Expo/EAS not set up yet.
- Skills installed under `~/.claude/skills/` (incl. local `mobile-app-architect`). NOTE: skills
  register only after a Claude Code session reload.

## Not yet decided / needs setup
- **Supabase project exists** (`lppfqzqeaizbzunrxnpn`); URL + anon key in local `.env`. **Schema
  not applied yet** (T-003).
- **Supabase email-template config (USER):** confirm `{{ .Token }}` is in the "Confirm signup"
  template — required for OTP flow (W-008).
- No CI/CD, no EAS config, no analytics/crash SDK wired (T-012, T-061).

## Next concrete step
See `HANDOFF.md` → Next Up. Short version: USER applies the three Phase 3 migrations (W-014
verification, W-015 streaks, W-016 leaderboard) and smoke-tests the full loop. Then the next code
task is **T-050 (push notifications)** — also unlocks the deferred bits (verify deep-link from
T-040, "streak at risk" cron from D-010) — or **T-041 (reactions + comments)**. Optional UI
follow-ups: screen-level Retro polish, exact Retro serif font.
