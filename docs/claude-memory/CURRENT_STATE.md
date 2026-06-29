# CURRENT_STATE.md

> **Live snapshot of the repo.** Update this at the end of every session. If this disagrees with
> reality, fix it before doing anything else.

_Last updated: 2026-06-29 — by: Claude (opus) (i18n completion + glass/header/theme polish)_

> **2026-06-29 (D-018):** Two patches. **PATCH A** `fix(i18n): complete ru and kk localization
> coverage` — ru/kk now cover ALL en keys (0 missing); every app screen localizes (profile UI,
> challenge wizard/edit, group edit/archived/join, auth secondary, onboarding, ProofComposer, etc.)
> via `tr`/`tn`/`fmtDate`/enum mappers. **PATCH B** `fix(ui): polish liquid glass controls themes
> and localization` — unified header (in-body `ScreenHeader` controls are ALWAYS `GlassIconButton`
> circles in every mode; shared SVG `ChevronLeftIcon`, optically centered, no margin hacks); nav
> theme bridge (`@react-navigation/native` ThemeProvider mapped from app theme) + `headerTintColor`/
> title color → fixes light-theme glass flicker + dark-theme black header titles; inactive glass uses
> lighter `clear` tone; **green `sageGrowth` redesigned** (emerald primary `#15803D`, sage surfaces —
> the one theme whose CTA is green); fallback tab pill larger + center-scale (native iOS 26 tab
> minimize is OS-owned, documented). typecheck+lint+expo-doctor (18/18) green. No backend/migration.

> **2026-06-28 (pm) full localization + Liquid Glass (D-017):** the core daily loop + all detail
> screens now localize in the selected app language, with **app-language date/number formatting**
> (`fmtDate`/`fmtDateTime`/`fmtNumber` on `useI18n`) + enum mappers (category/mode/status/role/days);
> stack titles localize too. **iPhone-first Liquid Glass**: new `src/shared/ui/glass/*`
> (`GlassSurface`/`GlassPill`/`GlassIconButton`/`GlassHeader`, capability-gated via
> `isLiquidGlassAvailable` + Reduce-Transparency) + per-theme `glass` tokens; iOS 26 renders the
> **native Liquid Glass tab bar** (`expo-router/unstable-native-tabs`, SF Symbols, minimize-on-scroll)
> while Android/iOS<26 keep the refined floating JS tabs; `ScreenHeader` auto-upgrades to glass
> controls on iOS 26. Blue stays the CTA in all 4 themes; content cards stay solid. Packages added:
> expo-glass-effect ~0.1.10, expo-blur ~15.0.8 (no reanimated). **No backend/migration.** Commits
> `b64d80e`→`351e4ee`→feat(ios). typecheck+lint+expo-doctor (18/18) green. Residual i18n (auth
> secondary/onboarding/profile-edit/proof-composer/schema messages) tracked — infra in place.

> **2026-06-28 appearance + localization upgrade (D-016):** **4 themes** (whiteBlue DEFAULT,
> darkBlue, steppeSky, sageGrowth — `tokens.ts` `THEMES`; blue is the CTA in all four) + **3
> languages** (en-US / kk-KZ / ru-RU) as on-device prefs (`src/shared/lib/appPreferences.ts`, **no
> migration**). `ThemeProvider` keys on `themeId`; `useThemeMode()` → `{ themeId, setThemeId,
> scheme, ready }`. In-house i18n gained persistence + `tn()` plurals (Intl.PluralRules) + device
> fallback; backward-compat for old lang/theme values. **First-launch flow**
> `app/(onboarding)/preferences.tsx` gated before auth via `PreferencesGateProvider` (no loops).
> **Preferences screen** `app/profile/preferences.tsx` (replaces Appearance) with `ThemePreviewCard`
> previews. Goal-1 fixes: notif color → `#2563EB`, `expo-localization` plugin, `uploadMyAvatar`
> shares `localImage.ts` reader, CalendarPicker localized via Intl. Emoji picker standardized +
> localized and **reused for the challenge icon step** (preview + suggestions + Browse all). Today
> hero uses 🔥/✅ badges. Liquid Glass NOT started. typecheck+lint+expo-doctor (18/18) green.

