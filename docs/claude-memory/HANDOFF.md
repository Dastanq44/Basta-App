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

## 2026-05-28 — Claude 1 / Phase 1 runtime bug fixes (B-008: createGroup via RPC)

**Did:** Followed B-006 with **B-008**. After the trigger fix shipped, `createGroup` still hit
42501 on the OUTER `INSERT INTO groups` (RLS `owner_id = auth.uid()` failing — likely JWT
propagation edge case under PKCE). Replaced the direct insert with a SECURITY DEFINER
`create_group(p_name)` RPC, same pattern as `join_group_by_invite`. Client now calls
`supabase.rpc('create_group', ...)` then SELECTs the row back (trigger has already added the
membership, so `groups_select_member` passes). USER must apply the new function — SQL is in
BUGS_AND_WARNINGS B-008.

**In progress:** Nothing half-done.

**Next up (USER):** Run the `create_group` CREATE OR REPLACE FUNCTION snippet from B-008 in
Supabase SQL editor. Then reload the app and retest the create-group flow.

**Branch / commit:** `mvp` + `fix(groups): create via SECURITY DEFINER RPC`. Pushed.

**Decisions changed:** none. (Pattern is now: write operations that touch RLS chicken-and-egg
states go through DEFINER RPCs, not direct INSERTs from the client.)

---

## 2026-05-28 — Claude 1 / Phase 1 runtime bug fixes (B-006, B-007 + diagnostics)

**Did:** Fixed two user-reported runtime bugs surfacing during sign-up → group flow on device.
- **B-006 (RESOLVED) — `createGroup` silently fails with RLS error.** Root cause: the
  `add_owner_member` trigger was SECURITY INVOKER, so the trigger's INSERT into `group_members`
  was rejected by `gm_insert_admin` RLS (the user isn't admin until this trigger makes them
  one — chicken-and-egg). Fixed by marking the trigger function `SECURITY DEFINER`
  (`set search_path = public`). Migration file updated. **If migration was already applied,
  user must run the `CREATE OR REPLACE FUNCTION` snippet in BUGS_AND_WARNINGS B-006.**
- **B-007 (RESOLVED) — No way to verify email after closing the app mid-signup.** User got
  trapped behind "Email rate limit exceeded" on sign-up retries. Fix: sign-in screen now has
  a "Have a verification code? Verify your email" link; `verify-email` shows an email Input
  when no query param.
- **Diagnostic hardening:** `createGroup`, `joinGroupByInvite`, `upsertProfile`,
  `completeOnboarding` now log failures via `console.error('[basta] ...', e)` and use a 10s
  `AbortSignal` timeout. Mirrors what `fetchProfile` already does. Future silent failures
  will be visible in the Expo terminal.

**Did NOT change:** decisions, scope, Phase 2 anything, auth feature behavior on happy path.

**In progress:** Nothing half-done.

**Next up (USER):** Run the CREATE OR REPLACE FUNCTION snippet (see BUGS_AND_WARNINGS B-006)
in Supabase SQL editor IF the migration was already applied — otherwise just (re-)apply the
full migration. Then reload the app and the create-group flow should redirect to tabs.

**Blockers / decisions needed:** none.

**Branch / commit:** `mvp` + `fix: rls trigger and verify-email recovery path`. Pushed.

**Notes for next session:** When designing future triggers that write into RLS-protected tables,
default to `SECURITY DEFINER` + a narrow function body (only copies trusted columns from `NEW`).
The pattern matches `is_group_member`/`is_group_admin` already in this migration.

**Tests run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅.
**Tests NOT run:** unit/E2E (W-007). Runtime sign-up→group flow (USER will retest after applying
the trigger fix).

**Decisions changed this session:** none.

---

## 2026-05-28 — Claude 1 / Phase 1 debugging pass (no scope change)

**Did:** Focused debugging/optimization pass. Four small, targeted fixes — no refactoring, no
feature work, no scope change. All checks green; behavior unchanged on the happy path.
- **B-003 (RESOLVED) — Gate infinite-loop on profile error.** `useOnboardingGate` now routes to
  `/(onboarding)/profile-setup` on `isError && !data` (most often W-010). Matrix + comment + the
  table in `NAVIGATION.md` all updated. `app/_layout.tsx` unchanged.
