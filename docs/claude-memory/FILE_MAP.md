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
│       ├── 20260604000000_secure_invite_codes.sql          # W-026: 12-char base62 invite codes (apply; supersedes W-018)
│       ├── 20260604100000_challenge_today_and_redact.sql   # T-031: get_my_today_submission + list_challenge_streaks + redact_my_submission (apply — W-027)
│       ├── 20260604200000_fix_today_submission_ambiguity.sql # B-013 fix: qualify column refs in get_my_today_submission (apply — W-028)
│       ├── 20260606000000_push_tokens.sql                    # T-050A: push_tokens table + register_push_token / unregister_push_token RPCs (apply — W-032; renumbered from W-031)
│       └── 20260607000000_notification_outbox_and_dispatch.sql # T-050B: notification_outbox + enqueue triggers + dispatch RPCs (service_role only) + hardening of W-032 grants (apply — W-033)
├── supabase/functions/dispatch-pushes/index.ts # T-050B: Deno Edge Function. Drains outbox → Expo Push Service (https://exp.host/--/api/v2/push/send). Deploy: `npx supabase functions deploy dispatch-pushes --no-verify-jwt`.
├── eas.json                       # T-050A: skeleton (development/preview/production/submit). Apple Team ID NOT hardcoded — fill at build/submit time.
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
│   ├── proofs/                   # T-032/T-035/T-031: photo capture + queue orchestration + SyncBadge + redact
│   │   ├── api/index.ts          #   listSubmissionsForChallenge · getMyTodaySubmission (RPC) · getSubmission · getProofSignedUrl · listChallengeStreaks · redactMySubmission
│   │   ├── hooks/                #   useSubmissions · useTodaySubmission · useSubmission · useProofSignedUrl · useQueueForChallenge · useSubmitProof · useChallengeStreaks · useRedactMySubmission
│   │   ├── model/                #   proofInput zod
│   │   └── ui/                   #   SyncBadge · ProofComposer (supports redact mode)
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
│   ├── notifications/            # T-050A: registerForPush / unregister (Expo + Supabase RPC)  (live, registration-only)
│   └── crash/                    # Sentry init                                     (planned)
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
| `VisibilityToggle` (public/private + "Share to Global" Switch row) | `src/shared/ui/VisibilityToggle.tsx` | live (T-073, D-014) |
| Privacy/visibility foundation (enum + `is_public` + `is_submission_globally_visible` + proof-media RLS + RPC recreations) | `supabase/migrations/20260614000000_visibility_foundation.sql` | written — **USER must apply** (T-073, D-014) |
| Privacy enforcement (drop broad profiles SELECT + `get_viewable_profile` + `can_view_submission` + social-RPC re-gate + hardened proof-media + `update_group_meta` clear-avatar + `create_group` visibility) | `supabase/migrations/20260615000000_privacy_enforcement.sql` | written — **USER must apply after 20260614** (T-075, D-014) |
| Privacy model + manual smoke-test checklist | `docs/architecture/PRIVACY_MODEL.md` | live (T-075, D-014) |
| Global feed v1 RPC (`list_global_submissions`) + social-read RLS widening to `can_view_submission` | `supabase/migrations/20260616000000_global_feed_v1.sql` | written — **USER must apply after 20260615** (T-074) |
| Global feed feature (api + `useGlobalFeed` infinite query + `GlobalFeedCard`) | `src/features/global/` | live (T-074) |
| Global post entity | `src/entities/globalPost.ts` | live (T-074) |
| Global tab screen (FlatList feed; route name kept `explore`) | `app/(tabs)/explore.tsx` | live (T-074) |
| Global v1 hardening (`is_block_between`, `(created_at,id)` cursor + block-filtered counts, block-filtered social list RPCs, `list_viewable_user_submissions`, social policies → `to authenticated`) | `supabase/migrations/20260617000000_global_feed_hardening.sql` | written — **USER must apply after 20260616** (T-077) |
| Simplify visibility model (defaults→public, `submissions.hidden_from_global` + backfill, `is_submission_globally_visible` drops `is_public`, create RPCs default public) | `supabase/migrations/20260618000000_simplify_visibility_model.sql` | written — **USER must apply after 20260617** (T-078, D-014) |
| Profile redesign data (`get_profile_overview`, `list_viewable_user_challenges`, `list_viewable_user_groups` + 3 visibility helpers) | `supabase/migrations/20260619000000_profile_layout_data.sql` | written — **USER must apply after 20260618** (T-080) |
| Redesigned profile (shared `ProfileScreen` + header/stats/world-rank/activity-preview/cards + api/hooks) | `src/features/profile/` | live (T-080) |
| Full 90-day activity route | `app/activity/[id].tsx` | live (T-080) |
| Profile routes (thin wrappers around `ProfileScreen`) | `app/(tabs)/profile.tsx` · `app/user/[id].tsx` | live (T-080) |
| Submission-detail context (extends `get_submission_with_author` w/ challenge/group + can-open flags) | `supabase/migrations/20260620000000_submission_detail_context.sql` | written — **USER must apply after 20260619** (T-082) |
| Delete-challenge RPC (`delete_challenge`, creator-only hard delete) | `supabase/migrations/20260621000000_delete_challenge.sql` | written — **USER must apply after 20260620** (T-083) |
| Theme mode (light/dark/system) + persistence | `src/shared/ui/theme/ThemeProvider.tsx` · `src/shared/lib/themePreference.ts` | live |
| Reusable group create/join form | `src/features/groups/ui/GroupCreateOrJoinForm.tsx` | live (T-026) |
| Group create/join modal route | `app/group/join-or-create.tsx` | live (T-026) |
| Archived groups screen | `app/group/archived.tsx` | live (T-026) |
| `restore_group` RPC | `supabase/migrations/20260601100000_phase4a_user_control_safety.sql` | written — apply (W-019) |
