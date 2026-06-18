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

## [OPEN] W-040 — Apply the THREE privacy/Global migrations BEFORE running the new build (D-014)
- **Date:** 2026-06-13 (updated 2026-06-18 for the Global feed migration) · **Area:** backend / Supabase
- **What:** FIVE migrations are pending, apply **in order**:
  `20260614000000_visibility_foundation.sql` → `20260615000000_privacy_enforcement.sql` →
  `20260616000000_global_feed_v1.sql` → `20260617000000_global_feed_hardening.sql` →
  `20260618000000_simplify_visibility_model.sql`. `20260616`/`20260617` build the Global feed +
  hardening. `20260618` **simplifies the model**: flips `profiles/groups/challenges.visibility`
  defaults to `'public'`, adds `submissions.hidden_from_global` (backfilled from the now-deprecated
  `is_public`), recreates `is_submission_globally_visible` (no `is_public` gate; uses
  `hidden_from_global`), and flips `create_group`/`create_challenge` to default public. The new
  client removed the proof-composer "Share to Global" toggle + write-path `isPublic`.
- **Testing gotcha:** after `20260618`, existing test profiles/challenges keep their OLD value
  (private) and ALL existing proofs are backfilled `hidden_from_global=true`. So Global will look
  empty for old data — make a profile public + a challenge visible and submit a NEW proof, or flip
  existing test rows to public in the dashboard.
  `20260614` adds `visibility`/`is_public` columns; the client references them in **base `select`
  lists** (`PROFILE_SELECT`, group/challenge `COLUMNS`, submission selects), so against an un-migrated
  DB **every read of those tables 400s** (`column "visibility" does not exist`). `20260615` then drops
  the broad `profiles_select_public`, recreates `create_group`/`update_group_meta` signatures, and
  re-gates the social RPCs — the new client expects those (e.g. `get_viewable_profile`, the
  `create_group` `p_visibility` arg, `update_group_meta` `p_clear_avatar`).
- **Fix:** USER applies BOTH migrations FIRST (Dashboard SQL editor or `supabase db push`), THEN runs
  the build. Idempotent. If applied via the Dashboard, reload the PostgREST schema cache afterward
  (Dashboard → API → Reload schema) so the new RPC signatures are picked up. No new buckets/secrets.
- **Upgrade-window note:** RPC param additions all have DEFAULTs and UPDATE RPCs coalesce to the
  existing value, so an OLD client that omits a new arg is non-destructive. Only the base-select reads
  (20260614) are strictly apply-order-sensitive.
- **Proof-media casts now hardened:** `20260615` regex-guards the path→uuid casts in
  `storage_proof_media_select`, so a malformed object name can no longer error the policy (closes the
  theoretical cast-error noted originally). Bucket stays private; eligible global viewers load images
  via the existing signed-URL flow.
- **Status:** Open until USER confirms BOTH migrations are applied on `ycbesrmtlcippgpswzta`.

## [RESOLVED] B-priv1 — Private profiles were world-readable; avatar removal was a no-op
- **Date:** 2026-06-13 · **Area:** privacy / RLS + client
- **Was wrong:** (1) `profiles_select_public USING (true)` let any authed user read EVERY profile
  (all columns) — `visibility='private'` did nothing. (2) Profile + group avatar *removal* silently
  did nothing: the screens collapsed `null → undefined` (`avatarPath ?? undefined`) so the update
  meant "keep", and `update_group_meta` used `coalesce(p_avatar_path, avatar_path)` which can't clear.
- **Fixed by:** `20260615000000_privacy_enforcement.sql` (drop broad policy + `get_viewable_profile`;
  `update_group_meta.p_clear_avatar`) and client edits (`fetchPublicProfile` → RPC; `profile/edit` +
  `group/edit` pass the 3-state through; `updateGroupMeta` sends `p_clear_avatar`). See PRIVACY_MODEL.md.
- **Status:** Resolved in code; verify with the PRIVACY_MODEL.md smoke-test once migrations are applied.

## [OPEN] W-039 — Backend moved to a NEW Supabase project; each Claude must reconfigure `.env`
- **Date:** 2026-06-11 · **Area:** environment / Supabase
- **What:** The backend was migrated to a fresh project **`ycbesrmtlcippgpswzta`**
  (`https://ycbesrmtlcippgpswzta.supabase.co`), **replacing `lppfqzqeaizbzunrxnpn`**.
  The bootstrap schema is applied + verified live there (anon REST `profiles`/`groups`
  → `HTTP 200 []`). The DB is empty (no seed data).