- **B-004 (RESOLVED) — env URL shape validation.** `src/shared/lib/env.ts` trims values and
  rejects malformed URLs (missing https, trailing slash, embedded path) at module load, with
  error messages that name the exact fix. Catches the "Invalid path specified in request URL"
  class of errors before they reach the Supabase edge.
- **B-005 (RESOLVED) — Cache survived sign-out.** `useSignOut` calls `queryClient.clear()` in
  `onSettled`. Closes a real privacy hole (next signed-in user would see previous user's cached
  profile until staleTime).
- **Profile-setup prefill bug.** `app/(onboarding)/profile-setup.tsx` now uses a `useRef`
  one-shot guard so a background refetch can't overwrite what the user is typing.

**Did NOT change:** any auth/groups/onboarding feature surface, the API layer, screens (beyond
the prefill guard fix), the migration, or any decisions.

**In progress:** Nothing half-done.

**Next up:** Unchanged from prior entry — apply migration (W-010), confirm email template
(W-008), smoke-test sign-up → OTP → profile-setup → join/create → tabs on Expo Go. Phase 2 is
the next milestone.

**Blockers / decisions needed:** none from this pass. Same blockers as prior entry (W-008, W-010).

**Branch / commit:** `mvp` + this session's `fix: small Phase 1 debugging pass`. Pushed.

**Notes for next session:**
- The gate's error case now exits to `/(onboarding)/profile-setup` — don't reintroduce the
  infinite-loading behavior. The intent: surface real errors to the user, never trap them.
- `env.ts` validation is strict on shape, not content. If a future env var doesn't fit the
  Supabase URL pattern (different backend, etc.), tailor the validator — don't loosen it.
- `useSignOut` cache-clear is fire-and-forget (`onSettled`). Don't move it to `onSuccess` —
  sign-out may fail server-side but still have cleared the local Supabase session, and you
  want the local cache cleared either way.
- The profile-setup `prefilled` ref guards the lifetime of the screen. If the user navigates
  away and back, the new mount re-prefills (correct).

**Tests run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅ · `npx expo-doctor` 18/18 ✅.
**Tests NOT run:** unit/E2E (W-007); runtime (W-008/W-010 still pending USER actions).

**Decisions changed this session:** none.

---

## 2026-05-28 — Claude 1 / Phase 1 onboarding (T-003 file, T-021, T-022, T-023)

**Did:** Implemented the minimum real backend + onboarding flow needed after auth. No Phase 2
features. tsc/lint green; runtime not yet exercised (W-008, W-010).

- **Migration (T-003 file written):**
  [`supabase/migrations/20260528000000_phase1_profiles_groups.sql`](../../supabase/migrations/20260528000000_phase1_profiles_groups.sql)
  creates `profiles`/`groups`/`group_members` + RLS + helpers + the `join_group_by_invite` RPC.
  **NOT YET APPLIED** to the Supabase project — see W-010 for the one-time USER action.
  Key choices: `profiles.username`/`display_name` nullable (so client upsert can land cleanly,
  no race on unique username); `trg_groups_add_owner` adds the creator as `role='owner'`
  automatically; `is_group_member`/`is_group_admin` are `SECURITY DEFINER` to **avoid RLS
  recursion** when `group_members` policies query `group_members`; `join_group_by_invite` is
  `SECURITY DEFINER` so non-members can resolve invite codes without a broad `groups` SELECT.
- **Onboarding feature** (`src/features/onboarding/*`): `CURRENT_TERMS_VERSION="2026-05-28"`,
  `profileSetupInput` zod (username 3–30 `[a-z0-9_]`, display 1–50, `acceptedTerms: literal(true)`),
  `useProfile` (TanStack query enabled only when signed-in), `useUpsertProfile` (atomic upsert
  on `id`), `useCompleteOnboarding` (flips `onboarded=true`), and `hasAcceptedCurrentTerms`
  helper exposed for the gate. DB row → `User` domain mapping is colocated in the api module
  (the only mapper so far; will move to `entities/mappers` if a second one appears).
