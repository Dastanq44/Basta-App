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
├── supabase/
│   └── migrations/
│       ├── 20260528000000_phase1_profiles_groups.sql   # T-003 (applied)
│       ├── 20260528100000_phase2_challenges_proofs.sql # T-030/T-034 (applied — W-011 done)
│       ├── 20260531000000_phase3_verification.sql      # T-040: verifications + verify_submission + solo auto-verify + storage SELECT widen (apply — W-014)
│       ├── 20260531100000_phase3_streaks.sql           # T-042: challenge_streak() computed-on-read RPC (apply — W-015)
│       ├── 20260531200000_phase3_leaderboard.sql       # T-043: group_leaderboard() RPC (apply — W-016)
│       ├── 20260531300000_phase3_social.sql            # T-041: reactions + comments tables/RPCs (apply — W-017)
│       ├── 20260601000000_short_invite_codes.sql       # 4-digit invite codes (apply — W-018)
│       ├── 20260601100000_phase4a_user_control_safety.sql  # T-024/T-025/T-036 + 4A-2 prep tables + restore_group (apply — W-019)
│       ├── 20260603000000_group_member_is_participant.sql  # T-027 / B-011: widen is_challenge_participant; soften challenge_streak (apply — W-022)
│       ├── 20260603100000_submission_authors.sql           # T-028: list_challenge_submissions + get_submission_with_author RPCs (apply — W-023)
│       ├── 20260603200000_update_group_and_challenge.sql   # T-029: update_group + update_challenge RPCs (apply — W-024)
│       ├── 20260603300000_transfer_group_leadership.sql    # T-030: transfer_group_leadership RPC (apply — W-025)
│       └── 20260604000000_secure_invite_codes.sql          # W-026: 12-char base62 invite codes (apply; supersedes W-018)
├── src/features/
│   ├── auth/                     # T-020: PKCE email auth, useSession, secure-store tokens
│   ├── onboarding/               # T-021/T-022: terms, profile setup, completeOnboarding
│   │   ├── api/index.ts          #   fetchProfile/upsertProfile/completeOnboarding + row→User map
│   │   ├── hooks/                #   useProfile · useUpsertProfile · useCompleteOnboarding
│   │   └── model/                #   CURRENT_TERMS_VERSION · profileSetupInput zod
│   ├── groups/                   # T-023/T-025/T-026/T-029/T-030: create/join/leave/archive/restore/rename/transfer
│   │   ├── api/index.ts          #   createGroup · joinGroupByInvite · listMyGroups · listMyArchivedGroups · leaveGroup · archiveGroup · restoreGroup · updateGroup · transferGroupLeadership
│   │   ├── hooks/                #   useCreateGroup · useJoinGroup · useMyGroups · useMyArchivedGroups · useLeaveGroup · useArchiveGroup · useRestoreGroup · useUpdateGroup · useTransferGroupLeadership
│   │   ├── model/                #   createGroupInput · joinGroupInput zod · INVITE_CODE_LENGTH
│   │   └── ui/                   #   GroupCreateOrJoinForm (shared by onboarding + main app)
│   ├── challenges/               # T-030/T-042: list/detail/create challenges + streak (RPC-first)
│   │   ├── api/index.ts          #   listMyChallenges · getChallenge · createChallenge · getChallengeStreak
│   │   ├── hooks/                #   useChallenges · useChallenge · useCreateChallenge · useChallengeStreak
│   │   └── model/                #   CHALLENGE_CATEGORIES · createChallengeInput zod
│   ├── moderation/               # T-051/T-052: report/block + account-deletion request
│   │   ├── api/index.ts          #   reportTarget · blockUser · unblockUser · listMyBlocks · requestAccountDeletion (all RPC)
│   │   ├── hooks/                #   useReport · useBlockUser · useUnblockUser · useMyBlocks · useBlockedUserIds (Set<string>) · useRequestAccountDeletion
│   │   ├── model/                #   REPORT_REASONS · REPORT_REASON_LABELS · reportInput zod
│   │   └── ui/                   #   ReportSheet (modal)
│   ├── proofs/                   # T-032/T-035: photo capture + queue orchestration + SyncBadge
│   │   ├── api/index.ts          #   listSubmissionsForChallenge · getMyTodaySubmission · getSubmission · getProofSignedUrl
│   │   ├── hooks/                #   useSubmissions · useTodaySubmission · useSubmission · useProofSignedUrl · useQueueForChallenge · useSubmitProof
│   │   ├── model/                #   proofInput zod
│   │   └── ui/                   #   SyncBadge · ProofComposer
│   ├── verification/             # T-040: friend verification (group-only; solo auto-verifies)
│   │   ├── api/index.ts          #   verifySubmission (rpc verify_submission)
│   │   ├── hooks/                #   useVerifySubmission (invalidates submissions + single + streak)
│   │   └── model/                #   verificationResultSchema zod
│   ├── leaderboard/              # T-043: group leaderboard (server-ranked by verified proofs)
│   │   ├── api/index.ts          #   getGroupLeaderboard (rpc group_leaderboard)
│   │   └── hooks/                #   useGroupLeaderboard · groupLeaderboardQueryKey
│   └── social/                   # T-041: reactions + short comments on submissions
│       ├── api/index.ts          #   getReactions · reactToSubmission · getComments · addComment
│       ├── hooks/                #   useReactions · useReactToSubmission · useComments · useAddComment
│       ├── model/                #   REACTION_EMOJIS · ReactionSummary
│       └── ui/                   #   ReactionBar · CommentsSection
├── src/offline/                  # Critical path (D-004). Engine: Expo SQLite (D-007).
│   ├── index.ts                  # initOffline() barrel — used by app/_layout
│   ├── db/                       # SQLite singleton + schema (queue_items table)
│   ├── queue/                    # T-033: durable mutation queue with retry/backoff/idempotency
│   │   ├── store.ts              #   CRUD over queue_items
│   │   ├── processor.ts          #   NetInfo+AppState driven; one-at-a-time; max 8 attempts
│   │   └── types.ts              #   QueuedMutation, SubmitProofPayload, SyncStatus re-export
│   └── upload/                   # T-034: standard Supabase Storage upload (tus deferred, D-008)
│       └── storage.ts            #   uploadProofMedia(userId,challengeId,submissionId,localUri)
├── src/navigation/
│   └── guards.ts                 # useOnboardingGate(): GateState — full redirect matrix
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
│   challenge/[id]/  verify/[submissionId].tsx                                       (live)   group/[id]/ (planned)
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
| Verify proof screen | `app/verify/[submissionId].tsx` | live (T-040) |
| Verification RPC wrapper | `src/features/verification/api/index.ts` | live (T-040) |
| verify_submission RPC + verifications table | `supabase/migrations/20260531000000_phase3_verification.sql` | written — apply (W-014) |
| Sync state machine type | `src/entities/submission.ts` | live (skeleton) |
| Streak function | `supabase/migrations/*_streaks.sql` | planned |
| Leaderboard function | `supabase/migrations/*_leaderboard.sql` | planned |
| Design tokens | `src/shared/ui/theme/tokens.ts` | live |
| Crown icon primitive | `src/shared/ui/CrownIcon.tsx` | live (T-030) |
| Design-system primitives (2026-06 UI refresh) | `src/shared/ui/{StatTile,Chip,SegmentedControl,ProgressBar,ListRow,Avatar,Badge,Icon}.tsx` | live |
| Theme mode (light/dark/system) + persistence | `src/shared/ui/theme/ThemeProvider.tsx` · `src/shared/lib/themePreference.ts` | live |
| Reusable group create/join form | `src/features/groups/ui/GroupCreateOrJoinForm.tsx` | live (T-026) |
| Group create/join modal route | `app/group/join-or-create.tsx` | live (T-026) |
| Archived groups screen | `app/group/archived.tsx` | live (T-026) |
| `restore_group` RPC | `supabase/migrations/20260601100000_phase4a_user_control_safety.sql` | written — apply (W-019) |
