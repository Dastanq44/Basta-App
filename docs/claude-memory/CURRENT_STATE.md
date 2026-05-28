# CURRENT_STATE.md

> **Live snapshot of the repo.** Update this at the end of every session. If this disagrees with
> reality, fix it before doing anything else.

_Last updated: 2026-05-28 — by: Claude 2 / Phase 1 auth implementation_

## Status: PHASE 1 AUTH IMPLEMENTED (T-020) — UNCOMMITTED; runtime untested

**Latest checks:** `npm run typecheck` → green ✅ · `npm run lint` → green ✅ · tests → none
configured (W-007). **Working tree dirty** — T-020 code + doc-drift fixes not yet committed.
Runtime auth flow has NOT been exercised end-to-end (see HANDOFF "Next up #2").

Email-auth (sign-up / sign-in / verify-OTP / sign-out / session) is wired, including a
SecureStore-backed Supabase client, a root-layout redirect gate, and field-validated forms.
**Still no groups, challenges, proof upload, or Supabase migrations.**

## How to run
- `npm install` (1131 pkgs; node_modules gitignored). Then `npm start` (Expo dev server).
- `npm run typecheck` (tsc --noEmit) and `npm run lint` (eslint + import boundaries) — both green.
- `expo-env.d.ts` is gitignored; Expo regenerates it on `npx expo start`. A copy was created so a
  fresh checkout can typecheck immediately.

## Repository
- **Git:** ✅ Initialized (branch `main`); local identity set (repo-local).
- **Current branch:** `mvp` (feature branch; pushed to `origin/mvp`).
- **Remote:** `origin` → https://github.com/Dastanq44/Basta-App (`mvp` pushed; `main` local only).
- **Recent commits (mvp):** `fa77c05` initial setup → `66b813f` secrets hardening → + this
  session's `docs: add MVP architecture proposal` (see `git log`).
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
See `HANDOFF.md` → Next Up. Short version: user toggles the Supabase email template + smoke-tests
the auth flow; then T-021 (terms gate) or T-022 (profile setup + onboarded flag), gated on T-003
(apply Supabase schema + RLS).