- **Trap:** `.env` is **gitignored and machine-local** — it does NOT travel between the
  two Claude accounts. If your local `.env` still points at the old project (or is
  missing), the app talks to the wrong/empty backend.
- **Fix (per machine):** set in `.env` —
  `EXPO_PUBLIC_SUPABASE_URL=https://ycbesrmtlcippgpswzta.supabase.co` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY=<new project's anon key>` (Dashboard → Settings → API),
  then `npx expo start --clear` (Metro inlines env at build time). Anon key is public/safe
  (W-005) but **never commit `.env`**.
- **Note:** This session's harness hard-blocks all tool access to `.env*` (a secrets
  guardrail), so an AI session cannot write `.env` for you — the USER must.
- **Status:** Open until both machines + on-device smoke test confirm the new project.

## [OPEN] BOOTSTRAP — Apply the consolidated migration + recreate Storage buckets + secrets
> **2026-06-11 UPDATE:** the bootstrap has now been **APPLIED to the new project
> `ycbesrmtlcippgpswzta`** and the schema is verified live (anon REST). Storage buckets,
> Edge Function deploy + secret, and `npx eas init` are STILL pending USER confirmation
> on the new project. See W-039 above for the `.env` reconfiguration.
- **Date:** 2026-06-11 · **Area:** backend / Supabase + Storage + Edge Functions
- **Single migration file:** `supabase/migrations/20260528000000_bootstrap.sql`.
  This ONE migration replaces W-010 … W-038 (the 25 prior incremental
  migrations were deleted from the repo). Apply via Dashboard → SQL editor
  or `supabase db push`. Idempotent.
- **All [OPEN] `W-0NN — Apply ...` entries below are ARCHIVED-IN-BOOTSTRAP.**
  They describe historical migrations that were folded into the bootstrap.
  Do NOT try to re-apply them individually — they no longer exist as files.
  Use git history (`git log --all -- supabase/migrations/`) to inspect the
  original deltas if needed.
- **Storage buckets** (USER must create in Dashboard → Storage):
  - `proof-media` — Public: **OFF** (RLS policies in the bootstrap grant
    own-folder INSERT + co-participant SELECT)
  - `group-avatars` — Public: **ON** (public read; owner-only writes)
  - `user-avatars` — Public: **ON** (public read; self-only writes/deletes)
- **Edge Function** (T-050B): `npx supabase secrets set DISPATCH_PUSH_SECRET=<long-random>`
  then `npx supabase functions deploy dispatch-pushes --no-verify-jwt`.
  Without these, verification-flow push triggers enqueue rows but nothing
  consumes them.
- **EAS projectId** (T-050A): `npx eas init` if `app.json` lacks
  `expo.extra.eas.projectId`.
- **Auth email template:** must contain `{{ .Token }}` (W-008). The mobile
  PKCE flow uses the 6-digit token, not the magic link URL.

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

## [INFO] W-031 — `profile_description_and_avatars` (historical; do NOT reuse)
- **Date:** 2026-06-05 · **Area:** backend / Supabase
- **What:** `supabase/migrations/20260605000000_profile_description_and_avatars.sql`
  added `profiles.description`, widened `profiles` SELECT for authenticated users,
  and set up Storage RLS for the public `user-avatars` bucket. Originally tagged
  W-031 in its own migration header + the 2026-06-05 HANDOFF entry, but never
  registered in this index — T-050A's push_tokens migration accidentally re-claimed
  W-031. This tombstone exists so future migrations don't re-collide. W-031 is now
  RETIRED.
- **Apply via:** Supabase Dashboard → SQL editor (idempotent — safe to re-apply).
  Also: create the public `user-avatars` Storage bucket.

## [OPEN] W-038 — Apply streak-aggregate migration (T-053-E)
- **Date:** 2026-06-11 · **Area:** backend / Supabase
- **What:** `supabase/migrations/20260608400000_streak_aggregate.sql` adds
  `get_my_streak_aggregate()` RPC returning `{current_streak, best_streak}`.
  Best uses a gaps-and-islands query over the caller's verified days; current
  reuses the home_overview anchor-and-walk. SECURITY DEFINER + grant to
  authenticated. NO existing surface changes.