> **2026-06-22 "Steppe Sky" redesign (D-015):** full Kazakh-inspired rebrand — sky-blue primary +
> reserved gold accent, paper-cream/steppe-night canvases, restrained `react-native-svg` ornaments
> (`OrnamentDivider`/`OrnamentMedallion`) in dividers/medallions/hero accents/empty states only. New
> shared `PublicPreviewBanner`/`ProofContextStrip`/`BrandEmptyState`; `Avatar` renders cached images
> via **expo-image**. **In-house i18n** (`src/shared/i18n`, kz/ru/en, device locale via
> expo-localization) wired through `I18nProvider` in `app/_layout`. Floating-card tab bar with a
> primary pill active state. Richer Groups rows use an extended `listMyGroups` projection
> (description, avatar_path, `group_members(count)`) — **client query only, no migration**.
> submission detail uses `ScreenHeader`+`ProofContextStrip`; challenge detail has a sticky CTA;
> public previews have a strong read-only banner + persistent Join CTA. **No backend/schema change.**
> typecheck+lint+expo-doctor (18/18) green. Branch `mvp` @ `ab07fd9`. Packages added:
> react-native-svg, expo-localization, expo-image. i18n string extraction is partial (follow-up).

> **2026-06-18 UI/UX pass (T-085):** tabs reordered (Today/Challenges/Groups/Global/Profile); Today
> is action-first (due above weekly summary, dead bell removed); profile "Proofs" tab + hidden
> WorldRankCard + rolling-30-day activity; group detail tabs Overview/Challenges/Leaderboard (member)
> and Overview/Challenges/Proofs (public preview, **leaderboard removed for non-members**); groups
> tab CTAs simplified; global empty-state copy; new shared `InlineBanner`/`EmptyStateCard`/
> `OfflineBanner` (global offline bar in `app/_layout`); submission title de-duplicated. Privacy:
> migration `20260625000000_group_leaderboard_member_only.sql` hardens `list_public_group_leaderboard`
> to member-only. **USER must apply `20260625` (after 20260624).** Deferred (T-086): challenge-detail
> sticky CTA, wizard restructure, `get_today_focus`/`can_edit_submission` RPCs, full a11y sweep.
> typecheck + lint + expo-doctor (18/18) green.

> **2026-06-18 public previews (T-084):** public challenges/groups on a profile are now tappable
> into read-only **previews** (full member detail unchanged). New migration
> `supabase/migrations/20260622000000_public_previews.sql`: `get_challenge_access`,
> `list_public_challenge_submissions`, `get_group_access`, `list_public_group_challenges`,
> `list_public_group_submissions` (all SECURITY DEFINER, no invite codes / private members), plus a
> recreate of `get_profile_overview` that **fixes a streak privacy leak** (other viewers' streak
> stats now exclude hidden/private-challenge activity via `can_view_submission`). Frontend: challenge
> + group detail screens branch member vs `PublicChallengePreview`/`PublicGroupPreview`; profile
> cards always tappable; proof Report/Block moved to a 3-dot `headerRight` menu; group creation
> defaults public. **Follow-up fixes:** proof context boxes always navigate (→ member/preview);
> public group preview shows the normal Members/Created card (`created_at` added to
> `get_group_access` — migration `20260623`); removed "Public" wording from preview headings;
> preview 3-dot opens a menu first; `ReportSheet` wrapped in `SafeAreaProvider` (notch overlap) +
> removed reason-key caption; fixed Report-from-menu not opening (250 ms two-modal delay).
> **USER must apply `20260622` then `20260623` (after 14…21); reload PostgREST schema if via
> Dashboard.** typecheck + lint + expo-doctor (18/18) green.

> **2026-06-18 polish batch (T-082):** removed challenge **archiving UI** (kept the `archived_at`
> column); challenge wizard no longer pre-highlights the first decision chip; submission detail
> gained 3 context boxes (user/challenge/group, link out when openable) + merged photo/description
> into one card (migration `20260620000000_submission_detail_context.sql` extends
> `get_submission_with_author`); profile header enlarged; activity preview now shows the **current
> month** (labeled) with a **today ring** + persistent tap-a-day message; "View full activity" opens
> a **BottomSheet** (removed `app/activity/[id].tsx`); profile stat cards redesigned (bold label +
> sized counter). **Follow-up tweaks:** delete-challenge feature
> (`20260621000000_delete_challenge.sql` + settings-sheet item); submission user box shows @username;
> stat labels non-bold/one-line; activity calendar reworked = sequential days + hatched non-clickable
> future days + visible non-black click ring + arrow after last day + dismiss-on-scroll. **USER must
> apply `20260620` then `20260621` (after 14…19); reload PostgREST schema if via Dashboard.**
> typecheck + lint + expo-doctor (18/18) green.