- **Groups feature** (`src/features/groups/*`): `createGroup(name)` (insert; trigger handles
  membership), `joinGroupByInvite(code)` via `supabase.rpc(...)`. Mutations expose error.message
  surface for screens. The `index.ts` is the public surface — features/onboarding imports here,
  not into internals (boundary rule).
- **Profile setup screen** (`app/(onboarding)/profile-setup.tsx`): mobile-first form, real
  errors, `KeyboardAvoidingView` on iOS, autocomplete hints (`username-new`/`textContentType`),
  timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` with `'UTC'` fallback. On
  success → `router.replace('/(onboarding)/join-or-create-group')`. **Does NOT** mark
  `onboarded` true.
- **Join-or-create-group screen**: segmented toggle (Create / Join). Create: name → `createGroup`
  → `completeOnboarding` → `replace('/(tabs)')`. Join: invite code → `joinGroupByInvite` →
  `completeOnboarding` → `replace('/(tabs)')`. Submit error surface is unified across the three
  mutations.
- **Onboarding gate** (`src/navigation/guards.ts` → `useOnboardingGate`): full redirect matrix
  (see [`docs/architecture/NAVIGATION.md`](../architecture/NAVIGATION.md#onboarding-gate)).
  `isAtTarget(segments, target)` prevents redirect loops. `app/_layout.tsx` is now thin — it
  only mounts providers, reads the gate, calls `router.replace(target)` if the user isn't
  already at the target, otherwise renders `<Stack>` (or a loading splash while gate resolves).
- **Domain entity**: `src/entities/user.ts` gained `termsVersion?: string`.

**Did NOT do (out of scope):** challenge/proof/verification/streak/leaderboard/push tables,
client-side anything related to those, AI verification, Explore feed, global leaderboards, full
chat, XP/badges/duels, health integrations, monetization.

**In progress:** Nothing half-done. Onboarding is code-complete; verification is gated on W-010
+ W-008.

**Next up (precedence order):**
1. **USER ACTION — W-010:** apply the migration in Supabase Dashboard → SQL editor (or
   `supabase db push`). Verify with `select count(*) from profiles;` (= 0) and the function
   exists.
2. **USER ACTION — W-008:** Supabase Auth → Email Templates → "Confirm signup" includes
   `{{ .Token }}`. (Unchanged from prior session.)
3. **Smoke-test the onboarding flow** on Expo Go SDK 54: sign-up → OTP → profile-setup →
   join-or-create-group → tabs. Test both Create and Join paths. Then sign-out (note: sign-out
   UI still not wired anywhere — add a button on the Profile tab when convenient).
4. **Begin Phase 2** (NOT in this commit, NOT for the immediate next Claude unless directed) —
   the offline drafts + upload queue is the MVP critical path (D-004). D-007 settled engine
   is Expo SQLite + MMKV.

**Blockers / decisions needed:**
- W-010 (migration apply) and W-008 (email template) block runtime smoke-test.
- No decisions opened or changed this session.

**Branch / commit:** `mvp` + this session's `feat(onboarding): implement profile and group setup`,
pushed to `origin/mvp` after all checks green.

**Notes for next session:**
- The gate is the only place that touches navigation routing. If you need to change the redirect
  matrix (e.g. add an email-verified gate), edit `useOnboardingGate` — do not put logic in
  screens or layouts.
- `useProfile` is intentionally disabled while signed-out so RLS doesn't throw when nobody is
  authenticated.
- Username is `toLowerCase`d at the zod boundary so casing variations don't fragment identity.
- `profiles.username` and `display_name` are nullable in DB (intentional) but enforced non-null
  at the client zod boundary on profile-setup submission.
- Owner-as-member is enforced by a DB trigger, not the client. If you want to add an "add
  multiple owners" UI later, go through `group_members` directly with the admin RLS.
- **Migration is hand-maintained.** No `supabase` CLI is wired into the project; if you adopt
  it, point it at `supabase/migrations/`.
- **No tests still** (W-007). Hand-traced redirect matrix is in the doc-comment of
  `useOnboardingGate`.

**Tests run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅ · `npx expo-doctor` 18/18 ✅
(plan to also `npx expo start --clear` before push).
**Tests NOT run:** unit/E2E (W-007). Runtime onboarding flow (W-010 + W-008).

**Decisions changed this session:** none. D-001..D-008 stand.

---

## 2026-05-28 — Claude 1 / Expo SDK 52 → 54 upgrade

**Did:** Upgraded the project from **Expo SDK 52 → SDK 54** to match the user's physical iOS
Expo Go (Expo Go on iOS can't be reliably downgraded). Mechanical upgrade only — no MVP features
touched. tsc/lint/expo-doctor all green; `expo start --clear` boots cleanly.

## Expo SDK 54 Upgrade Notes for Next Claude

- **Previous SDK version:** Expo 52 (React 18.3.1, RN 0.76.3, expo-router 4.0.9, TS 5.3.3,
  @types/react 18.3.12, eslint-config-expo 8.0.1).
- **New SDK version:** Expo 54 (React 19.1.0, RN 0.81.5, expo-router 6.0.23, TS 5.9.2,
  @types/react 19.1.10, eslint-config-expo 10.0.0).
- **Changed package versions (deps):** `expo ~54.0.0`, `react 19.1.0`, `react-native 0.81.5`,
  `expo-router ~6.0.23`, `expo-asset ~12.0.13`, `expo-constants ~18.0.13`, `expo-linking ~8.0.12`,
  `expo-secure-store ~15.0.8`, `expo-status-bar ~3.0.9`, `react-native-safe-area-context ~5.6.0`,
  `react-native-screens ~4.16.0`. **`react-native-web` REMOVED** (we're native-only — see below).
- **Changed package versions (devDeps):** `@types/react ~19.1.10`, `typescript ~5.9.2`,
  `eslint-config-expo ~10.0.0`.
- **New file:** `metro.config.js` (minimal: extends `expo/metro-config`). Satisfies expo-doctor's
  Metro-config check and aligns with Expo's recommended setup.
- **app.json:** added `"platforms": ["ios", "android"]` so `npx expo install` will not re-introduce
  `react-native-web`. Consistent with D-006 (no web/Explore in MVP).
- **Commands run, in order:**
  1. `npm install --save expo@~54.0.0`
  2. `npx expo install --fix` (proposed new versions; npm install failed on peer conflict with
     `react-native-web@0.21.2` pulling `react-dom@19.2.x` against `react@19.1.0`).
  3. Edited `package.json` (removed `react-native-web`, bumped devDeps to expected versions).
  4. Edited `app.json` (added `platforms: ["ios","android"]`).
  5. `rm -rf node_modules package-lock.json && npm install --no-audit --no-fund` — clean install,
     925 packages added.
  6. Added `metro.config.js`.
  7. `npm run typecheck` ✅ · `npm run lint` ✅ · `npx expo-doctor` 18/18 ✅.
  8. `CI=1 npx expo start --clear --port 8082` — Metro booted, `Waiting on http://localhost:8082`,
     env loaded, no errors. Killed cleanly after success signal.
