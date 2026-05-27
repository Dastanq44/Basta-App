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

---

## Bugs
_(none logged yet — add as they appear, with repro steps)_