> **2026-06-18 profile redesign (T-080):** the profile (own tab + `/user/[id]`) was reworked to be
> compact + content-first: Header → 2×2 Stats grid (streaks + active Challenges + Groups) → small
> World Rank card → **30-day** activity preview (full 90-day moved behind "View full activity →" =
> `app/activity/[id].tsx`) → tabs **Submissions | Challenges | Groups**. Shared
> `src/features/profile/ui/ProfileScreen.tsx` powers both routes (now thin wrappers). New migration
> `supabase/migrations/20260619000000_profile_layout_data.sql`: `get_profile_overview`,
> `list_viewable_user_challenges`, `list_viewable_user_groups` (+ 3 visibility helpers), all
> SECURITY DEFINER + visibility-aware (no invite codes). Privacy model + Global feed unchanged.
> **USER must apply `20260619` (after 14/15/16/17/18); reload PostgREST schema if via Dashboard.**
> typecheck + lint + expo-doctor (18/18) green.

> **2026-06-18 visibility simplification (D-014):** migration
> `supabase/migrations/20260618000000_simplify_visibility_model.sql` + client. `profiles/groups/
> challenges.visibility` now default **public**; submissions have **no** public/private toggle
> (removed "Share to Global" from the proof composer + all write-path `isPublic` plumbing) and
> inherit Global eligibility from their parents. New `submissions.hidden_from_global` (default
> false, internal escape hatch) backfilled from the now-**deprecated** `is_public`
> (`is_public=false → hidden=true`). `is_submission_globally_visible` recreated (drop `is_public`,
> add `hidden_from_global`). UI toggles flipped to "private/hide" language, default OFF (Profile
> "Private profile", Group "Private group", Challenge "Hide from profile and Global"). **USER must
> apply `20260618` (after 14/15/16/17); reload PostgREST schema if via Dashboard.** typecheck +
> lint + expo-doctor (18/18) green.

> **2026-06-18 Global v1 hardening (T-074):** migration
> `supabase/migrations/20260617000000_global_feed_hardening.sql` + client fixes — `/user/[id]` now
> has a header/back (registered in `app/_layout.tsx`) and shows globally-visible posts via the new
> `list_viewable_user_submissions` RPC; `GlobalFeedCard` author tap no longer also opens the
> submission (sibling Pressables); Global counts refresh after react/comment; comments/reactors/
> likers + Global counts are block-filtered (`is_block_between`); the 3 social SELECT policies are
> now `to authenticated`; Global pagination uses a stable `(created_at, id)` keyset cursor.
> **USER must apply `20260617` (after 20260614/15/16); reload PostgREST schema if via Dashboard.**
> No new discovery surfaces. typecheck + lint + expo-doctor (18/18) green.

> **2026-06-18 Global v1 (T-074):** the Explore tab is now **Global** — a chronological feed of
> PUBLIC, VERIFIED submissions (submissions only; challenge/group/profile discovery + leaderboards
> still deferred). New migration `supabase/migrations/20260616000000_global_feed_v1.sql`:
> `list_global_submissions(p_limit, p_before)` (verified + `is_submission_globally_visible`, cursor
> on `created_at`, +reaction/comment counts) and widens the 3 submission-social SELECT policies to
> `can_view_submission` (fixes a Global viewer seeing zero reactions — reactions are read via a
> direct select). New `src/features/global/` (api + `useGlobalFeed` infinite query + `GlobalFeedCard`)
> + `src/entities/globalPost.ts`; `app/(tabs)/explore.tsx` is a FlatList feed (route name kept
> `explore`). Cards tap → `/submission/[id]`, author → `/user/[id]`. **USER must apply
> `20260616` (after 20260614 + 20260615)**; reload PostgREST schema if via Dashboard. typecheck +
> lint + expo-doctor (18/18) green.

