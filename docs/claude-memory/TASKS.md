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
| T-015 | TODO | setup | Settle D-007: local persistence engine (WatermelonDB vs SQLite+MMKV) | Decide before Phase 0 DB work |
| T-002 | TODO | mvp | Scaffold Expo + TS app (expo-router) + feature folders | Per D-002 / FILE_MAP |
| T-003 | TODO | mvp | Supabase project + apply schema + RLS | Use SUPABASE_SCHEMA_DRAFT; **not applied yet** |

## Backlog — MVP (grouped)

### Foundations `[setup]/[mvp]`
| ID | Status | Task |
|----|--------|------|
| T-010 | TODO | Design system: token module + variant primitives (Button, Text, Card, SyncBadge) |
| T-011 | TODO | ESLint import-boundary rules (`import/no-restricted-paths`) |
| T-012 | TODO | Sentry (crash) + analytics (typed events) wiring |
| T-013 | TODO | Theming (light/dark) + safe areas + accessibility baseline |
| T-014 | TODO | Pre-commit secret-scan hook (gitleaks via husky/lint-staged) — enforces W-006 |

### Auth & onboarding
| ID | Status | Task |
|----|--------|------|
| T-020 | TODO | Email auth (PKCE), secure token storage, session hook |
| T-021 | TODO | Terms acceptance gate (versioned) |
| T-022 | TODO | Profile setup; onboarding gate on server `onboarded` flag |
| T-023 | TODO | Friend invite links + search; group create / join |

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
| T-060 | TODO | Unit/component tests; offline-submit→reconnect E2E (Maestro) |
| T-061 | TODO | CI (typecheck/lint/test) + EAS build/submit pipeline; secrets via EAS/Actions |
| T-062 | TODO | Store assets, privacy/data-safety forms, beta (TestFlight / Play Internal) |

## Backlog — Post-MVP `[post-mvp]` (do NOT build until MVP ships)
AI verification · Explore feed · global leaderboards · full chat/voice · Strava/Health ·
XP/badges/duels · widgets · monetization. (See DECISIONS.md D-006.)

## Tech debt `[debt]`
| ID | Status | Task |
|----|--------|------|
| (none yet) | | Log debt here as it accumulates — link from BUGS_AND_WARNINGS.md |
