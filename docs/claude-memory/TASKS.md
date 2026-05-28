# TASKS.md

> **Shared task board.** Keep statuses current. IDs are stable (`T-NNN`) so HANDOFF.md can
> reference them. Status: `TODO` · `DOING` · `BLOCKED` · `DONE`.
> Phase tags: `[setup]` `[mvp]` `[post-mvp]` `[debt]`.

## In progress / next up
| ID | Status | Phase | Task | Notes |
|----|--------|-------|------|-------|
| T-000 | DONE | setup | Create shared-memory & handoff system | This system of files |
| T-001 | DONE | setup | `git init` + `.gitignore` + first commit; remote + `mvp` branch | git live on `mvp` |
| T-004 | DONE | mvp | Architecture proposal (`docs/architecture/*`) | Proposal only — not implemented |
| T-015 | DONE | setup | Settle D-007: local persistence engine | **Expo SQLite + MMKV** chosen; WatermelonDB deferred |
| T-002 | DONE | mvp | Scaffold Expo + TS app (expo-router) + feature folders | Phase 0 foundation; tsc+lint green |
| T-020 | DONE | mvp | Email auth (PKCE), secure token storage, session hook | Supabase + secure-store wired; tsc+lint green; runtime NOT yet exercised (W-008) |
| T-061a | DONE | setup | **Expo SDK 52 → 54 upgrade** (pulled early from T-061) | 18/18 expo-doctor; tsc+lint+`expo start --clear` green. ⚠️ DO NOT downgrade to SDK 52 — iOS Expo Go tracks latest. ⚠️ Use `npx expo install <pkg>` for all new Expo-related deps to preserve SDK 54 alignment. |
| T-003 | DOING | mvp | Supabase project + apply schema + RLS | **Migration file written** (`supabase/migrations/20260528000000_phase1_profiles_groups.sql`); USER must apply via Dashboard SQL editor — see W-010 |
| T-021 | DONE | mvp | Terms acceptance gate (versioned) | `CURRENT_TERMS_VERSION` + `profiles.terms_version`; gate redirects to profile-setup on mismatch |
| T-022 | DONE | mvp | Profile setup; onboarding gate on server `onboarded` flag | Real form (username/displayName/timezone/terms); `onboarded` only flips true after group setup |
| T-023 | DONE | mvp | Friend invite links + search; group create / join | `createGroup` + `joinGroupByInvite` RPC; on success flips `onboarded=true` and redirects to tabs |

## Backlog — MVP (grouped)

### Foundations `[setup]/[mvp]`
| ID | Status | Task |
|----|--------|------|
| T-010 | DONE | Design system: token module + variant primitives (Text, Button, Card, Screen). SyncBadge deferred to Phase 2 (needs the queue). |
| T-011 | DONE | Import-boundary rules — used core `no-restricted-imports` patterns (not `import/no-restricted-paths`, avoids resolver dep). Caught a real entities→offline violation during setup. |
| T-012 | TODO | Sentry (crash) + analytics (typed events) **wiring**. No-op interfaces (`src/services/*`) already exist; wire real SDKs here. |
| T-013 | DONE | Theming (light/dark via tokens), safe areas (Screen), accessibility baseline (≥44pt targets, roles in primitives). |
| T-014 | DONE | Pre-commit secret-scan hook in `.githooks/pre-commit` (gitleaks if present, else regex) — enforces W-006. Enable per clone: `git config core.hooksPath .githooks`. Husky/lint-staged optional once JS toolchain exists. |
| T-016 | DONE | Two-Claude shared config: repo `.claude/skills/mobile-app-architect`, `.claude/settings.json`, `scripts/bootstrap-claude.md` |

### Auth & onboarding
| ID | Status | Task |
|----|--------|------|
| T-020 | DONE | Email auth (PKCE), secure token storage, session hook. `src/features/auth/*`; root-layout redirect gate; SecureStore-backed Supabase client. |
| T-021 | DONE | Terms acceptance gate (versioned) |
| T-022 | DONE | Profile setup; onboarding gate on server `onboarded` flag |
| T-023 | DONE | Friend invite links + search; group create / join |

### Challenges & proof (core)
| ID | Status | Task |
|----|--------|------|
| T-030 | TODO | Create challenge (solo/group, category, duration) |
| T-031 | TODO | Challenge detail screen (thin) + feed |
| T-032 | TODO | Camera-first proof capture; draft saved to sandbox at capture |
| T-033 | TODO | Durable mutation/upload queue (backoff + idempotency) |
| T-034 | TODO | tus resumable media upload to Supabase Storage |
| T-035 | TODO | Sync badge UI bound to the sync state machine |

### Social & scoring (server-authoritative)
| ID | Status | Task |
|----|--------|------|
| T-040 | TODO | Friend verification flow (push deep-link; server enforces who may verify) |
| T-041 | TODO | Reactions + short comments |
| T-042 | TODO | Streak Postgres function + pg_cron rollover (user timezone) |
| T-043 | TODO | Leaderboard Postgres function; group leaderboard screen (FlashList) |

### Notifications & trust/safety
| ID | Status | Task |
|----|--------|------|
| T-050 | TODO | Push registration + reminder scheduling (quiet hours, frequency caps, controls) |
| T-051 | TODO | Report / block (RLS filters both directions); admin soft-delete RPC |
| T-052 | TODO | Account deletion + media/PII purge (store requirement, reachable in-app) |

### Quality & release
| ID | Status | Task |
|----|--------|------|
| T-060 | TODO | Unit/component tests; offline-submit→reconnect E2E (Maestro). No test runner exists yet (W-007) — consider landing a Jest harness before Phase 5. |
| T-061 | TODO | CI (typecheck/lint/test) + EAS build/submit pipeline; secrets via EAS/Actions. **SDK upgrade portion pulled out as T-061a (DONE — SDK 54).** |
| T-062 | TODO | Store assets, privacy/data-safety forms, beta (TestFlight / Play Internal) |

## Backlog — Post-MVP `[post-mvp]` (do NOT build until MVP ships)
AI verification · Explore feed · global leaderboards · full chat/voice · Strava/Health ·
XP/badges/duels · widgets · monetization. (See DECISIONS.md D-006.)

## Tech debt `[debt]`
| ID | Status | Task |
|----|--------|------|
| (none yet) | | Log debt here as it accumulates — link from BUGS_AND_WARNINGS.md |