> **2026-06-13 privacy ENFORCEMENT (D-014):** second migration
> `supabase/migrations/20260615000000_privacy_enforcement.sql` makes the foundation correct +
> safe. Drops the broad `profiles_select_public USING(true)` (private profiles are now actually
> private) and adds `get_viewable_profile`; adds `can_view_submission` and re-gates the 7 submission
> social RPCs on it (global viewers can read/interact with verified+public posts; private stays
> participant-only); hardens proof-media SELECT (UUID-guarded casts); adds `p_clear_avatar` to
> `update_group_meta` + fixes the client null→undefined avatar-removal bug; adds `p_visibility` to
> `create_group` + a Public-group toggle at creation. Spec UX copy on all toggles. **Global feed
> still NOT built.** **USER must apply BOTH `20260614` then `20260615`** (PostgREST schema reload if
> applied via Dashboard). New `docs/architecture/PRIVACY_MODEL.md` has the model + smoke-test
> checklist. typecheck + lint + expo-doctor (18/18) green.

> **2026-06-13 privacy/visibility foundation (D-014):** new migration
> `supabase/migrations/20260614000000_visibility_foundation.sql` adds a `visibility` enum
> (`profiles`/`groups`/`challenges`, default **private**) + `submissions.is_public` (default
> **false**), the central `is_submission_globally_visible(uuid)` predicate, a widened proof-media
> Storage SELECT policy (Global viewers can load public posts' images), and recreates the write/read
> RPCs to carry the new fields. Client gets a uniform `isPublic` field + `<VisibilityToggle>` on
> Edit Profile / Edit Group / Create+Edit Challenge / Proof composer ("Share to Global", default
> off). Global feed itself NOT built yet. **USER must apply this migration BEFORE running the new
> build** (base selects now reference `visibility`). typecheck + lint + expo-doctor (18/18) all green.

> **2026-06-11 NEW Supabase project + schema live:** the backend moved to a fresh
> project **`ycbesrmtlcippgpswzta`** (`https://ycbesrmtlcippgpswzta.supabase.co`),
> **replacing `lppfqzqeaizbzunrxnpn`**. USER set the local (gitignored) `.env` and
> ran the bootstrap migration. Schema verified live via anon REST: `profiles` +
> `groups` return `HTTP 200 []`. **Still to confirm:** the 3 Storage buckets
> (`proof-media` private, `group-avatars` public, `user-avatars` public) exist in the
> new project; Edge Function `dispatch-pushes` + `DISPATCH_PUSH_SECRET` + `npx eas init`
> remain separate USER actions. Each Claude must point its OWN `.env` at this project.

> **2026-06-11 bootstrap consolidation:** the 25 incremental migrations
> (W-010 … W-038) were flattened into a single
> `supabase/migrations/20260528000000_bootstrap.sql` (~2,300 lines) that
> captures only the FINAL schema. The 25 originals were deleted. USER must
> apply ONLY the bootstrap on a fresh database. The 3 Storage buckets,
> Edge Function deploy, `DISPATCH_PUSH_SECRET`, and `npx eas init` remain
> separate USER actions (documented in the bootstrap's header).

> **2026-06-11 T-053-B…E refinement batch:** four more slices on top of T-053-A
> ship together. **W-035** (`comment_likes`): heart on every comment (counter
> only when > 0), long-press → BottomSheet of likers; "Add a comment…" + "Post"
> merged into one pill with a circular arrow-up send button.
> **W-036** (`freeform_reactions`): widens `submission_reactions.emoji` CHECK
> to 32 chars, adds `list_submission_reactors`, and the client adds
> `rn-emoji-keyboard` for a full system-style picker (`(+)` button → preset
> popover with REACTION_EMOJIS + a `(+)` that opens the full picker;
> long-press a chip → BottomSheet of reactors).
> **W-037** (`leaderboard_avatars`): `group_leaderboard` now returns
> `avatar_url`. New read-only `app/user/[id].tsx` route (avatar + name + bio
> + shared `ActivityHeatmap` + recent submissions, RLS-gated). CrownIcon
> redesigned (rounded peaks with gem dots, primary tint). Leaderboard rows
> = rank → avatar → name → crown-RIGHT → count. Tap → user profile.
> Transfer-leadership moved into the group 3-dot sheet → modal member
> picker.
> **W-038** (`streak_aggregate`): `get_my_streak_aggregate` returns current
> + best. Profile shows two StatTiles (🔥 current + 🏆 best). Pull-to-
> refresh wired on Home and Profile tabs; shared `<KeyboardDoneAccessory>`
> mounted at the root gives every multiline TextInput a native iOS "Done"
> button above the keyboard. **USER must apply W-035 + W-036 + W-037 + W-038.**

> **2026-06-11 T-053-A submission titles:** every submission now carries a required
> user-supplied title (1..80 chars). New migration **W-034**
> (`20260608000000_submission_titles.sql`) adds `submissions.title` NOT NULL with a
> backfill of `'Day N'` for legacy rows, and recreates five RPCs to thread / return the
> new column: `submit_proof`, `redact_my_submission`, `list_challenge_submissions`,
> `get_submission_with_author`, `get_my_today_submission`. Client: `ProofComposer` got a
> required Title input above the photo (also renamed its existing screen-heading prop
> from `title` → `screenTitle` to avoid clashing with the form field). `Submission`
> entity grew a `title: string` field; `proofInput` zod requires 1..80 chars; queue
> payload + processor pass title through (with an `'Untitled'` fallback for upgrade-window
> jobs). Display surfaces switched: challenge detail row → title primary + author/day
> below; submission detail → title at top, author w/ Avatar + Day + datetime below,
> photo, then description; verify screen → title at top + Day subline; profile rows →
> submission title primary + date (no time) + group name. **USER must apply W-034.**

> **2026-06-06 T-050A push registration:** `expo-notifications` + `expo-device` added
> (+ existing `expo-constants`). `app.json` registers the `expo-notifications` plugin
> (color `#6C5CE7`; no `icon` asset yet — uses app-icon fallback). `services/notifications`
> now does real registration with safe no-ops in every failure mode (Expo Go, simulator,
> missing EAS projectId, denied permission, token-fetch errors). One-shot bootstrap in
> `app/_layout.tsx` after `gate.target === '/(tabs)'`. New migration `20260606000000_push_tokens.sql`
> (W-032; renumbered from W-031). New `eas.json` skeleton — no Apple Team ID hardcoded. NO server-side dispatch,
> NO triggers, NO pg_cron, NO preferences in this slice; those land in T-050B/C.

> **2026-06-05 UI overhaul (phases 1–4):** theme recoloured violet → **INDIGO** (still
> user-selectable light/dark, Profile → Appearance). Added 5th **Explore** tab (placeholder).
> **Home** rebuilt (week + streak + today + conditional "Verify a friend" → `app/verifications.tsx`;
> RPCs W-029). **Groups**: create with photo avatar + description; 3-tab detail (Main / Leaderboard /
> Global placeholder) + gear menu; W-030 + a USER-created public `group-avatars` bucket. **Challenge
> creation** is a step wizard now (no migration). **Phase 5 (Challenges feed) NOT started.**
> Committed + pushed to `origin/mvp` this session.

> **2026-06-04 UI refresh:** app restyled to a violet light+dark theme (user-selectable in
> Profile → Appearance, persisted via SecureStore — no backend). New token palette + 8 new
> `src/shared/ui` primitives (StatTile/Chip/SegmentedControl/ProgressBar/ListRow/Avatar/Badge/Icon);
> restyled tab bar + Today/Challenges/Groups/Profile. Detail screens inherit the theme but aren't
> bespoke-restyled yet. Invite codes hardened to 12-char base62 (W-026, supersedes W-018).
> **Committed to `mvp` this session and pushed to `origin/mvp`.**

## Status: PHASE 4A COMPLETE + T-026..T-031 + UI overhaul ph.1–4 + T-050A · apply 15 migrations + 1 dashboard toggle + 1 storage bucket (group-avatars) + `npx eas init`

Phase 4A-1 (password reset + leave/archive group + archive challenge) is complete and
Phase 4A-2 (report/block UI + account-deletion request UI) is now done too. All MVP-scope
account controls and trust/safety surfaces exist in code. Phase 4A migration also got a
small fix: `create policy if not exists` (unsupported in Postgres for policies) replaced
with `drop policy if exists + create policy`.

T-026: the Groups tab now exposes Create group + Join with code CTAs and a link to a new
Archived groups screen; the create/join UI is shared between onboarding and the main app
via `GroupCreateOrJoinForm` in `src/features/groups/ui/`. Owners can restore archived
groups via a new `restore_group` RPC appended to W-019.

T-027: fixed B-011 — group challenge verification was broken because only the creator
was auto-joined into `challenge_participants`. Widened the `is_challenge_participant(uuid)`
helper so group members of `mode='group'` challenges implicitly count as participants.
Single helper change fixes all four affected RLS policies and three RPCs at once.
`challenge_streak` softened to return null instead of raising for true outsiders;
`getChallengeStreak` typed as `ChallengeStreak | null`. New migration
`20260603000000_group_member_is_participant.sql` (W-022) — USER must apply.

T-028: submission author display name now visible on the challenge detail "Recent
submissions" rows and the submission detail screen. Two new SECURITY DEFINER RPCs
(`list_challenge_submissions`, `get_submission_with_author`) join `profiles.username`/
`display_name` server-side without widening `profiles` RLS — matches the
`group_leaderboard` precedent. `Submission` entity grows optional `authorUsername`/
`authorDisplayName`. Migration `20260603100000_submission_authors.sql` (W-023) —
USER must apply.

T-029: owners/creators can now edit group + challenge metadata in place. Group: name
(owner-only). Challenge: title, category, duration, proof requirement (creator-only).
`start_date`/`mode`/`group_id`/`threshold` intentionally NOT editable. New `'work'`
category added. Two SECURITY DEFINER RPCs (`update_group`, `update_challenge`) with
server-side validation + duration-shrink guard. Modal routes `app/group/[id]/edit.tsx`
and `app/challenge/[id]/edit.tsx`. Migration
`20260603200000_update_group_and_challenge.sql` (W-024) — USER must apply.

T-030: group leader badge + transferable leadership. The leaderboard shows a small gray
`CrownIcon` (built dep-free from RN primitives) next to the leader. When the current
viewer IS the leader, tapping any non-self leaderboard row opens an Alert.alert
confirmation to transfer leadership. New `transfer_group_leadership` RPC. Also fixed
B-012 (edit-group input silently re-filling when backspaced to empty). Migration
`20260603300000_transfer_group_leadership.sql` (W-025) — USER must apply.

T-031 (latest session): challenge detail revamp. Removed the "Today" Card; in-screen
title + chip strip (category / mode+group / duration) + colored status bar
("Not submitted" / "Pending verification" / "Verified" / "Rejected"; solo collapses to
Submitted / Not submitted). "Best" → "Best Streak". New horizontal "Other contestants"
ribbon (group-only) showing each member's current+best streak. Primary button is
Submit-or-Edit (never "Add another"); hidden when archived/queued/group-verified;
"Edit submission" or "Edit and resubmit" otherwise. Three new SECURITY DEFINER RPCs:
`get_my_today_submission` (fixes the day-rollover bug — was returning latest, not
today's), `list_challenge_streaks`, `redact_my_submission`. New modal route
`app/challenge/[id]/edit-proof.tsx` reusing an extended `ProofComposer`. `useFocusEffect`
catches midnight rollover. Migration `20260604100000_challenge_today_and_redact.sql`
(W-027) — USER must apply.

Latest session shipped a clean Phase 4A-1 slice: password reset + leave group + archive group
+ archive challenge. Phase 4A-2 (report/block UI + account deletion request UI) is deferred,
but its server-side tables/RPCs are already in the same migration (W-019) so the user only
applies one SQL file. All checks green.

**Pending USER actions (idempotent migrations + one dashboard toggle):**
- W-014/W-015/W-016/W-017 — Phase 3 (verification, streaks, leaderboard, social).
- **W-026** — Secure 12-char invite codes (supersedes W-018 — apply this, NOT W-018).
- W-019 — Phase 4A (archive + trust/safety infra + restore_group).
- W-022 — Patch: treat group members as challenge participants (B-011 fix).
- W-023 — Patch: surface submission author display name (T-028).
- W-024 — Patch: in-place edit of group + challenge metadata (T-029).
- W-025 — Patch: transfer group leadership (T-030).
- W-027 — Patch: challenge detail revamp / today + streaks + redact (T-031).
- **W-028** — Patch: qualify column refs in `get_my_today_submission` (B-013 fix).
- **W-029** — Home overview RPCs (Home tab counts/streak + Verify inbox; 2026-06-05).
- **W-030** — Group profile: description + avatar columns/RPCs + RLS; ALSO create a public `group-avatars` Storage bucket (2026-06-05).
- _W-031 — Retired (was claimed by both the 2026-06-05 profile_description migration and T-050A push_tokens; resolved by moving push_tokens to W-032)._
- **W-032** — `push_tokens` table + register/unregister RPCs (T-050A). Also: run `npx eas init` once to mint a projectId, then `npx eas build --profile development -p ios|android` for real-device push testing.
- **W-033** — `notification_outbox` + verify_needed / verify_result triggers + dispatch RPCs (Supabase elevated role only) + hardening of W-032 grants (T-050B). Edge Function hardened on 2026-06-08: per-outbox aggregation (multi-device bug fix) + shared-secret header. **USER must:** apply the migration, set `DISPATCH_PUSH_SECRET` via `npx supabase secrets set`, deploy with `npx supabase functions deploy dispatch-pushes --no-verify-jwt`, and (if not yet done) run `npx eas init` for the projectId. Type-check the function with `deno check supabase/functions/dispatch-pushes/index.ts`.
- W-020 — Auth → URL Configuration → add `basta://reset-password` to Redirect URLs.

The full MVP loop now exists in code: register → group → challenge → submit proof (offline) →
friend verifies → streak → group leaderboard, plus reactions + comments on each proof. Remaining
MVP: notifications (T-050 — note: remote push needs a dev build/EAS, not Expo Go), trust/safety
(T-051/T-052), tests (T-060), CI/EAS (T-061/T-062). Optional UI follow-ups: screen-level Retro
polish, exact Retro serif font.

Phase 1 + Phase 2 are applied and smoke-tested on-device (USER confirmed W-011 done: Phase 2
migration applied, `proof-media` bucket created, create-challenge / submit-proof loop works).

**This session (Phase 3 social loop + Retro UI), all committed to `mvp` + pushed:**
- **T-040 verification** — `verifications` table + `verify_submission` RPC (threshold-approve /
  single-reject, D-009); `submit_proof` replaced to auto-verify solo proofs; widened proof-media
  storage SELECT; `src/features/verification`; `app/verify/[submissionId].tsx`; verify affordance.
- **T-042 streaks** — `challenge_streak` computed-on-read RPC (tz-correct via stored
  `challenge_day`, D-010); `useChallengeStreak`; streak stat cards on challenge detail.
- **T-043 leaderboard** — `group_leaderboard` RPC; `src/features/leaderboard`; real Groups tab
  list → `app/group/[id].tsx` (invite code + ranked board).
- **T-041 reactions + comments** — `submission_reactions`/`submission_comments` + RPCs;
  `src/features/social` (ReactionBar + CommentsSection); `app/submission/[id].tsx`.
- **UI** — Retro.app-inspired theme (serif display, outlined pill buttons, white canvas, blue
  accent) at the design-system level; Profile **Sign out** button wired.

**Migrations PENDING (USER) before Phase 3 works at runtime:** W-014 verification · W-015 streaks ·
W-016 leaderboard · W-017 social — all idempotent; paste each into Supabase SQL editor. Phase 1+2
already applied (W-011 done).

**Stack:** Expo SDK 54 · React 19.1.0 · RN 0.81.5 · expo-router 6.0.23 · TS 5.9.2 ·
@types/react 19.1.10 · eslint-config-expo 10. **Native-only** (`platforms: ["ios","android"]`;
`react-native-web` removed — D-006).

**Latest checks (this handoff):** `npm run typecheck` → green ✅ · `npm run lint` → green ✅ ·
tests → none configured (W-007). `npx expo-doctor` was 18/18 ✅ earlier this session. The Phase 3
features have NOT been exercised at runtime — pending the four migrations above.

## How to run
- `npm install` (1131 pkgs; node_modules gitignored). Then `npm start` (Expo dev server).
- `npm run typecheck` (tsc --noEmit) and `npm run lint` (eslint + import boundaries) — both green.
- `expo-env.d.ts` is gitignored; Expo regenerates it on `npx expo start`. A copy was created so a
  fresh checkout can typecheck immediately.

## Repository
- **Git:** ✅ Initialized (branch `main`); local identity set (repo-local).
- **Current branch:** `mvp` (feature branch; pushed to `origin/mvp`).
- **Remote:** `origin` → https://github.com/Dastanq44/Basta-App (`mvp` pushed; `main` local only).
- **Recent commits (mvp), this session (pushed):** `1b04dae` T-040 verification + Retro UI +
  sign-out → `d49b624` T-042 streaks → `05ed44a` T-043 leaderboard → `1111469` T-041
  reactions/comments → + this handoff doc commit (see `git log`).
- **Working dir:** repo root (machine-relative — each Claude clones to their own path).

## What exists
- `.gitignore` (hardened for secrets), `README.md`, `CLAUDE.md`, `AGENTS.md`.
- `docs/claude-memory/*` — shared-memory system (8 files).
- `docs/architecture/*` — **architecture proposal** (ARCHITECTURE, DATA_MODEL, OFFLINE_SYNC,
  NAVIGATION, SUPABASE_SCHEMA_DRAFT). Proposal only — no code, no applied migrations.
- **Shared Claude config (two-agent workflow):** `.claude/settings.json` (model=opus,
  permissions), `.claude/skills/mobile-app-architect/` (project skill), `.githooks/pre-commit`
  (secret scanner — enable per clone with `git config core.hooksPath .githooks`),
  `scripts/bootstrap-claude.md` (Claude 2 onboarding).
- **App foundation (Phase 0):** `package.json`, `tsconfig.json`, `app.json` (expo-router +
  typedRoutes), `babel.config.js`, `.eslintrc.js` (import boundaries), `.env.example`.
  - `app/` — navigation shell: root `_layout` (providers + **session gate / redirect**),
    `(tabs)/` (Today/Challenges/Groups/Profile), `challenge/[id]`, `+not-found`. Phase 1 routes
    **wired**: `(auth)/_layout` + `sign-in` · `sign-up` · `verify-email` (real forms);
    `(onboarding)/_layout` + `profile-setup` · `join-or-create-group` (still placeholders —
    T-022/T-023).
  - `src/shared/ui/` — theme tokens + `ThemeProvider` + primitives (Text, Button, Card, Screen,
    **Input**).
  - `src/shared/lib/` — `queryClient`, `env` (now validates Supabase vars), **`supabase`** (client
    with SecureStore adapter + PKCE).
  - `src/entities/` — domain models (user, group, challenge, submission, verification) + mappers/.
  - `src/offline/` — engine-agnostic skeleton (db, queue types, upload interface). D-007 settled
    = Expo SQLite + MMKV; implementation lands in Phase 2.
  - `src/services/` — analytics (typed events), crash, notifications — no-op interfaces.
  - `src/features/auth/` — **implemented (T-020)**: api/, hooks/ (`useSession`, `useSignIn`,
    `useSignUp`, `useVerifyOtp`, `useSignOut`), model/ (zod schemas). All other features remain
    `index.ts`-only skeletons.
  - `src/navigation/` — `routes` (typed helpers), `guards`, `linking`.

## Per-clone setup (each Claude account must do once)
- `git config core.hooksPath .githooks` to activate the secret-scan hook.
- New accounts: follow `scripts/bootstrap-claude.md` (install shared skills, set identity).

## Decisions (resolved)
- **D-007** — local persistence engine: **Expo SQLite + MMKV** (Accepted; WatermelonDB deferred).
  Implementation lands in Phase 2. No open foundation decisions remain.
- **D-008** — media upload: standard Supabase Storage first; tus/resumable deferred (Accepted).

## What runs
- Nothing yet — there is no app to run.

## Environment / tooling available
- Node v24.16.0, git 2.52 (Windows). `gh` CLI not installed. Expo/EAS not set up yet.
- Skills installed under `~/.claude/skills/` (incl. local `mobile-app-architect`). NOTE: skills
  register only after a Claude Code session reload.

## Not yet decided / needs setup
- **Supabase project** is now `ycbesrmtlcippgpswzta` (was `lppfqzqeaizbzunrxnpn`); URL + anon key in local `.env`. **Bootstrap schema APPLIED + verified live (2026-06-11).** Older note below is superseded. **Schema
  not applied yet** (T-003).
- **Supabase email-template config (USER):** confirm `{{ .Token }}` is in the "Confirm signup"
  template — required for OTP flow (W-008).
- No CI/CD, no EAS config, no analytics/crash SDK wired (T-012, T-061).

## Next concrete step
See `HANDOFF.md` → Next Up. Short version: USER applies the three Phase 3 migrations (W-014
verification, W-015 streaks, W-016 leaderboard) and smoke-tests the full loop. Then the next code
task is **T-050 (push notifications)** — also unlocks the deferred bits (verify deep-link from
T-040, "streak at risk" cron from D-010) — or **T-041 (reactions + comments)**. Optional UI
follow-ups: screen-level Retro polish, exact Retro serif font.
