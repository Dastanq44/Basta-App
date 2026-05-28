# FILE_MAP.md

> **Where things live.** Update when you add significant files/folders. This is the map a new
> session uses to find code fast without re-exploring. Items marked _(planned)_ don't exist yet.

## Currently on disk
```
Basta_App/
├── .gitignore                    # RN/Expo + Supabase ignores (hardened for secrets)
├── README.md                     # short project description
├── CLAUDE.md                     # operating manual (read first)
├── AGENTS.md                     # condensed agent rules
├── .claude/                      # SHARED Claude config (travels via repo)
│   ├── settings.json             # model=opus, permissions allow/ask/deny
│   └── skills/mobile-app-architect/   # project skill (auto-loads)
├── .githooks/
│   └── pre-commit                # secret-scan hook (W-006/T-014); enable: core.hooksPath .githooks
├── scripts/
│   └── bootstrap-claude.md       # one-time setup for a new Claude account ("Claude 2")
└── docs/
    ├── architecture/             # ARCHITECTURE PROPOSAL (pre-implementation, nothing applied)
    │   ├── ARCHITECTURE.md       # umbrella: overview, folder structure, MVP phases
    │   ├── DATA_MODEL.md         # entities + ER diagram
    │   ├── OFFLINE_SYNC.md       # sync state machine, queue, D-007/D-008 notes
    │   ├── NAVIGATION.md         # nav flows (Today tab; Explore = post-MVP)
    │   └── SUPABASE_SCHEMA_DRAFT.md  # DRAFT SQL — DO NOT APPLY YET
    └── claude-memory/
        ├── PROJECT_BRIEF.md      # what/why + MVP scope
        ├── CURRENT_STATE.md      # live repo snapshot
        ├── HANDOFF.md            # session-to-session relay log
        ├── DECISIONS.md          # architecture decisions (ADR)
        ├── TASKS.md              # shared task board
        ├── FILE_MAP.md           # this file
        └── BUGS_AND_WARNINGS.md  # known issues & traps
```

## Planned structure (target — per DECISIONS.md D-002)
```
app/                              # routes = THIN screens (expo-router)
│   _layout.tsx                   # providers + session gate / redirect              (live)
│   (auth)/ (onboarding)/ (tabs)/                                                    (live; onboarding screens are stubs)
│   challenge/[id]/  group/[id]/  verify/[submissionId].tsx                          (challenge stub; rest planned)
src/
├── features/<domain>/            # auth (live), proof, challenges, verification,    (most planned)
│   ├── api/                      #   groups, leaderboard, feed, moderation
│   ├── hooks/                    # feature business logic
│   ├── model/                    # zod schemas, feature state
│   ├── ui/                       # feature-local components
│   └── index.ts                  # public surface (others import only this)
├── entities/                     # domain models                                    (live)
│   └── mappers/                  # DTO → domain
├── shared/
│   ├── ui/                       # design system: theme/tokens + primitives + Input (live)
│   ├── lib/                      # supabase client, query client, env (mmkv pending) (live)
│   ├── gestures/  utils/                                                             (planned)
├── offline/                       # engine = Expo SQLite + MMKV (D-007); tus deferred (D-008)
│   ├── db/                       # expo-sqlite schema + queries; MMKV for K/V       (planned)
│   ├── queue/                    # durable mutation queue + backoff                 (planned)
│   └── upload/                   # Supabase Storage uploader (swappable to tus)     (planned)
├── services/
│   ├── analytics/                # typed events                                     (planned)
│   ├── notifications/            # push registration + handlers                     (planned)
│   └── crash/                    # Sentry init                                      (planned)
└── navigation/                   # linking.ts, guards.ts                            (planned)

supabase/
├── migrations/                   # SQL schema, RLS, streak/leaderboard functions    (planned)
├── functions/                    # edge functions (verify, push, scoring)           (planned)
└── seed.sql                                                                          (planned)

__tests__/                        # unit + integration                              (planned)
e2e/                              # Maestro flows                                    (planned)
.github/workflows/                # CI                                               (planned)
app.config.ts  eas.json  package.json                                               (planned)
```

## Key-file quick index (fill in as code lands)
| Concern | File(s) | Status |
|---------|---------|--------|
| Supabase client (SecureStore + PKCE) | `src/shared/lib/supabase.ts` | live (T-020) |
| Env validation | `src/shared/lib/env.ts` | live (throws on missing) |
| Auth feature (api/hooks/model) | `src/features/auth/{api,hooks,model}/` | live (T-020) |
| Session hook | `src/features/auth/hooks/useSession.ts` | live |
| Root session gate / redirect | `app/_layout.tsx` (RootNav) | live |
| Auth group layout | `app/(auth)/_layout.tsx` | live |
| Onboarding group layout | `app/(onboarding)/_layout.tsx` | live (back disabled) |
| Auth screens (forms) | `app/(auth)/{sign-in,sign-up,verify-email}.tsx` | live (T-020) |
| Input primitive | `src/shared/ui/Input.tsx` | live |
| Generated DB types | `src/shared/lib/supabase.types.ts` | planned (after T-003) |
| Offline queue processor | `src/offline/queue/processor.ts` | planned (Phase 2) |
| Sync state machine type | `src/entities/submission.ts` | live (skeleton) |
| Streak function | `supabase/migrations/*_streaks.sql` | planned |
| Leaderboard function | `supabase/migrations/*_leaderboard.sql` | planned |
| Design tokens | `src/shared/ui/theme/tokens.ts` | live |
