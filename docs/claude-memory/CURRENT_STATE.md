# CURRENT_STATE.md

> **Live snapshot of the repo.** Update this at the end of every session. If this disagrees with
> reality, fix it before doing anything else.

_Last updated: 2026-05-27 — by: Phase 0 foundation session_

## Status: PHASE 0 FOUNDATION IN PLACE

The Expo + TypeScript app skeleton exists and **passes `npm run typecheck` + `npm run lint`**.
Foundation only — **no auth, groups, challenges, proof upload, or Supabase migrations** yet.

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
- **Working dir:** `c:\Users\Дастан\Documents\Basta_App`

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
  - `app/` — navigation shell: root `_layout` (providers), `(tabs)/` (Today/Challenges/Groups/
    Profile), `challenge/[id]`, `+not-found`.
  - `src/shared/ui/` — theme tokens + `ThemeProvider` + primitives (Text, Button, Card, Screen).
  - `src/shared/lib/` — `queryClient`, `env`.
  - `src/entities/` — domain models (user, group, challenge, submission, verification) + mappers/.
  - `src/offline/` — engine-agnostic skeleton (db, queue types, upload interface) — **D-007 pending**.
  - `src/services/` — analytics (typed events), crash, notifications — no-op interfaces.
  - `src/features/<9 domains>/` — `index.ts` public-surface skeletons.
  - `src/navigation/` — `routes` (typed helpers), `guards`, `linking`.

## Per-clone setup (each Claude account must do once)
- `git config core.hooksPath .githooks` to activate the secret-scan hook.
- New accounts: follow `scripts/bootstrap-claude.md` (install shared skills, set identity).

## Open decisions to settle before/early in Phase 0
- **D-007** — local persistence engine (WatermelonDB vs SQLite + MMKV): PENDING.
- **D-008** — media upload: standard Supabase Storage first; tus/resumable deferred (accepted).

## What runs
- Nothing yet — there is no app to run.

## Environment / tooling available
- Node v24.16.0, git 2.52 (Windows). `gh` CLI not installed. Expo/EAS not set up yet.
- Skills installed under `~/.claude/skills/` (incl. local `mobile-app-architect`). NOTE: skills
  register only after a Claude Code session reload.

## Not yet decided / needs setup
- Supabase project not created; no env vars / secrets configured.
- No CI/CD, no EAS config, no analytics/crash SDK wired.

## Next concrete step
See `HANDOFF.md` → Next Up. In short: initialize git, then scaffold the Expo + TypeScript project
and the feature-folder structure (after the user approves starting implementation).
