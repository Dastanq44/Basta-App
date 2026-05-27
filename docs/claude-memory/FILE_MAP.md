# FILE_MAP.md

> **Where things live.** Update when you add significant files/folders. This is the map a new
> session uses to find code fast without re-exploring. Items marked _(planned)_ don't exist yet.

## Currently on disk
```
Basta_App/
├── CLAUDE.md                     # operating manual (read first)
├── AGENTS.md                     # condensed agent rules
└── docs/claude-memory/
    ├── PROJECT_BRIEF.md          # what/why + MVP scope
    ├── CURRENT_STATE.md          # live repo snapshot
    ├── HANDOFF.md                # session-to-session relay log
    ├── DECISIONS.md              # locked architecture decisions (ADR)
    ├── TASKS.md                  # shared task board
    ├── FILE_MAP.md               # this file
    └── BUGS_AND_WARNINGS.md      # known issues & traps
```

## Planned structure (target — per DECISIONS.md D-002)
```
app/                              # routes = THIN screens (expo-router)
│   _layout.tsx                   # providers, theme, query client, auth guard      (planned)
│   (auth)/ (onboarding)/ (tabs)/                                                   (planned)
│   challenge/[id]/  group/[id]/  verify/[submissionId].tsx                          (planned)
src/
├── features/<domain>/            # auth, proof, challenges, verification, groups,   (planned)
│   ├── api/                      #   leaderboard, feed, moderation
│   ├── hooks/                    # feature business logic
│   ├── model/                    # zod schemas, feature state
│   ├── ui/                       # feature-local components
│   └── index.ts                  # public surface (others import only this)
├── entities/                     # domain models                                   (planned)
│   └── mappers/                  # DTO → domain
├── shared/
│   ├── ui/                       # design system: theme/tokens + variant primitives (planned)
│   ├── lib/                      # supabase client, query client, mmkv             (planned)
│   ├── gestures/  utils/                                                            (planned)
├── offline/
│   ├── db/                       # WatermelonDB schema + models                     (planned)
│   ├── queue/                    # durable mutation queue + backoff                 (planned)
│   └── upload/                   # tus resumable upload manager                     (planned)
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
| Supabase client | `src/shared/lib/supabase.ts` | planned |
| Generated DB types | `src/shared/lib/supabase.types.ts` | planned |
| Offline queue processor | `src/offline/queue/processor.ts` | planned |
| Sync state machine type | `src/entities/submission.ts` | planned |
| Streak function | `supabase/migrations/*_streaks.sql` | planned |
| Leaderboard function | `supabase/migrations/*_leaderboard.sql` | planned |
| Design tokens | `src/shared/ui/theme/tokens.ts` | planned |
