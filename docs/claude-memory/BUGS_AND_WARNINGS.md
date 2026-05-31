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

## [OPEN] W-011 — Phase 2 needs: apply migration + create Storage bucket + (re)install deps
- **Date:** 2026-05-31 · **Area:** backend / Supabase / setup
- **What:** Phase 2 (T-030..T-035) is code-complete and passes tsc/lint/expo-doctor. It will
  fail at runtime until three USER actions are done:
  1. **Apply Phase 2 migration** —
     `supabase/migrations/20260528100000_phase2_challenges_proofs.sql`. Paste the whole file
     into Supabase Dashboard → SQL editor → Run.
  2. **Create the private storage bucket `proof-media`** —
     Dashboard → Storage → New bucket → name: `proof-media` → Public: OFF → Save.
     (Bucket creation isn't reliably representable in migration SQL on hosted Supabase.)
     The Storage RLS policies for that bucket ARE in the migration and rely only on the
     bucket existing first.
  3. **Reinstall deps** after pulling — Phase 2 added 4 packages
     (`expo-image-picker`, `expo-file-system`, `expo-sqlite`, `@react-native-community/netinfo`).
     Run `npm install` after `git pull`.
- **Verify:** in Supabase SQL editor: `select count(*) from challenges;` (→ 0) and
  `select id from storage.buckets where name='proof-media';` (→ 1 row).
- **Status:** Open until applied.

## [OPEN] W-012 — Queue processor only runs while the app is foregrounded (Expo Go limit)
- **Date:** 2026-05-31 · **Area:** offline / queue
- **What:** Expo Go does not run JS while the app is backgrounded, so the queue processor only
  drains when the user opens the app. Drafts stay safe (they're in SQLite + filesystem), but
  uploads scheduled "for later" only fire on next foreground.
- **Mitigation:** None possible in Expo Go. The right fix is a custom dev build with
  `expo-background-fetch` + `expo-task-manager` — defer to Phase 5 / before beta.

## [OPEN] W-010 — Phase 1 Supabase migration must be applied before onboarding works at runtime
> **2026-05-28 UPDATE:** The migration file was updated to fix B-006 (trigger now
> `SECURITY DEFINER`). If you've **already applied** the original version of W-010, also run
> the small CREATE OR REPLACE FUNCTION snippet from B-006 — otherwise `createGroup` will fail
> silently with an RLS error.
- **Date:** 2026-05-28 · **Area:** backend / Supabase
- **Trap:** [`supabase/migrations/20260528000000_phase1_profiles_groups.sql`](../../supabase/migrations/20260528000000_phase1_profiles_groups.sql)
  creates `profiles`, `groups`, `group_members` + RLS + helper fns + the `join_group_by_invite`
  RPC. **Until this is applied to the Supabase project**, profile-setup and group create/join
  fail at runtime with "relation does not exist". The auth flow (sign-up / OTP / sign-in) still
  works without the migration because Supabase's built-in `auth.users` is unaffected.
- **Fix (one-time, USER ACTION):**
  - **Easiest:** Supabase Dashboard → **SQL editor** → paste the migration file's contents → Run.
  - **Or, with Supabase CLI:** `supabase link --project-ref lppfqzqeaizbzunrxnpn` then
    `supabase db push`.
- **Verify:** After applying, in the SQL editor run
  `select count(*) from profiles;` (should return 0) and
  `select pg_get_functiondef('public.join_group_by_invite'::regproc);` (should return SQL).
- **Status:** Open until applied.

## [OPEN] W-009 — Native-only setup: do NOT reintroduce react-native-web
- **Date:** 2026-05-28 · **Area:** build / SDK 54
- **Trap:** During the SDK 52→54 upgrade, `react-native-web` was removed (it caused a peer
  conflict between `react-dom@19.2.x` and `react@19.1.0`). We also set
  `"platforms": ["ios", "android"]` in `app.json`. This is intentional and consistent with D-006
  (no web/Explore in MVP).
- **What can re-break it:**
  - `npx expo install` for a new package may try to re-add `react-native-web` (it won't if
    `platforms` excludes web; verify).
  - Removing or modifying the `platforms` array in `app.json`.
- **Do not** add `react-native-web`, `react-dom`, or web build config unless web is officially in
  scope (it's not).

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

## [OPEN] B-001 — `npm install` reports transitive-dep vulnerabilities (post-SDK-54)
- **Date:** 2026-05-28 (updated post-SDK-54) · **Area:** deps / supply chain
- **What:** `npm install` reports transitive vulnerabilities in build-time tooling (`xmldom`,
  `postcss`, `tar`, `uuid`, `cacache`) reachable via Expo CLI / config plugins. Pre-upgrade count
  was 19 (13 moderate, 6 high) on SDK 52; SDK 54 may differ — re-measure on demand with
  `npm audit`.
- **Repro:** `npm audit` after `npm install`.
- **Why not "fix":** `npm audit fix --force` would jump to SDK 56 (breaking). The right path is a
  deliberate, tested SDK upgrade — which is exactly what we just did for 52→54. Audit may resolve
  further only when SDK 54 itself bumps these transitives.
- **Risk:** Low — these are dev/build-time deps, not in the shipped app bundle.
- **Status:** Open / accept-the-risk. Revisit during T-061 (CI/release) or the next planned SDK
  upgrade.

## [RESOLVED] B-008 — `createGroup` still rejected by RLS on the outer INSERT after B-006
- **Date:** 2026-05-28 · **Area:** Supabase / RLS
- **What:** After fixing B-006 (trigger → SECURITY DEFINER), the user hit a different
  42501 error: `new row violates row-level security policy for table "groups"`. The
  `groups_insert_self_owned` policy requires `owner_id = auth.uid()`. On at least one Supabase
  setup, `auth.uid()` was evaluating to NULL even though the client had a valid session and
  was sending the correct `owner_id` — the comparison `<uuid> = NULL` is NULL, RLS rejects.
  This class of issue is fiddly (JWT propagation under PKCE on first sign-up) and not worth
  whack-a-mole.
- **Fix:** Added a `create_group(p_name text)` `SECURITY DEFINER` RPC that does the insert
  server-side. It still enforces `auth.uid()` (raises 42501 explicitly if NULL), but does the
  INSERT with elevated privileges so RLS doesn't apply to the writer. Same pattern as
  `join_group_by_invite`. The client now calls `supabase.rpc('create_group', ...)` then SELECTs
  the row back (trigger has already added membership, so `groups_select_member` passes).
- **If your project has the original migration applied**, run this in Supabase SQL editor:
  ```sql
  create or replace function create_group(p_name text)
  returns uuid
  language plpgsql security definer
  set search_path = public
  as $$
  declare
    v_uid uuid := auth.uid();
    v_group_id uuid;
  begin
    if v_uid is null then
      raise exception 'not authenticated' using errcode = '42501';
    end if;
    insert into public.groups (name, owner_id)
      values (p_name, v_uid)
      returning id into v_group_id;
    return v_group_id;
  end $$;

  grant execute on function create_group(text) to authenticated;
  ```

## [RESOLVED] B-006 — `createGroup` rejected by RLS: trigger was SECURITY INVOKER
- **Date:** 2026-05-28 · **Area:** Supabase / RLS
- **What:** The `add_owner_member()` trigger fires AFTER INSERT on `groups` and inserts the
  creator as `role='owner'` in `group_members`. Default trigger security is INVOKER → the
  trigger ran with the calling user's privileges, but the RLS policy on `group_members`
  (`gm_insert_admin`) requires being an admin of the target group — which the user only
  becomes via this trigger. Chicken-and-egg → RLS denied → `createGroup` failed with
  "new row violates row-level security policy" → on a small mobile screen this looked like
  "nothing happened" to the user.
- **Fix:** Trigger function is now `SECURITY DEFINER` (and `set search_path = public`), same
  pattern as `is_group_member` / `is_group_admin`. Migration file updated.
- **If your project already has the broken trigger applied**, run this in Supabase SQL editor:
  ```sql
  create or replace function add_owner_member()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
  begin
    insert into group_members (group_id, user_id, role)
      values (new.id, new.owner_id, 'owner');
    return new;
  end $$;
  ```
  Trigger doesn't need re-creation — `create or replace function` is enough.
- **Diagnostic added:** `createGroup`, `joinGroupByInvite`, `upsertProfile`, `completeOnboarding`
  now `console.error('[basta] ...', e)` on failure + use a 10s `AbortSignal` timeout. So future
  silent failures show up in the Expo terminal.

## [RESOLVED] B-007 — No path to verify-email after closing the app mid-signup
- **Date:** 2026-05-28 · **Area:** auth / UX
- **What:** After sign-up, the user is unverified (no session). If they close and reopen the
  app, the gate routes them to sign-in. Trying sign-up again triggers Supabase's per-email
  rate limit ("Email rate limit exceeded") — and they had no UI path to the verify-email
  screen to enter the code they already received.
- **Fix:** (1) Sign-in screen now has a "Have a verification code? Verify your email" link
  to `/(auth)/verify-email`. (2) `verify-email` accepts manual email input when navigated to
  without a query param.
- **Note:** Supabase signup OTPs expire after 1h (configurable). If too much time has passed,
  the user must wait out the rate limit (default 1h per email) and sign up again.

## [RESOLVED] B-003 — Onboarding gate infinite-looped on profile fetch error
- **Date:** 2026-05-28 · **Area:** navigation / gate
- **What:** `useOnboardingGate` returned `{ status: 'loading' }` when `useProfile()` errored
  with no cache. Under common conditions (W-010 — migration not applied; profiles table missing),
  this manifested as an infinite spinner inside the app, no path to recovery.
- **Fix:** Gate now routes to `/(onboarding)/profile-setup` on error. The next mutation surfaces
  the underlying Supabase error inline, the user can retry or see what's wrong. Doc-comment +
  redirect matrix in `NAVIGATION.md` updated.
- **Commit:** `fix: small Phase 1 debugging pass` (this commit).

## [RESOLVED] B-004 — env.ts only validated presence, not shape
- **Date:** 2026-05-28 · **Area:** config / DX
- **What:** A malformed `EXPO_PUBLIC_SUPABASE_URL` (trailing slash, missing scheme, pasted path)
  produced the Supabase edge's cryptic "Invalid path specified in request URL" at sign-up time
  instead of a clear startup error.
- **Fix:** `src/shared/lib/env.ts` now trims values and validates the URL shape (must start with
  `https://`, must not end with `/`, must not contain a path). Each branch's error message names
  the exact fix.
- **Commit:** `fix: small Phase 1 debugging pass`.

## [RESOLVED] B-005 — Stale cache survived sign-out
- **Date:** 2026-05-28 · **Area:** auth / cache hygiene
- **What:** `useSignOut` did not clear the TanStack Query cache. After sign-out, cached `profile`
  remained until `staleTime` expired — if a different user signed in next, they'd briefly see
  the previous user's data. Real privacy/data-leak surface, not just a UX glitch.
- **Fix:** `useSignOut` calls `queryClient.clear()` in `onSettled` (runs whether sign-out succeeds
  or throws — the local session may have been cleared regardless).
- **Commit:** `fix: small Phase 1 debugging pass`.

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
