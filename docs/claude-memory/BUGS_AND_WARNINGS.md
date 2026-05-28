# BUGS_AND_WARNINGS.md

> **Known issues, gotchas, and half-finished things.** Log anything that would surprise or trip up
> the next session. Better to over-document a trap than to let the other account rediscover it.

### Format
```
## [OPEN | RESOLVED] B-NNN — <short title>
Date · Area · What's wrong / the trap · Repro (if a bug) · Workaround / fix · Status
```

---

## Active warnings (not bugs — traps to respect)

## [OPEN] W-001 — Repo is not initialized yet
- **Date:** 2026-05-27 · **Area:** setup
- **Trap:** There is no git repo and no app code. The "check git status / continue from existing
  state" rule still applies, but the honest current state is "empty project." First code task is
  `git init` (T-001). Don't assume scaffolding exists.

## [OPEN] W-002 — Installed skills require a session reload to register
- **Date:** 2026-05-27 · **Area:** tooling
- **Trap:** Skills were installed to `~/.claude/skills/` (incl. `mobile-app-architect`) but only
  become invocable as `/skills` after a Claude Code window reload/restart. A fresh session may not
  see them until then.

## [OPEN] W-003 — Streaks/leaderboards must NOT be computed client-side
- **Date:** 2026-05-27 · **Area:** architecture
- **Trap:** Tempting to compute streaks on-device for speed. Don't. It's a cheat surface and causes
  cross-device drift. Server is authoritative (DECISIONS.md D-003). Day boundary uses the user's
  stored timezone, not UTC — DST/timezone edge cases will look right locally and be wrong on server
  if you shortcut this.

## [OPEN] W-004 — Never lose a proof draft
- **Date:** 2026-05-27 · **Area:** offline
- **Trap:** Save the draft + copy captured media to the app sandbox at capture time, BEFORE any
  network call. Relying on a temp/cache path or in-memory state will lose user proof on crash or
  navigation. Retries must use the client UUID idempotency key to avoid double submission.

## [OPEN] W-005 — No secrets in the app bundle
- **Date:** 2026-05-27 · **Area:** security
- **Trap:** Ship only the Supabase anon/public key (RLS does the rest). The service-role key lives
  only in Edge Functions / CI secrets. Auth tokens go in secure storage (Keychain/Keystore), never
  AsyncStorage/MMKV. No sensitive data in deep links.

## [OPEN] W-006 — Never commit secrets; warn before staging
- **Date:** 2026-05-27 · **Area:** security / git
- **Rule (user-mandated, standing):** NEVER stage or commit `.env`, secrets, API keys, tokens,
  private keys/certificates (`*.pem` `*.key` `*.p12` `*.pfx` `*.jks` `*.mobileprovision`
  `id_rsa*`), `google-services.json`, `GoogleService-Info.plist`, or machine-specific files.
- **Trap:** `.gitignore` was hardened (commit on `mvp`) to cover these patterns, BUT globs can't
  catch every filename (e.g. `my-secret.txt`). So before any `git add`, inspect the change set —
  if anything looks like it holds a real secret, **STOP and warn the user before staging.** The
  behavioral check is the primary control; `.gitignore` is the backstop.
- **Follow-up:** a machine-level pre-commit secret-scan hook is queued as `TASKS.md` T-014 (add
  once the JS toolchain exists — gitleaks via husky/lint-staged).

## [OPEN] W-007 — No test harness configured yet
- **Date:** 2026-05-27 · **Area:** testing / CI
- **Trap:** There is no `test` script and no test runner installed. `npm run typecheck` and
  `npm run lint` are the only automated checks today — both green. Do not claim "tests pass"; there
  are none. A Jest + React Native Testing Library setup (and Maestro for the offline-submit E2E) is
  planned (T-060, Phase 5) but could land earlier. The offline-submit→reconnect E2E is the one that
  protects the product's core promise — prioritize it once the queue exists (Phase 2).

## [OPEN] W-008 — Supabase email template must include `{{ .Token }}` for OTP flow
- **Date:** 2026-05-28 · **Area:** auth / config
- **Trap:** The verify-email screen ([`app/(auth)/verify-email.tsx`](../../app/(auth)/verify-email.tsx))
  calls `supabase.auth.verifyOtp({ type: 'signup', token, email })`, which expects the user to
  paste a 6-digit code from their email. By default, Supabase's "Confirm signup" email template
  only includes `{{ .ConfirmationURL }}` (a magic link). With that default, our screen has nothing
  to verify against and the flow breaks silently — user gets the email, no code is in it.
- **Fix (one-time, USER ACTION):** Supabase Dashboard → **Authentication → Email Templates →
  "Confirm signup"**. Edit the body to include something like:
  `<p>Your verification code is: <strong>{{ .Token }}</strong></p>`
  (Leave the `{{ .ConfirmationURL }}` if you want both options.) Save.
- **Why our code can't fix this:** template config is project-level, not client-controlled.
- **Status:** Open until confirmed in the dashboard.

---

## Bugs

## [OPEN] B-001 — `npm install` reports 19 transitive-dep vulnerabilities
- **Date:** 2026-05-28 · **Area:** deps / supply chain
- **What:** `npm install` after adding `@supabase/supabase-js` + `expo-secure-store` reports
  "19 vulnerabilities (13 moderate, 6 high)". The new packages are clean; the warnings come from
  transitive deps in the existing Expo/RN tree (e.g. old `glob`, `tar`, `inflight`, `xmldom`).
- **Repro:** `npm install` (any time).
- **Workaround:** Not actionable in app code. `npm audit fix --force` would bump major versions
  and break the SDK. Revisit during T-061 (CI/release pipeline) and after Expo SDK upgrades.
- **Status:** Open / accept-the-risk for now (no exploitable surface — these are build-time deps).

## [OPEN] B-002 — Brief route-flash on signed-out cold start
- **Date:** 2026-05-28 · **Area:** auth / navigation
- **What:** Root layout returns `<View><ActivityIndicator/></View>` while `useSession()` is
  loading, then `<Stack>` once resolved. For signed-out cold starts, the Stack briefly mounts
  the initial route (likely `(tabs)/index`) before the redirect `useEffect` fires and bounces to
  `/(auth)/sign-in`. One-frame flash.
- **Repro:** Cold start the app with no persisted session.
- **Fix:** Use `expo-router`'s `SplashScreen.preventAutoHideAsync()` at module load and
  `SplashScreen.hideAsync()` once `useSession().status !== 'loading'`. Keeps the native splash
  up until session is known. Small, isolated change — can land standalone.
- **Status:** Open / cosmetic.
