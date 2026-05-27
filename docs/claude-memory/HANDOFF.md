# HANDOFF.md

> **Session-to-session relay log.** The most important file for swapping between the two Claude
> accounts. APPEND a new entry at the TOP at the end of every session. Never delete history.

## How to use this file
- **Starting a session:** read the latest entry (top). It tells you exactly where to pick up.
- **Ending a session:** add a new entry at the top using the template below. Be concrete. Name
  files, branches, commit hashes, and the exact next action.

### Entry template
```
## YYYY-MM-DD — <account / session label>
**Did:** <what got done this session>
**In progress:** <anything half-finished + where it stands>
**Next up:** <the precise next action(s) for whoever picks up>
**Blockers / decisions needed:** <anything requiring the user or another account>
**Branch / commit:** <branch name @ short hash, or "no repo yet">
**Notes for next session:** <traps, context, things not obvious from the code>
```

---

## 2026-05-27 — Phase 1 prep / foundation cleanup
**Did:**
- **Settled D-007:** local persistence = **Expo SQLite (relational) + MMKV (key/value)**;
  WatermelonDB **deferred** (revisit only if offline relational sync gets materially more complex).
  Updated DECISIONS.md (D-007 → Accepted), OFFLINE_SYNC.md, ARCHITECTURE.md, TASKS.md (T-015 DONE),
  and the `src/offline` code comments (no longer say "PENDING"; placeholder error now says "lands
  in Phase 2"). No DB deps added yet — implementation is Phase 2.
- **Fixed `Card.tsx`:** border now uses `StyleSheet.hairlineWidth` (density-aware) instead of the
  custom `StyleSheetHairline = 1` constant (removed).
- **Added Phase 1 route shells** (thin placeholders, NO auth logic): `app/(auth)/sign-in`,
  `sign-up`, `verify-email`; `app/(onboarding)/profile-setup`, `join-or-create-group`.
- Ran `npm run typecheck` → green, `npm run lint` → green.

**Scope respected:** no full auth, no Supabase migrations, no post-MVP features.

**In progress:** Nothing half-done.

**Next up — Phase 1 auth (T-020–T-023):** create the Supabase project + credentials (env via
`.env`, only EXPO_PUBLIC_* in the bundle), implement email/PKCE auth in `src/features/auth`
(session hook, secure-token storage), terms-acceptance gate, profile setup, group create/join.
Wire the auth guard in `useSessionState()` (currently a placeholder returning `signedIn`) and add
redirects in `app/_layout`. The route shells above are ready to receive that logic.

**Blockers / decisions needed:** Supabase project/credentials must be created before auth can talk
to a backend. No open foundation decisions remain (D-007 settled).

**Branch / commit:** `mvp` + `chore: prepare Phase 1 auth foundation`.

**Notes for next session:** `(auth)`/`(onboarding)` are route groups with no `_layout.tsx` yet —
they currently render under the root Stack; add group `_layout`s when wiring the auth flow. Run
`npm install` after pulling (node_modules gitignored).

## 2026-05-27 — Phase 0 foundation session
**Did:** Implemented the **Phase 0 foundation** (skeleton only — no features). Expo SDK 52 +
expo-router v4 + TypeScript.
- Config: `package.json`, `tsconfig.json` (`@/*`→`src/*`, strict), `app.json` (expo-router +
  typedRoutes), `babel.config.js`, `.eslintrc.js` (layered import boundaries via core
  `no-restricted-imports`), `.env.example`.
- Navigation shell: `app/_layout` (SafeAreaProvider + QueryClientProvider + ThemeProvider + Stack),
  `app/(tabs)` (Today/Challenges/Groups/Profile), `app/challenge/[id]`, `app/+not-found`.
- Design system: `src/shared/ui` — semantic tokens (light/dark), `ThemeProvider`, primitives
  (Text/Button/Card/Screen) with a11y baked in.
- Domain: `src/entities` (user, group, challenge, submission, verification + mappers/). `SyncStatus`
  lives in entities (domain owns lifecycle); offline imports it.
- Offline: `src/offline` engine-agnostic skeleton (db interface, queue types + backoff, upload
  interface). **No engine chosen — D-007 still PENDING.**
- Services: `src/services` analytics (typed events)/crash/notifications — no-op interfaces.
- Features: `src/features/<9 domains>` index.ts public-surface skeletons.
- Navigation helpers: `src/navigation` routes/guards/linking.
- **Ran `npm install` (1131 pkgs), `npm run typecheck` → green, `npm run lint` → green.** Lint
  caught a real `entities → @/offline` boundary violation; fixed by moving `SyncStatus` into entities.

**In progress:** Nothing half-done. Foundation is complete and green.

**Next up:** Settle **D-007** (T-015) before building `src/offline/db`. Then Phase 1 auth
(T-020–T-023). Phase 2 (proof + queue, critical path) is where `SyncBadge` and the queue processor
land. Wire real Sentry/analytics SDKs into the existing `src/services` interfaces (T-012).

**Blockers / decisions needed:** D-007 (local DB engine). Supabase project/credentials still need
creating before Phase 1 auth can talk to a backend.

**Branch / commit:** `mvp` + `chore: add mobile app foundation`.

**Notes for next session:** `node_modules` is gitignored — run `npm install` after pulling.
`expo-env.d.ts` is gitignored but a local copy exists for tsc; `npx expo start` regenerates it.
Import boundaries are enforced by ESLint — if you get a `no-restricted-imports` error, respect the
layer (it's intentional, see `.eslintrc.js`). The app shell currently shows tabs unconditionally
because `useSessionState()` is a placeholder returning `signedIn` (real auth = Phase 1).

## 2026-05-27 — Two-Claude shared-config session
**Did:** Set up shared configuration so both Claude accounts are interchangeable from the repo:
- Vendored the project skill into `.claude/skills/mobile-app-architect/` (auto-loads; no per-account install).
- Added `.claude/settings.json` (model=opus; permissions allow/ask/deny incl. deny-read on secret files).
- Added `.githooks/pre-commit` secret scanner (gitleaks if present, else high-signal regex) and ran
  `git config core.hooksPath .githooks`; smoke-tested — it blocks a fake `sk_live_…`. Marks **T-014 DONE**.
- Added `scripts/bootstrap-claude.md` (one-time setup for a new "Claude 2": enable hooks, install
  shared third-party skills, match settings/identity).
- Added a "shared vs account-local" caveat to `CLAUDE.md`. Updated `FILE_MAP`, `CURRENT_STATE`, `TASKS`.

**In progress:** Nothing in code.

**Next up (only after user approves implementation):** unchanged from prior entry — T-015 (settle
D-007 local DB engine), then T-002 (scaffold Expo app), then T-003 (Supabase schema, not applied yet).

**Blockers / decisions needed:** Each clone must run `git config core.hooksPath .githooks` once
(not auto — git stores hooksPath locally). A brand-new Claude account must run
`scripts/bootstrap-claude.md` to install the third-party skills (those are NOT vendored).

**Branch / commit:** `mvp` + this session's `chore: shared Claude config for two-agent workflow`.

**Notes for next session:** The git hook only catches secrets via the `core.hooksPath` config —
verify it's set in your clone (`git config core.hooksPath` → `.githooks`). The behavioral W-006 rule
still applies as the primary control; the hook is the backstop.

## 2026-05-27 — Architecture-proposal session
**Did:**
- Set up Git: `git init` (branch `main`), `.gitignore`, first commit `fa77c05`; hardened
  `.gitignore` for secrets + added a standing "never commit secrets / warn before staging" rule to
  `CLAUDE.md` and `BUGS_AND_WARNINGS.md` (W-006), commit `66b813f`. Added remote `origin`
  (Dastanq44/Basta-App) and pushed branch `mvp`.
- Wrote the **architecture proposal** under `docs/architecture/`: `ARCHITECTURE.md`,
  `DATA_MODEL.md`, `OFFLINE_SYNC.md`, `NAVIGATION.md`, `SUPABASE_SCHEMA_DRAFT.md`.
- Applied scope adjustments: renamed the tab **"Today/Feed" → "Today"**; added explicit
  **Explore/public feed = POST-MVP** notes; added **D-007** (local DB engine: WatermelonDB vs
  SQLite+MMKV — PENDING) and **D-008** (media upload: standard Supabase Storage first, tus
  deferred) to `DECISIONS.md`; softened D-004 accordingly.
- Updated memory files: `FILE_MAP.md`, `CURRENT_STATE.md`, `TASKS.md`, `DECISIONS.md`.

**In progress:** Nothing in code. Proposal is complete and committed (`docs: add MVP architecture
proposal`).

**Next up (only after the user approves starting implementation):**
1. `T-015` — settle **D-007** (local persistence engine). Lean: SQLite + MMKV; confirm with team.
2. `T-002` — scaffold the Expo + TypeScript app (expo-router) + feature folders per D-002.
3. `T-003` — create the Supabase project and apply the (reviewed) schema + RLS. **Schema draft is
   NOT applied yet** — harden RLS + add pgTAP tests first.

**Blockers / decisions needed:**
- User must confirm starting implementation (this session was docs-only).
- D-007 needs a team decision before building `src/offline/db`.
- Supabase project + credentials need creating (by the user / with go-ahead). No secrets in repo.

**Branch / commit:** `mvp` @ `66b813f` + this session's `docs: add MVP architecture proposal`
(ahead of `origin/mvp`; not pushed this session unless asked).

**Notes for next session:** Read `docs/architecture/ARCHITECTURE.md` first — it links the rest.
Keep streaks/leaderboards/day-boundary/verification server-authoritative (D-003). Offline drafts +
upload queue is the critical path (D-004). Do NOT build Explore/public feed (post-MVP, D-006). Do
NOT apply the Supabase schema draft as-is — RLS is a sketch.

## 2026-05-27 — Setup session (memory/handoff system)
**Did:** Created the shared-memory & handoff system: `CLAUDE.md`, `AGENTS.md`, and the eight
`docs/claude-memory/*` files (PROJECT_BRIEF, CURRENT_STATE, HANDOFF, DECISIONS, TASKS, FILE_MAP,
BUGS_AND_WARNINGS). Confirmed the working directory is empty and **not a git repo**. Locked the
stack and core architecture decisions in `DECISIONS.md`.

**In progress:** Nothing in code. System docs are complete.

**Next up (do these in order, after the user approves starting implementation):**
1. `T-001` — `git init`, add a sensible `.gitignore` (Node/Expo/RN), make the first commit.
2. `T-002` — Scaffold the Expo + TypeScript app (Expo Dev Build, expo-router) and the
   feature-folder structure per `DECISIONS.md` D-002 and `FILE_MAP.md`.
3. `T-003` — Create the Supabase project; define the initial schema + RLS (groups, memberships,
   challenges, submissions, verifications) — server-authoritative scoring stubs.

**Blockers / decisions needed:**
- User must confirm they want to begin implementation (this session was explicitly docs-only).
- Supabase project + credentials need to be created by the user (or with their go-ahead).

**Branch / commit:** no repo yet.

**Notes for next session:** Do NOT relitigate the stack — it's locked in `DECISIONS.md` D-001.
Read `PROJECT_BRIEF.md` for scope guardrails (don't build excluded features). Keep streaks &
leaderboards server-side from day one — retrofitting that later is expensive.
