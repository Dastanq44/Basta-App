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

## [OPEN] W-013 — Recurring `npm install` ERESOLVE (react-dom peer); fix is clean reinstall
- **Date:** 2026-05-31 · **Area:** deps / npm
- **What:** Each time the lockfile drifts (after sessions that add/bump deps), `npm install`
  errors with `ERESOLVE could not resolve` between `react@19.1.0` (Expo SDK 54's pin) and
  `react-dom@19.2.x` (a `peerOptional` pulled in by `expo-router` for web support).
  We're native-only via D-006 (`platforms: ["ios","android"]` in `app.json`), so `react-dom`
  is never actually imported — but npm's strict peer resolution doesn't know that.
- **Fix (the agreed workflow):**
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```
  Takes ~1 minute. Don't add `.npmrc legacy-peer-deps=true` to the repo — the user
  explicitly declined a committed permanent workaround.
- **Targeted alternative if this gets annoying:** add a `package.json` `overrides` block
  pinning `react-dom` to a compatible version. More surgical than `.npmrc`. Ask first.
- **Status:** Open / known operational item. Re-evaluate after any future Expo SDK upgrade
  (the react-dom peer specifier may align with our react version then).

## [OPEN] W-017 — Phase 3 needs: apply the social migration before reactions/comments work
- **Date:** 2026-05-31 · **Area:** backend / Supabase
- **What:** T-041 adds `supabase/migrations/20260531300000_phase3_social.sql`
  (`submission_reactions`, `submission_comments` + `react_to_submission` / `add_comment` RPCs +
  participant-read RLS). Until applied, the submission-detail screen's reaction bar and comments
  error. Apply via Dashboard → SQL editor → Run. Idempotent (`create ... if not exists`,
  `create or replace`, `drop policy if exists`).
- **Depends on:** Phase 2 (submissions) applied.
- **Verify:** `select react_to_submission('<a submission id>'::uuid, '🔥');` then
  `select * from submission_reactions;` shows your row; `select add_comment('<id>'::uuid, 'hi');`
  returns a json id.
- **Smoke-test:** open a challenge → tap a submission row → react (chip highlights, count updates) →
  post a comment → it appears. Reads are limited to challenge participants.
- **Note:** comments query embeds `profiles(username, display_name)` via the author_id FK — works
  because there's a single FK from submission_comments to profiles.
- **Status:** Open until applied.

## [OPEN] W-016 — Phase 3 needs: apply the leaderboard migration before the group board loads
- **Date:** 2026-05-31 · **Area:** backend / Supabase
- **What:** T-043 adds `supabase/migrations/20260531200000_phase3_leaderboard.sql` (the
  `group_leaderboard` RPC). Until applied, the Group screen's leaderboard errors (RPC missing).
  Apply via Dashboard → SQL editor → Run. Idempotent (`create or replace`).
- **Depends on:** Phase 1 (groups/profiles) + Phase 2 (challenges/submissions) already applied.
- **Verify:** `select * from group_leaderboard('<a group id you belong to>'::uuid);` returns one
  row per member with `verified_count`.
- **Smoke-test:** open Groups tab → tap a group → see the ranked board (your row highlighted);
  verified proofs on the group's challenges raise your count. Non-members get an error (member-gated).
- **Status:** Open until applied.

## [OPEN] W-015 — Phase 3 needs: apply the streaks migration before streaks show at runtime
- **Date:** 2026-05-31 · **Area:** backend / Supabase
- **What:** T-042 adds `supabase/migrations/20260531100000_phase3_streaks.sql` (the
  `challenge_streak` RPC). Until applied, the streak stat cards on the challenge-detail screen
  won't load (the RPC won't exist → `getChallengeStreak` errors, cards hidden). Apply via Dashboard
  → SQL editor → Run. Idempotent (`create or replace`).
- **Depends on:** the Phase 2 + Phase 3-verification migrations already applied (it reads
  `submissions.status='verified'`). Apply W-014 first if not done.
- **Verify:** `select challenge_streak('<a challenge id you participate in>'::uuid);` returns
  `{"current":N,"longest":M,"today_done":bool}`.
- **Smoke-test:** on a solo challenge submit a proof (auto-verifies) → streak shows 🔥 1; submit on
  consecutive days → increments; skip a day → resets. On a group challenge the streak only counts
  days a friend approved.
- **Status:** Open until applied.

## [OPEN] W-014 — Phase 3 needs: apply the verification migration before verify works at runtime
- **Date:** 2026-05-31 · **Area:** backend / Supabase
- **What:** Phase 3 (T-040) is code-complete and passes tsc/lint/expo-doctor, but the verify flow
  fails at runtime until the new migration is applied:
  `supabase/migrations/20260531000000_phase3_verification.sql`. Paste the whole file into
  Supabase Dashboard → SQL editor → Run. It is idempotent (`create ... if not exists`,
  `create or replace`, `drop policy if exists`) and safe to re-run.
- **What it changes:** adds the `verifications` table + `verify_submission` RPC, **replaces**
  `submit_proof` so **solo proofs auto-verify** (D-009), and **widens the `proof-media` storage
  SELECT policy** so a verifier can view a co-participant's photo (Phase 2 deferred this).
- **Order note:** the storage policy depends on the `proof-media` bucket already existing
  (W-011, done). No new bucket needed.
- **Verify:** `select count(*) from verifications;` (→ 0) and
  `select pg_get_functiondef('public.verify_submission'::regproc);` returns SQL.
- **Smoke-test after applying:**
  - [ ] solo challenge: submit a proof → status reads **Verified** immediately (auto-verify).
  - [ ] group challenge with a 2nd member: member A submits → member B opens the challenge,
        sees A's pending proof with a **Verify proof** button → taps → sees the photo →
        **Approve** → A's proof flips to **Verified**.
  - [ ] **Reject** path flips to **Rejected**.
  - [ ] you do NOT see a Verify button on your own pending proof; the RPC also rejects self-verify.
- **Status:** Open until applied.

## [RESOLVED] W-011 — Phase 2 needs: apply migration + create Storage bucket + (re)install deps
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
- **Status:** RESOLVED 2026-05-31 — USER confirmed migration applied, `proof-media` bucket
  created, and the Phase 2 create-challenge / submit-proof loop smoke-tested on-device.

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

## [RESOLVED] B-010 — `create policy if not exists` is invalid PostgreSQL syntax (W-019 migration)
- **Date:** 2026-06-01 · **Area:** Supabase / RLS
- **What:** The W-019 migration used `create policy if not exists ...` on three policies
  (`reports_select_own`, `blocks_select_own`, `adr_select_own`). PostgreSQL doesn't support
  `IF NOT EXISTS` on `CREATE POLICY`. A first apply might silently land on some Postgres
  versions but a re-apply (idempotency goal) would fail with a syntax error.
- **Fix:** Replaced each with the supported idempotent pattern:
  ```sql
  drop policy if exists <name> on <table>;
  create policy <name> on <table> for select using (...);
  ```
  Also fixed the header comment that falsely claimed `create policy if not exists` was used.
- **Detected by:** User-reported review of the SQL file before applying.
- **Commit:** `feat(safety): add moderation and account deletion UI`.

## [OPEN] W-019 — Apply Phase 4A migration (account controls + moderation infra)
- **Date:** 2026-06-01 · **Area:** backend / Supabase
- **What:** Single migration `supabase/migrations/20260601100000_phase4a_user_control_safety.sql`
  adds archive columns + RPCs (`leave_group`, `archive_group`, `archive_challenge`) and
  trust/safety **infra** (reports/blocks/account_deletion_requests tables + their RPCs +
  `is_blocked_by_me` helper). **Idempotent.**
- **Apply via:** Supabase Dashboard → SQL editor → paste the file's contents → Run. Order
  doesn't matter against Phase 3 + W-018.
- **Why ship the trust/safety tables/RPCs now even though their UI is deferred?** They're
  cheap to ship server-side and the UI work (Phase 4A-2) just needs the client wrappers; this
  way the user only applies one migration. The unused RPCs sit dormant until 4A-2.
- **Status:** Open until applied. (Migration syntax fix for B-010 included; safe to re-apply.)

## [OPEN] W-021 — Blocked-user filter is client-side and partial
- **Date:** 2026-06-01 · **Area:** trust/safety / RLS
- **What:** Phase 4A-2 ships a `useBlockedUserIds()` Set-based client-side filter and applies
  it on the submission detail screen (whole-screen hide) and the challenge detail's
  recent-submissions list. It does NOT filter:
  - leaderboard rows (`group_leaderboard` RPC returns all members)
  - submission comments (`submission_comments` reads)
  - reactions (aggregated; identity not surfaced)
- **The right long-term fix:** widen the SELECT RLS policies on `submissions`,
  `submission_reactions`, and `submission_comments` to add
  `AND NOT is_blocked_by_me(author_id)`. The `is_blocked_by_me` SECURITY DEFINER helper is
  already deployed by W-019; this is a small future migration. Doing the filtering
  client-side everywhere would be brittle and easy to forget on new surfaces.
- **Status:** Acceptable for MVP; tighten before public beta.

## [OPEN] W-020 — Password-reset deep link needs Supabase URL allow-listed
- **Date:** 2026-06-01 · **Area:** auth / deep linking
- **What:** Phase 4A-1 forgot-password sends an email whose link points at
  `basta://reset-password?code=…`. Supabase will REJECT a `redirectTo` that isn't in the
  project's allowed list — so the email will either go to a default URL or fail to send.
- **Fix (USER, one-time):** Supabase Dashboard → **Authentication → URL Configuration →
  Redirect URLs** → add `basta://reset-password` (and optionally a wildcard `basta://**`
  for future deep-link routes) → Save.
- **Without it:** the `forgot-password` form will succeed-looking (the API call may not
  error), but the email link won't open the app correctly. The `reset-password` screen
  detects a missing `code` param and shows a clear hint pointing here.
- **Status:** Open until configured.

## [OPEN] W-018 — Apply migration to switch invite codes to 4-digit numeric
- **Date:** 2026-05-31 · **Area:** backend / Supabase
- **What:** New migration `supabase/migrations/20260601000000_short_invite_codes.sql` swaps
  group invite codes from 12-char hex to **4-digit numeric** (e.g. `1023`, `0490`). Defines
  `generate_short_invite_code()` (retries up to 30 times on collision), changes the column
  default, and regenerates existing groups' codes. Idempotent / safe to re-run.
- **Apply via:** Supabase Dashboard → SQL editor → paste the file's contents → Run. Order
  doesn't matter relative to Phase 3 migrations.
- **Side effect:** existing invite codes change. Friends with the old hex code can no longer
  join — share the new (now displayed) 4-digit code instead.
- **Client side:** `inviteCodeSchema` already tightened to `/^\d{4}$/`; the join-or-create
  form now uses a number-pad keyboard with `maxLength=4` and strips non-digits.
- **Status:** Open until applied.

## [RESOLVED] B-009 — Gate over-redirected onboarded users out of Phase 2/3 sub-routes
- **Date:** 2026-05-31 · **Area:** navigation / onboarding gate
- **What:** `isAtTarget(segments, '/(tabs)')` returned `true` only when the user was literally
  inside the `(tabs)` group. So when an onboarded user tapped "+ New" on Challenges (which
  pushes `/challenge/new`) or any other route added in Phase 2/3 (`/group/[id]`,
  `/submission/[id]`, `/verify/[submissionId]`, `/challenge/[id]/submit-proof`), the segments
  became `['challenge','new']` etc., `isAtTarget` returned `false`, and the layout's
  redirect-effect fired `router.replace('/(tabs)')` — bouncing the user back to Today.
  User-visible symptom: "Aside from 4 tabs and Sign out, nothing works — everything redirects
  back to Today."
- **Fix:** `isAtTarget(segments, '/(tabs)')` now returns true for any segment group that isn't
  `(auth)` or `(onboarding)` — i.e. "you're in the app proper". The (auth) and (onboarding)
  branches are unchanged. Layered redirect-loop guard intact.
- **Why the original was wrong:** The redirect matrix in the doc comment is correct (a
  fully-onboarded user "lives in /(tabs)"), but the comparison was too strict — it conflated
  "your home group" with "the only place you're allowed to be." Sub-routes that exist OUTSIDE
  the (tabs) group (push/modal screens, detail screens) are still legitimate signed-in routes.
- **Commit:** `fix(gate): allow signed-in users to navigate to non-tabs sub-routes`.

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