- **Apply via:** Supabase Dashboard → SQL editor (or `supabase db push`).
- **Client coupling:** `useMyStreakAggregate` on the Profile tab calls this
  RPC. Without W-038 applied, the streak tiles render `0 / 0`.

## [OPEN] W-037 — Apply group_leaderboard avatar widening (T-053-D)
- **Date:** 2026-06-11 · **Area:** backend / Supabase
- **What:** `supabase/migrations/20260608300000_leaderboard_avatars.sql`
  DROPs + recreates `group_leaderboard(uuid)` to add `avatar_url` to
  RETURNS TABLE. CREATE OR REPLACE can't change the return shape.
- **Apply via:** Supabase Dashboard → SQL editor (or `supabase db push`).
- **Client coupling:** the leaderboard API reads `avatar_url` from each row
  and the new LeaderboardRow renders an avatar between the rank # and the
  name. Without W-037 applied, avatars fall back to initials (no crash, just
  no photos on the board).

## [OPEN] W-036 — Apply free-form reactions migration (T-053-C)
- **Date:** 2026-06-11 · **Area:** backend / Supabase
- **What:** `supabase/migrations/20260608200000_freeform_reactions.sql`
  widens the `submission_reactions.emoji` CHECK from `1..8` → `1..32` chars
  so multi-codepoint ZWJ emojis (skin tones, family) fit; adds
  `list_submission_reactors(p_submission_id, p_emoji)` RPC for the
  long-press reactors popover. SECURITY DEFINER + grant to authenticated.
- **Apply via:** Supabase Dashboard → SQL editor (or `supabase db push`).
- **Client coupling:** the rewritten `ReactionBar` calls
  `list_submission_reactors` on long-press and the user picks an emoji from
  the rn-emoji-keyboard picker; some of those emojis exceed 8 chars and
  would be rejected by the old CHECK constraint.
- **Dep note:** `rn-emoji-keyboard` was installed with a **one-off**
  `npm install ... --legacy-peer-deps` (recurring W-013 ERESOLVE around
  react-dom/react peers). NOT added to `.npmrc` per the project rule —
  prefer the clean reinstall workflow when `node_modules/` need a redo.

## [OPEN] W-035 — Apply comment-likes migration (T-053-B)
- **Date:** 2026-06-11 · **Area:** backend / Supabase
- **What:** `supabase/migrations/20260608100000_comment_likes.sql` creates
  `submission_comment_likes` (`(comment_id, user_id)` PK; ON DELETE CASCADE
  against both parents) + RLS read-allowed when the caller is a challenge
  participant of the comment's parent submission. Adds three SECURITY
  DEFINER RPCs: `like_comment`, `unlike_comment`, `list_comment_likers`.
  Also adds `list_submission_comments(p_submission_id)` which bundles
  author display + per-row `likes_count` + `liked_by_me` so the client
  doesn't N+1.
- **Apply via:** Supabase Dashboard → SQL editor (or `supabase db push`).
- **Client coupling:** the rewritten `CommentsSection` calls
  `list_submission_comments`. Without W-035 applied, the comments query
  fails with "function does not exist".

