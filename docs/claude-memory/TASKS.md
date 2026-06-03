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
| T-024 | DONE | Password reset flow. `forgot-password.tsx` + `reset-password.tsx` + `useRequestPasswordReset`/`useUpdatePassword` + `resetPasswordForEmail`/`exchangeCodeForSession`/`updatePassword` API. **Deep-link requires W-020 dashboard config.** |
| T-025 | DONE | Leave / archive group. `leave_group` + `archive_group` SECURITY DEFINER RPCs (W-019); `useLeaveGroup`/`useArchiveGroup`; Settings footer on `app/group/[id].tsx` with confirm dialogs. Sole-owner leave guard server-side. |
| T-026 | DONE | Main-app group create/join + archived group restore. Reusable `GroupCreateOrJoinForm` in `src/features/groups/ui/` (used by both onboarding and main app); modal route `app/group/join-or-create.tsx`; `app/group/archived.tsx` list + Restore (owner-only). `restore_group` RPC appended to the W-019 migration. `useMyArchivedGroups`/`useRestoreGroup` hooks; create/join/archive/leave/restore all invalidate both active and archived query keys. |
| T-027 | DONE | **Bug fix (B-011):** treat group members as participants. Widened `is_challenge_participant(uuid)` so group members of a `mode='group'` challenge's host group pass the helper — fixes verifier seeing empty submissions list + `getChallengeStreak 42501`. Single helper change cascades through 4 RLS policies + 3 RPCs. `challenge_streak` softened to return null for true outsiders. New idempotent migration `20260603000000_group_member_is_participant.sql` (W-022 — USER must apply). |
| T-028 | DONE | Show submission author name on challenge detail row + submission detail screen. Two new SECURITY DEFINER RPCs (`list_challenge_submissions`, `get_submission_with_author`) join `profiles.username`/`display_name` server-side without widening `profiles` RLS — matches the `group_leaderboard` precedent. `Submission` entity grows optional `authorUsername`/`authorDisplayName`; both screens render `displayName ?? @username ?? "Member"` as the heading and demote "Day N" to a muted subline. Migration `20260603100000_submission_authors.sql` (W-023 — USER must apply). |
| T-029 | DONE | Edit group name (owner-only) and challenge title/category/duration/proof-requirement (creator-only) in place. Added `'work'` to `CHALLENGE_CATEGORIES`. Two SECURITY DEFINER RPCs `update_group` + `update_challenge` with server-side validation (length caps, allow-list category, duration ∈ [1,365], not-archived guard, owner/creator check) plus a duration-shrink guard that refuses to drop duration below the highest existing `submissions.challenge_day + 1`. Reusable zod `updateChallengeInput` extracted from `createChallengeInput`. New modal routes `app/group/[id]/edit.tsx` and `app/challenge/[id]/edit.tsx`; Edit buttons added to the Settings footers of both detail screens (owner/creator only). Migration `20260603200000_update_group_and_challenge.sql` (W-024 — USER must apply). |
| T-030 | DONE | Group leader UX + transferable leadership. Fixes the edit-group input rehydrating on empty (you can now clear the field and retype). Adds dep-free `CrownIcon` shared primitive (three triangles + bar in muted gray) shown next to the leader on the leaderboard. Server-side `transfer_group_leadership(p_group_id, p_new_owner_id)` RPC: owner-only, not-archived, new owner must be an existing member, flips both `groups.owner_id` and `group_members.role` in one transaction. Tap any non-self leaderboard row as owner → Alert.alert confirmation → leadership transfers; the new owner inherits all owner-only affordances (Edit, Archive). Migration `20260603300000_transfer_group_leadership.sql` (W-025 — USER must apply). |

### Challenges & proof (core)
| ID | Status | Task |
|----|--------|------|
| T-030 | DONE | Create challenge (solo/group, category, duration). `create_challenge` RPC + challenges feature + `app/challenge/new.tsx`. |
| T-031 | DONE | Challenge detail screen (thin) + recent submissions list. `app/challenge/[id].tsx`. Verification/streak UI deferred to Phase 3. |
| T-032 | DONE | Camera-first proof capture; draft media copied to `documentDirectory/proofs/<id>.jpg` BEFORE network. `ProofComposer` + `useSubmitProof`. |
| T-033 | DONE | Durable mutation/upload queue (SQLite-backed, retry/backoff + jitter + client-UUID idempotency). `src/offline/queue/{store,processor}.ts`. |
| T-034 | DONE | **Standard** Supabase Storage upload per D-008 (tus deferred). `src/offline/upload/storage.ts`. Bucket creation = USER action W-011. |
| T-035 | DONE | Sync badge UI bound to the SyncStatus state machine. `src/features/proofs/ui/SyncBadge.tsx`. |
| T-036 | DONE | Archive challenge. `archive_challenge` SECURITY DEFINER RPC (W-019); `useArchiveChallenge`; Archive button on `app/challenge/[id].tsx` (creator-only) + confirm dialog. `listMyChallenges` filters `archived_at is null`. |

### Social & scoring (server-authoritative)
| ID | Status | Task |
|----|--------|------|
| T-040 | DONE | Friend verification flow. `verify_submission` RPC + `verifications` table + `src/features/verification` + `app/verify/[submissionId].tsx` + Verify affordance on challenge detail. Group: threshold-approve/single-reject; solo auto-verifies on submit (D-009). **Push deep-link to the verify screen is deferred to T-050** (no push yet). Apply migration W-014. |
| T-041 | DONE | Reactions + short comments. `submission_reactions` (1/user, re-selectable) + `submission_comments` (≤280) tables; `react_to_submission` + `add_comment` RPCs (participant-gated); `src/features/social` (ReactionBar + CommentsSection); `app/submission/[id].tsx` (tap a submission row → photo + reactions + comments). Apply migration W-017. |
| T-042 | DONE | Streak: server-authoritative `challenge_streak` RPC (computed from verified `challenge_day` runs — tz-correct for free) + `useChallengeStreak` + streak stat cards on challenge detail. **pg_cron rollover DEFERRED to T-050** (a computed streak needs no nightly job; cron is only for proactive "streak at risk" push) — see D-010. Apply migration W-015. |
| T-043 | DONE | `group_leaderboard` RPC (members ranked by verified-proof count across the group's challenges, member-gated) + `src/features/leaderboard` + real Groups tab list → `app/group/[id].tsx` (invite code + ranked board, highlights "you"). Used **FlatList** not FlashList (bounded ≤50 members, no-new-deps); FlashList is a later perf swap. Apply migration W-016. |

### Notifications & trust/safety
| ID | Status | Task |
|----|--------|------|
| T-050 | TODO | Push registration + reminder scheduling (quiet hours, frequency caps, controls). Blocked in Expo Go — needs dev build + EAS (bundle with T-061). |
| T-051 | DONE | Report / block. `src/features/moderation/*` (api/hooks/model/ui) implemented; `ReportSheet` modal with reason picker; integrations on submission/challenge/group detail. Block button on submission; `app/blocked-users.tsx` list + Unblock; client-side filter via `useBlockedUserIds()` on submission detail + challenge recent-list. Broader RLS-side filtering documented as a follow-up tightening. |
| T-052 | DONE | Account deletion request. `useRequestAccountDeletion` hook + Profile "Danger zone" with double-confirm + optional sign-out after. Server is idempotent (returns existing pending id, no duplicate). Hard deletion of `auth.users` + Storage purge remains a follow-up Edge Function with service-role. |

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