- **npx expo-doctor passes:** ✅ **18/18 checks**.
- **npm run typecheck passes:** ✅ exit 0.
- **npm run lint passes:** ✅ exit 0. (eslint-config-expo v10 still works with legacy `.eslintrc.js`.)
- **npx expo start --clear was tested:** ✅ Booted cleanly on port 8082 (8081 was occupied by the
  user's earlier orphaned `npm start` session — not an upgrade issue).
- **Post-upgrade fix-up:** SDK 54 requires `babel-preset-expo` as an **explicit** dep
  (in SDK 52 it was implicit). Added to `devDependencies` as `~54.0.10` after Metro complained
  "Cannot find module 'babel-preset-expo'". Don't remove it.
- **Remaining warnings:**
  - npm reports transitive vulnerabilities post-install (count may differ from B-001's earlier 19).
    Re-evaluate in B-001 once on SDK 54; do NOT run `npm audit fix --force` (would jump to SDK 56).
  - `expo-env.d.ts` is regenerated by Expo at start (different content than my prior stub — fine,
    it's gitignored). On a fresh clone, run `npx expo start` once before `npm run typecheck` if you
    see "Cannot find type definition" errors for `expo/types`.
  - Port 8081 still held by the user's earlier `npm start` shell. Either kill that shell or use
    `--port 8082`.

**Exact commands the next Claude should run before continuing:**
```bash
git pull origin mvp
npm install
npx expo-doctor
npm run typecheck
npm run lint
npx expo start --clear
```

**Decisions changed this session:** none. D-001..D-008 unchanged. The native-only stance
(`platforms: ios,android`, no `react-native-web`) is consistent with D-006 (no web/Explore).

**Blockers / decisions needed:** none from the upgrade itself.

**Branch / commit:** `mvp` + this session's `chore(expo): upgrade project to SDK 54`. Pushed to
`origin/mvp` after all checks green.

**Notes for next session:**
- **Do NOT downgrade to SDK 52** — Expo Go on iOS tracks the latest SDK and can't reliably hold
  older versions; we matched SDK 54 for that reason.
- **Use `npx expo install <pkg>` for all new Expo-related deps** (preserves SDK 54 compatibility).
  Plain `npm install <pkg>` may pick a version that breaks the Expo matrix.
- **Native-only.** Don't reintroduce `react-native-web` or remove the `platforms` array unless web
  becomes scope (it's not — D-006).
- T-021 (terms gate) is still the recommended next task for Phase 1. Auth runtime smoke-test on
  Expo Go is still pending (W-008 — Supabase email template + the OTP flow).

**Tests run:** `npm run typecheck` ✅ · `npm run lint` ✅ · `npx expo-doctor` 18/18 ✅ ·
`npx expo start --clear` boot ✅.
**Tests NOT run:** unit/component/E2E (W-007 — no harness). Runtime auth flow on device (W-008
prerequisite).

---

## 2026-05-28 — Claude 2 / Phase 1 auth (T-020) implementation
**Did:** Implemented **Phase 1 email auth (T-020)** end-to-end — code only; runtime not yet
exercised against the live Supabase project.
- **Supabase wiring:** created local `.env` (gitignored, verified via `git check-ignore`) with
  project URL + anon key; hardened [`src/shared/lib/env.ts`](../../src/shared/lib/env.ts) to throw
  at module load if vars missing; built [`src/shared/lib/supabase.ts`](../../src/shared/lib/supabase.ts)
  with `expo-secure-store` token adapter, `flowType: 'pkce'`, `detectSessionInUrl: false`.
- **Deps added:** `@supabase/supabase-js@^2.106.2`, `expo-secure-store@~14.0.1`
  (`npx expo install` for the latter to get SDK 52-compatible version).
- **Auth feature module** ([`src/features/auth/`](../../src/features/auth/)):
  - `model/schemas.ts` — zod schemas; email is `trim().toLowerCase().email()`, password 8–72,
    OTP `/^\d{6}$/`.
  - `api/index.ts` — thin Supabase wrappers (signUp / signInWithPassword / verifyOtp(type:'signup')
    / signOut / getSession). All throw on error.
  - `hooks/useSession.ts` — `{ status: 'loading' | 'signedIn' | 'signedOut', session }`; reads
    initial session once, then subscribes to `onAuthStateChange`.
  - `hooks/{useSignIn,useSignUp,useVerifyOtp,useSignOut}.ts` — TanStack `useMutation` wrappers
    that re-validate via zod before calling api (defense in depth).
  - Public surface: hooks + schemas + types only. `api/` and `model/schemas.ts` internals are
    private (not exported from `index.ts`).
- **Design system:** added `Input` primitive ([`src/shared/ui/Input.tsx`](../../src/shared/ui/Input.tsx))
  — label/hint/error, focus border via `ring` token, ≥44pt minHeight, `StyleSheet.hairlineWidth`
  border. Exported from `src/shared/ui/index.ts`.
- **Group layouts:** new [`app/(auth)/_layout.tsx`](../../app/(auth)/_layout.tsx) (Stack, headers
  visible, title set per screen via `<Stack.Screen options=…>`) and
  [`app/(onboarding)/_layout.tsx`](../../app/(onboarding)/_layout.tsx) (Stack, `headerBackVisible:
  false` so onboarding steps can't be skipped).
- **Auth screens fleshed out:** [`app/(auth)/sign-in.tsx`](../../app/(auth)/sign-in.tsx),
  [`sign-up.tsx`](../../app/(auth)/sign-up.tsx), [`verify-email.tsx`](../../app/(auth)/verify-email.tsx)
  — real forms with field-level zod errors, KeyboardAvoidingView (iOS `padding`), proper
  autocomplete/textContentType hints, OTP input strips non-digits + maxLength 6 + `oneTimeCode`
  autofill. Sign-up `router.replace`s to verify-email with `email` query param. Sign-in/verify
  success relies on `onAuthStateChange` → root layout redirect (no manual nav).
- **Root layout** ([`app/_layout.tsx`](../../app/_layout.tsx)): added internal `<RootNav>` that
  reads `useSession()`, watches `useSegments()`, and `router.replace()`s — signed-out users out
  of non-`(auth)` routes, signed-in users out of `(auth)`. Loading state shows centered
  `ActivityIndicator` (token-coloured).
- **Verification:** `npm run typecheck` → exit 0 ✅ · `npm run lint` → exit 0 ✅.

**In progress:** Nothing half-done.

**Next up:**
1. **USER ACTION — Supabase email template:** Dashboard → Auth → Email Templates →
   *"Confirm signup"*. Make sure the body includes `{{ .Token }}` (the 6-digit OTP). Default
   templates often only include `{{ .ConfirmationURL }}` (magic link) — with that default, the
   verify-email screen has nothing to verify. See W-008 below.
2. **Smoke-test the auth flow:** `npm start` → sign up with a real email → enter OTP →
   confirm app lands on (tabs). Then sign in. The `useSignOut` hook exists but isn't yet wired
   to any UI — add a button on Profile tab when convenient.
3. **T-021 — terms acceptance gate** (versioned).
4. **T-022 — profile setup + server `onboarded` flag.** Extend `<RootNav>` redirect: signed in
   + !onboarded → `/(onboarding)/profile-setup`.
5. **T-023 — friend invite links + group create/join.**
6. **T-003 — apply Supabase schema + RLS** (still TODO; needed for `onboarded` flag, profiles,
   groups, etc.). RLS draft in `docs/architecture/SUPABASE_SCHEMA_DRAFT.md` is sketch quality —
   harden + add pgTAP tests before applying.

**Blockers / decisions needed:**
- W-008: Supabase email-template config (USER) — without `{{ .Token }}` in the template, OTP
  flow doesn't work end-to-end. Code is correct; config is one toggle in the dashboard.
- T-003 schema not applied. Auth itself works without it (Supabase `auth.users` is built-in),
  but T-022 (profile/onboarded) needs the `users` table from the schema draft.

**Branch / commit:** `mvp` — this session's commit `feat(auth): implement Phase 1 email auth
(T-020)` includes 23 file changes (T-020 implementation + 3 earlier doc-drift fixes for D-007 in
`AGENTS.md` / `FILE_MAP.md` / `CURRENT_STATE.md`). Pushed to `origin/mvp`.

**Notes for next session:**
- **Brief flash on cold start.** `RootNav` returns `<View><ActivityIndicator/></View>` during
  loading, then `<Stack>` once session resolves. For signed-out cold starts, the Stack briefly
  mounts the initial route (likely `(tabs)`) before the redirect `useEffect` runs. Fix: use
  `expo-router`'s `SplashScreen.preventAutoHideAsync()` / `hideAsync()` to hold the native splash
  until session is known. Logged as B-002.
- **`.env` is at repo root, gitignored** — contains the Supabase URL + anon key. If you re-clone
  / move machines, recreate it from Dashboard → Settings → API. **Never commit** (W-006 + the
  `.githooks/pre-commit` regex blocks `eyJ`-style JWTs too, as a backstop).
- **npm install audit:** "19 vulnerabilities (13 moderate, 6 high)" reported. These are
  transitive in the existing Expo/RN tree, not from the new Supabase/secure-store packages.
  Not actionable today; revisit during T-061 (CI/release). Logged as B-001.
- **The `(auth)`/`(onboarding)` route groups are URL-invisible** — `/(auth)/sign-in` maps to
  `/sign-in` in deep links. Fine for now.
- **Sign-out UI:** none. `useSignOut()` is exported but unused — add a button on the Profile
  tab in any of the next sessions.

**Tests run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅.
**Tests NOT run:** unit/E2E (W-007 — none configured); **runtime auth flow** (no device run).

**Decisions changed this session:** none. D-007 (Expo SQLite + MMKV) and D-008 (Supabase Storage
first) remain accepted.

## 2026-05-27 — HANDOFF SNAPSHOT (ready for next Claude; pre-Phase-1)

> Clean checkpoint. No new implementation this session — verification + handoff only.

**Completed work (project to date):**
- Shared-memory/handoff system, architecture proposal (`docs/architecture/*`), two-Claude shared
  config (`.claude/`, `.githooks/pre-commit`, `scripts/bootstrap-claude.md`).
- **Phase 0 foundation** (`b004557`): Expo SDK 52 + expo-router + TS skeleton — navigation shell,
  design tokens + UI primitives, domain entities, engine-agnostic offline skeleton, service
  interfaces, feature index skeletons, ESLint import boundaries. tsc + lint green.
- **Phase 1 prep** (`86bbcd0`): settled **D-007 = Expo SQLite + MMKV** (WatermelonDB deferred);
  fixed `Card` to `StyleSheet.hairlineWidth`; added 5 Phase 1 route shells (auth + onboarding).

**Changed files (latest unpushed commit `86bbcd0`):** 14 files —
`app/(auth)/{sign-in,sign-up,verify-email}.tsx`, `app/(onboarding)/{profile-setup,join-or-create-group}.tsx`,
`src/shared/ui/Card.tsx`, `src/offline/db/index.ts`, `src/offline/queue/types.ts`, and docs
(ARCHITECTURE, OFFLINE_SYNC, DECISIONS, CURRENT_STATE, TASKS, HANDOFF). This handoff commit also
touches CURRENT_STATE/TASKS/BUGS_AND_WARNINGS/HANDOFF.

**Unfinished work:** No code is half-written. Phase 1 auth is entirely unstarted (T-020–T-023).
The `(auth)`/`(onboarding)` route files are placeholders with no logic and no `_layout.tsx`.
`useSessionState()` is a stub returning `signedIn`. Service SDKs (Sentry/analytics) are no-op
interfaces awaiting real wiring (T-012).

**Next recommended task:** Begin **Phase 1 auth (T-020)** — but FIRST create the Supabase project +
credentials (put them in `.env`; only `EXPO_PUBLIC_*` ship in the bundle). Then: email/PKCE auth in
`src/features/auth` (session hook + `expo-secure-store` tokens), terms gate (T-021), profile setup
(T-022), group create/join (T-023). Wire the real session into `useSessionState()` and add redirects
+ group `_layout`s.

**Known issues:** No test harness configured yet (see W-007 / T-060). `(auth)`/`(onboarding)` lack
`_layout.tsx` (they render under the root Stack for now). `expo-env.d.ts` is gitignored — a fresh
clone may warn on typecheck until `npx expo start` regenerates it.

**Tests run:** `npm run typecheck` → exit 0 ✅ · `npm run lint` → exit 0 ✅.
**Tests NOT run:** unit/component/E2E — **none exist; no `test` script configured** (T-060, deferred
to Phase 5 but a Jest harness could land earlier). Maestro offline E2E is the must-have later.

**Warnings for the next Claude:**
- Run `npm install` after pulling — `node_modules` is gitignored.
- Enable the secret-scan hook once per clone: `git config core.hooksPath .githooks` (NOT pulled).
- Respect ESLint import boundaries — a `no-restricted-imports` error is intentional (`.eslintrc.js`).
- Do NOT build post-MVP features (AI, Explore, global leaderboard, chat, XP) — DECISIONS D-006.
- Keep streaks/leaderboards/verification/day-boundary server-authoritative (D-003).
- New account? Follow `scripts/bootstrap-claude.md` and reload the window so repo skills register.

**Branch / commit:** `mvp` @ `86bbcd0` + this handoff commit. Pushed to `origin/mvp` this session.

**Decisions changed this session:** none (D-007 was settled in the prior commit `86bbcd0`).

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