## [OPEN] W-034 — Apply submission-titles migration (T-053-A)
- **Date:** 2026-06-11 · **Area:** backend / Supabase
- **What:** `supabase/migrations/20260608000000_submission_titles.sql` adds
  `submissions.title text NOT NULL` (CHECK 1..80 chars) and recreates 5 RPCs to
  thread / return the new column: `submit_proof`, `redact_my_submission`,
  `list_challenge_submissions`, `get_submission_with_author`, `get_my_today_submission`.
  All recreated with DROP + CREATE because parameter lists / RETURNS TABLE shapes
  change (CREATE OR REPLACE wouldn't suffice).
- **Backfill:** existing rows get `title = 'Day ' || (challenge_day + 1)`. Idempotent —
  the UPDATE is gated on `title IS NULL` and the CHECK constraint is dropped + re-added.
- **Apply via:** Supabase Dashboard → SQL editor (or `supabase db push`).
- **Client coupling:** the W-034 migration MUST go in before / with the matching
  client deploy. Pre-W-034 mobile builds calling `submit_proof` with the old
  4-arg signature will get `function ... does not exist`. The current mvp branch is
  already updated; if you roll back without re-applying the column drop, the new
  client crashes on submit. Both move together.
- **Queue safety:** for jobs queued pre-W-034 (legacy `SubmitProofPayload` without
  `title`), the processor substitutes `'Untitled'` to clear the upgrade window
  (`src/offline/queue/processor.ts`). After everyone has submitted at least once
  post-W-034, that fallback is dead code but harmless.

## [OPEN] W-033 — Apply notification_outbox + dispatch RPCs migration + deploy `dispatch-pushes` Edge Function + set DISPATCH_PUSH_SECRET (T-050B)
- **Date:** 2026-06-07 (hardened 2026-06-08) · **Area:** backend / Supabase + Edge Functions
- **What:** `supabase/migrations/20260607000000_notification_outbox_and_dispatch.sql`
  adds the `notification_outbox` table, the two enqueue triggers (verify_needed on
  AFTER INSERT submissions; verify_result on AFTER UPDATE OF status), four SECURITY
  DEFINER dispatch RPCs (`claim_pending_notifications`, `mark_notification_sent`,
  `mark_notification_failed`, `revoke_push_token`), and tightens the W-032 register/
  unregister RPC grants (revoke from PUBLIC, explicit grant to authenticated). The
  dispatch RPCs are restricted to the Supabase elevated role — PUBLIC/anon/authenticated
  have NO execute rights, so even a leaked anon key can't drain the outbox.
- **Depends on W-032 (push_tokens) AND W-019 (blocks table).** Apply both first.
- **Edge Function (hardened on 2026-06-08):**
  - Per-outbox aggregation (multi-device bug fix). The function used to write
    mark_failed inline per ticket; a DeviceNotRegistered ticket from one device
    could permanently fail an outbox before a sibling device's OK ticket arrived.
    The function now runs phase-1 (collect tickets across ALL batches) and
    phase-2 (one final status per outbox: any OK → sent; else allRetryable →
    failed retryable; else → failed terminal). DeviceNotRegistered still revokes
    the token but no longer decides the outbox status on its own.
  - Shared-secret gate. The function is deployed `--no-verify-jwt` (so cron +
    `supabase functions invoke` don't need a user JWT), so callers MUST send
    the header `x-dispatch-secret: <DISPATCH_PUSH_SECRET>`. Missing/mismatched
    → 401. Function-side missing → 500 (deliberate hard fail).
- **USER actions (in order):**
  1. Apply W-032 (T-050A push_tokens) if not already.
  2. Apply W-019 (Phase 4A blocks table) if not already — the verify_needed
     trigger queries `public.blocks`.
  3. Apply W-033: paste `20260607000000_notification_outbox_and_dispatch.sql`
     into the Supabase SQL editor.
  4. Set the dispatch secret on the function:
     `npx supabase secrets set DISPATCH_PUSH_SECRET=<long-random-secret>`.
     Generate one e.g. `openssl rand -base64 48` (or any high-entropy generator).
  5. Deploy the function:
     `npx supabase functions deploy dispatch-pushes --no-verify-jwt`.
     The function uses the project's service-role key from its secrets —
     **never bundle that key with the mobile app.** Optional:
     `npx supabase secrets set EXPO_ACCESS_TOKEN=...` to raise rate limits.
  6. Still pending from T-050A: if `app.json` lacks
     `expo.extra.eas.projectId`, run `npx eas login` then `npx eas init`. Until
     that runs, the mobile push service no-ops on every launch.
- **Type-check the function outside of deploy:**
  `deno check supabase/functions/dispatch-pushes/index.ts`.
  (Requires Deno installed locally. Supabase's deploy step also type-checks; this
  command is what to use when iterating without redeploying. `npm run typecheck`
  excludes `supabase/functions/**` because the function uses Deno globals + `npm:`
  specifiers that the Node/Expo TS pipeline can't resolve.)
- **Manual test (after deploy + secret set):** with two test accounts in the same
  group on EAS dev builds, submit a proof from account A. From a terminal:
  ```
  curl -X POST <FUNCTION_URL> -H "x-dispatch-secret: <DISPATCH_PUSH_SECRET>"
  ```
  Or `npx supabase functions invoke dispatch-pushes --no-verify-jwt -H
  "x-dispatch-secret: <DISPATCH_PUSH_SECRET>"`. Account B's device should
  receive a "Proof needs review" notification within seconds. When B verifies,
  invoke again — A should receive "Your proof was verified".
- **NOT in this slice:** preferences UI, quiet hours, daily cap, daily reminder /
  streak-at-risk categories, pg_cron schedule, pg_net invocation, tap deep-links.
  All of those land in T-050C.
- **Status:** Open until migration is applied, secret is set, AND the Edge
  Function is deployed.

## [OPEN] W-032 — Apply push_tokens migration + run `npx eas init` for the projectId (T-050A)
- **Date:** 2026-06-06 (renumbered from W-031 on 2026-06-07) · **Area:** backend +
  tooling
- **What:** `supabase/migrations/20260606000000_push_tokens.sql` adds the `push_tokens`
  table (own-row SELECT RLS, no direct writes), `register_push_token(token, platform,
  device_name)` and `unregister_push_token(token)` SECURITY DEFINER RPCs. Idempotent
  (CREATE TABLE IF NOT EXISTS + CREATE OR REPLACE on the two functions).
- **Apply via:** Supabase Dashboard → SQL editor → paste → Run. No ordering vs other
  open migrations.
- **Also (one-time, tooling):**
  1. Run `npx eas login` once with the Expo account that owns this project.
  2. Run `npx eas init` inside the repo to mint a projectId. This writes
     `expo.extra.eas.projectId` into `app.json`. Until that step runs, the push service
     no-ops with a console.info on every launch.
- **Build for real-device testing:** `npx eas build --profile development --platform ios`
  (or `android`). The `development` profile in `eas.json` uses `developmentClient: true`
  so the resulting binary still runs against the JS dev server.
- **Notification icon placeholder:** `app.json` registers
  `["expo-notifications", { "color": "#6C5CE7" }]` — no `icon` asset yet. Expo will
  fall back to the app icon for now. Drop a 96×96 white-on-transparent PNG at
  `./assets/notification-icon.png` and add `"icon": "./assets/notification-icon.png"`
  to the plugin entry before shipping the production build.
- **Defaults for T-050B/C** (documented here so the next slice picks them up):
  quiet hours `22:00–08:00` per `profiles.timezone`, daily cap `5` push deliveries.
- **Status:** Open until the migration is applied AND `eas init` has been run.

## [OPEN] W-019 — Apply Phase 4A migration (account controls + moderation infra + restore_group)
- **Date:** 2026-06-01 (updated 2026-06-02 for T-026) · **Area:** backend / Supabase
- **What:** Single migration `supabase/migrations/20260601100000_phase4a_user_control_safety.sql`
  adds archive columns + RPCs (`leave_group`, `archive_group`, `archive_challenge`,
  **`restore_group`** — appended by T-026) and trust/safety **infra**
  (reports/blocks/account_deletion_requests tables + their RPCs + `is_blocked_by_me` helper).
  **Idempotent.**
- **Apply via:** Supabase Dashboard → SQL editor → paste the file's contents → Run. Order
  doesn't matter against Phase 3 + W-018.
- **Why ship the trust/safety tables/RPCs now even though their UI is deferred?** They're
  cheap to ship server-side and the UI work (Phase 4A-2) just needs the client wrappers; this
  way the user only applies one migration. The unused RPCs sit dormant until 4A-2.
- **Why edit the existing file for T-026 instead of a new migration?** The file is still
  OPEN (unapplied), so the user pays the same one-paste cost either way and we avoid an
  extra file. Safe because the migration is idempotent on the parts already present.
- **Status:** Open until applied. The Restore button on `app/group/archived.tsx` will fail
  with `function does not exist` until then.

## [OPEN] W-028 — Apply patch migration: fix get_my_today_submission column ambiguity
- **Date:** 2026-06-04 · **Area:** backend / Supabase
- **What:** `supabase/migrations/20260604200000_fix_today_submission_ambiguity.sql`
  recreates `get_my_today_submission` with qualified column references (resolves B-013).
  Idempotent — applies cleanly on top of W-027.
- **Apply via:** Supabase Dashboard → SQL editor → paste → Run. No ordering vs other
  open migrations (but must come AFTER W-027 since this is a CREATE OR REPLACE on a
  function W-027 introduced).
- **Status:** Open until applied. Until then, opening any challenge detail screen will
  log `[basta] getMyTodaySubmission failed: { code: "42702", message: "column reference
  'id' is ambiguous" }` and the screen falls into its error state.

## [OPEN] W-029 — Apply migration: Home overview RPCs
- **Date:** 2026-06-05 · **Area:** backend / Supabase
- **What:** `supabase/migrations/20260604300000_home_overview.sql` adds `get_home_overview()` and
  `list_pending_verifications_for_me()` — the Home ("Today") tab's streak / week / today / pending-
  verification counts + the "Verify a friend" inbox (`app/verifications.tsx`). Tz-correct (D-010).
  Idempotent (CREATE OR REPLACE).
- **Apply via:** Supabase Dashboard → SQL editor → Run. Reads existing tables (submissions,
  challenges, verifications, group_members).
- **Status:** Open until applied. Before then the Home tab shows zeros and the Verify inbox shows
  "Nothing to verify" — no crash (the query just errors and the screen degrades).

## [OPEN] W-030 — Apply migration + create bucket: group profile (description + photo avatar)
- **Date:** 2026-06-05 · **Area:** backend / Supabase / Storage
- **What:** `supabase/migrations/20260604400000_group_profile.sql` adds `groups.description` +
  `groups.avatar_path`, RPCs `get_group_overview()` + `update_group_meta()`, and Storage RLS for a
  public `group-avatars` bucket. `create_group` / `update_group` are left UNCHANGED (additive — see
  D-012), so group create/rename keep working before this is applied.
- **USER actions (BOTH required):**
  1. Apply the migration (SQL editor → Run).
  2. **Create a PUBLIC bucket `group-avatars`** (Dashboard → Storage → New bucket → Public: ON).
- **Status:** Open until applied. Before then: group **create still works** (name only); the photo
  avatar + description silently don't save, and the group's Main-info tab shows partial data.

## [RESOLVED] B-013 — `column reference "id" is ambiguous` on get_my_today_submission
- **Date:** 2026-06-04 · **Area:** backend / Supabase
- **Repro:** Open any challenge detail screen with W-027 applied. Console logs the 42702
  error from `getMyTodaySubmission`.
- **Root cause:** `get_my_today_submission` declares OUT params via
  `returns table (id uuid, challenge_id uuid, ...)`. Inside the plpgsql function body
  those OUT params are in scope as variables. The body's profile lookup was
  `where id = v_uid` (unqualified). PostgreSQL can't decide whether `id` is the
  `profiles` column or the OUT param and raises 42702. The fault was the unqualified
  reference — other table-returning RPCs I added in the same migration (`list_challenge_streaks`)
  qualify everything; only `get_my_today_submission` had the bug.
- **Fix:** Qualified the offending lines: `where profiles.id = v_uid` and
  `where challenges.id = p_challenge_id`. Re-issued as a fresh patch migration
  (`20260604200000_fix_today_submission_ambiguity.sql`) so the apply-trail is explicit.
- **Why it didn't show in the prior identical-shape RPCs** (`get_submission_with_author`,
  `list_challenge_submissions`): those queries prefixed every column reference with the
  table alias (`s.id`, `p.id`, etc.). Only `get_my_today_submission` had unqualified refs.
- **Commit:** `fix(challenges): qualify column refs in get_my_today_submission + status
  bar polish`.

## [OPEN] W-027 — Apply patch migration: challenge today/streaks/redact
- **Date:** 2026-06-04 · **Area:** backend / Supabase
- **What:** `supabase/migrations/20260604100000_challenge_today_and_redact.sql` adds three
  SECURITY DEFINER RPCs feeding the revamped challenge detail screen:
  * `get_my_today_submission(p_challenge_id)` — fixes the day-rollover bug. Previously
    `getMyTodaySubmission` returned the **latest** submission regardless of day, so after
    midnight with no new submission the button still said "Add another (replaces today)"
    referencing yesterday's row. The new RPC computes today's `challenge_day` per the
    caller's profile timezone (matches `submit_proof` math exactly) and returns only the
    matching row.
  * `list_challenge_streaks(p_challenge_id)` — per-participant `{current, longest,
    today_done}` for the "Other contestants" ribbon. Group: every group member. Solo:
    just the caller. Participant-gated (uses the W-022 widened helper).
  * `redact_my_submission(p_submission_id, p_media_path, p_comment)` — author-only
    in-place edit. Group: locked when status='verified'; otherwise clears all
    `verifications` votes and resets status to `pending_verification` so the new content
    is re-verified. Solo: only same-day edits (challenge_day must match the caller's
    today). Not-archived guard.
- **Apply via:** Supabase Dashboard → SQL editor → paste → Run. Idempotent
  (CREATE OR REPLACE on all three). No ordering vs other open migrations.
- **Status:** Open until applied. Until then: the challenge detail screen falls through to
  error states (RPCs `does not exist`); the Edit submission button fails on tap; the
  contestants ribbon stays hidden (RPC errors silently in the query).

## [OPEN] W-025 — Apply patch migration: transfer group leadership
- **Date:** 2026-06-03 · **Area:** backend / Supabase
- **What:** `supabase/migrations/20260603300000_transfer_group_leadership.sql` adds the
  `transfer_group_leadership(p_group_id, p_new_owner_id)` SECURITY DEFINER RPC. Owner-only,
  not-archived, new owner must be an existing member and cannot be the caller. Flips
  `groups.owner_id` AND demotes/promotes the corresponding `group_members.role` rows in
  one transaction.
- **Apply via:** Supabase Dashboard → SQL editor → paste → Run. Idempotent
  (CREATE OR REPLACE). No ordering vs other open migrations.
- **Status:** Open until applied. Tapping a leaderboard row as owner will fail with
  `function does not exist` until then.

## [OPEN] W-026 — Apply migration: secure (12-char) invite codes
- **Date:** 2026-06-04 · **Area:** backend / Supabase / security
- **What:** `supabase/migrations/20260604000000_secure_invite_codes.sql` replaces the weak
  4-digit invite codes (W-018 — 10,000 combinations, brute-forceable) with **12-char base62**
  `[A-Za-z0-9]` codes (62^12 ≈ 3.2×10^21) generated from `gen_random_bytes`. Adds
  `generate_invite_code()`, switches the `groups.invite_code` default, regenerates any code that
  isn't already 12-char base62, and adds a CHECK constraint so a weak code can't be inserted
  again. Codes are **case-sensitive**.
- **Apply via:** Supabase Dashboard → SQL editor → paste → Run. Idempotent (the regen only
  touches non-conforming codes; the CHECK is dropped-then-added). **Apply this INSTEAD of W-018.**
- **Side effect:** existing 4-digit codes change — share the new 12-char code. The
  `join_group_by_invite` RPC is unchanged (already an exact `invite_code = p_code` comparison).
- **Decision:** see DECISIONS.md **D-011**.
- **Status:** Open until applied.

## [RESOLVED] B-012 — Edit-group input rehydrated when backspaced to empty
- **Date:** 2026-06-03 · **Area:** frontend / `app/group/[id]/edit.tsx`
- **What:** The original hydration effect re-seeded `name` from `group.name` whenever
  `name === ''`, so backspacing to clear silently refilled with the previous name —
  making "clear and retype" hard. Replaced with a one-shot `hydrated` flag (initialized
  to `true` if `group` is already available at mount). After the seed, user edits are
  left alone.
- **Commit:** `feat(groups): group leader badge + transferable leadership`.

## [OPEN] W-024 — Apply patch migration: in-place edit of group + challenge metadata
- **Date:** 2026-06-03 · **Area:** backend / Supabase
- **What:** `supabase/migrations/20260603200000_update_group_and_challenge.sql` adds two
  SECURITY DEFINER RPCs:
  * `update_group(p_group_id, p_name)` — owner-only, not-archived guard, 1–60 char
    name validation.
  * `update_challenge(p_challenge_id, p_title, p_category, p_duration_days,
    p_proof_requirement)` — creator-only, not-archived guard, allow-list category
    (`fitness`, `reading`, `meditation`, `creativity`, `study`, `language`, `work`,
    `other`), duration ∈ [1, 365], title ≤100, proof requirement ≤280. Duration shrink
    is rejected if it would orphan an existing submission (`new_duration < max(challenge_day)+1`).
- **Apply via:** Supabase Dashboard → SQL editor → paste → Run. Idempotent
  (CREATE OR REPLACE on both). No ordering vs other open migrations.
- **What's NOT editable** (intentional — would invalidate existing submissions):
  `challenges.start_date`, `mode`, `group_id`, `verification_threshold`. If a creator
  needs different start/mode they can archive + create a new challenge.
- **Status:** Open until applied. Without it, the Edit buttons on group + challenge
  detail screens will fail with `function does not exist`.

## [OPEN] W-023 — Apply patch migration: surface submission author display name
- **Date:** 2026-06-03 · **Area:** backend / Supabase
- **What:** `supabase/migrations/20260603100000_submission_authors.sql` adds two
  SECURITY DEFINER RPCs — `list_challenge_submissions(p_challenge_id, p_limit)` and
  `get_submission_with_author(p_submission_id)` — that return submissions with the
  author's `username` + `display_name` joined in. Both are participant-gated (use the
  W-022 widened helper), so outsiders still get nothing. Idempotent (CREATE OR REPLACE).
- **Apply via:** Supabase Dashboard → SQL editor → paste the file's contents → Run.
  No order constraint vs other open migrations.
- **Why RPCs instead of widening `profiles` RLS:** the leaderboard already follows this
  pattern; an RPC exposes exactly two columns (`username`, `display_name`) per author
  and keeps `timezone`/`onboarded`/`terms_version` private. Broader profile widening can
  come later if more screens need it.
- **Status:** Open until applied. Without it, both `listSubmissionsForChallenge` and
  `getSubmission` will fail with `function does not exist` and the challenge detail +
  submission detail screens will show their error states.

## [OPEN] W-022 — Apply patch migration: treat group members as challenge participants
- **Date:** 2026-06-03 · **Area:** backend / Supabase
- **What:** `supabase/migrations/20260603000000_group_member_is_participant.sql`
  widens the `is_challenge_participant(uuid)` helper so that group members count as
  participants for group-mode challenges, and softens `challenge_streak` to return null
  instead of `42501` for true outsiders. Resolves B-011.
- **Apply via:** Supabase Dashboard → SQL editor → paste the file's contents → Run.
  Idempotent (CREATE OR REPLACE on both functions); order doesn't matter against
  W-014/W-015/W-016/W-017/W-018/W-019.
- **Smoke test after applying (verifies B-011 is gone):**
  1. Account A and Account B are members of the same group.
  2. Account A creates a **group** challenge in that group.
  3. Account A submits a proof on the challenge (status → `pending_verification`).
  4. Account B opens the same challenge.
     - ✅ B sees A's submission in the list (no longer empty).
     - ✅ No `getChallengeStreak failed: 42501 "not a participant"` in the console.
     - ✅ B can tap the submission to view the proof photo (storage signed URL works).
     - ✅ B sees the "Verify proof" button on A's pending submission and verifying
       transitions it to `verified`.
  5. A third account C, who is **not** in the group, still cannot read submissions or
     verify (RLS for outsiders unchanged).
- **Status:** Open until applied.

## [RESOLVED] B-011 — Verifier locked out of group challenges (visible as `getChallengeStreak failed: 42501 "not a participant"`)
- **Date:** 2026-06-03 · **Area:** backend / RLS
- **Repro:** Two accounts (A, B) in the same group. A creates a group challenge and submits
  proof. B opens the challenge → submissions list is empty, console shows
  `[basta] getChallengeStreak failed: {"code":"42501","message":"not a participant"}`.
- **Root cause:** `is_challenge_participant(p_challenge)` only checked
  `challenge_participants` membership. Only the creator is auto-inserted there (via
  `trg_challenges_add_creator`); other group members never get a row, so the helper
  returned false for them. That helper gates:
  * `submissions_select_participant` RLS
  * `verifications_select_participant` RLS
  * `storage_proof_media_select` storage RLS
  * `verify_submission` RPC
  * `challenge_streak` RPC (the visible error)
  * `submit_proof` RPC
  …so B was rejected by every read/verify gate at once.
- **Fix:** widened the helper so that for `mode='group'` challenges, any
  `group_members` row in the host group counts as participation. Single helper change
  fixes every gate listed above. Solo and outsider behavior unchanged. Defensive tweak:
  `challenge_streak` now returns null instead of raising `42501` for the rare true
  outsider case; the client treats null as "no streak" and hides the streak cards.
- **Migration:** `supabase/migrations/20260603000000_group_member_is_participant.sql`
  (W-022).
- **Client touch:** [src/features/challenges/api/index.ts](src/features/challenges/api/index.ts)
  → `getChallengeStreak` return type changed to `ChallengeStreak | null`. The challenge
  detail screen already guards on `streak.data ?` so null is rendered as "no streak."
- **Commit:** `fix(challenges): treat group members as participants`.

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

## [SUPERSEDED by W-026] W-018 — switch invite codes to 4-digit numeric
> **Superseded 2026-06-04 by W-026** (secure 12-char codes). Do NOT apply W-018 separately —
> W-026 produces strong codes and upgrades any weak ones. Kept below for history. 4-digit codes
> were brute-forceable (10,000 combinations); see D-011.
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
