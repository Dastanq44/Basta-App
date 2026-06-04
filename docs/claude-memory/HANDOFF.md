# HANDOFF.md

> **Session-to-session relay log.** The most important file for swapping between the two Claude
> accounts. APPEND a new entry at the TOP at the end of every session. Never delete history.

## How to use this file
- **Starting a session:** read the latest entry (top). It tells you exactly where to pick up.
- **Ending a session:** add a new entry at the top using the template below. Be concrete. Name
  files, branches, commit hashes, and the exact next action.

### Entry template
```
## YYYY-MM-DD — <account / session label>
**Did:** <what got done this session>
**In progress:** <anything half-finished + where it stands>
**Next up:** <the precise next action(s) for whoever picks up>
**Blockers / decisions needed:** <anything requiring the user or another account>
**Branch / commit:** <branch name @ short hash, or "no repo yet">
**Notes for next session:** <traps, context, things not obvious from the code>
```

---

## 2026-06-04 — Claude 1 / T-031 polish: SQL bug + safe-area + status box restyle

**Did:** Three small fixes on top of T-031 from earlier today.

### Fix 1 — B-013: SQL `column reference "id" is ambiguous`
- `get_my_today_submission` (added in W-027) raised PostgreSQL 42702 on every call.
- The function returns a TABLE whose first OUT column is `id`. Inside a plpgsql body,
  the OUT params are in scope as variables. The body had
  `where id = v_uid` on `public.profiles` — that bare `id` collided with the OUT
  variable `id` and Postgres can't decide which.
- Fix: qualify the references (`where profiles.id = v_uid`,
  `where challenges.id = p_challenge_id`). Issued as a fresh patch migration
  (`20260604200000_fix_today_submission_ambiguity.sql`, **W-028**) instead of editing
  W-027 in place, since the user has already applied W-027 and the audit trail
  is more honest with a follow-up file.
- The other table-returning RPCs in the same family (`list_challenge_streaks`,
  `get_submission_with_author`, `list_challenge_submissions`) were already
  fully qualified — no rework needed.

### Fix 2 — UI: background-colored strip above the challenge name
- The user saw a rectangle in the screen background color between the native Stack
  header (white) and the in-screen title, and content scrolled behind it.
- Root cause: `Screen` defaults `edges={['top','bottom']}`. The native Stack header
  already accounts for the top safe-area inset; when we ALSO add 'top' inside the
  `SafeAreaView`, a background-colored stripe equal to the inset height appears
  between the header and content.
- Fix: `<Screen padded={false} edges={['bottom']}>` on the challenge detail. Comment
  in the file explains why. Other screens with the same pattern (`app/group/[id].tsx`,
  `app/submission/[id].tsx`, `app/verify/[submissionId].tsx`) have the same latent
  issue but the user only flagged challenge detail — leaving them for if/when they
  surface the others.

### Fix 3 — Status box restyle
- Removed the 4px left-side colored accent ("the small shadow on the left").
- Added a full 1.5px contour in the status color (with `t.colors.card` background).
- New muted palette in [app/challenge/[id].tsx](app/challenge/[id].tsx) (above
  `StatusBar`):
  - `STATUS_RED = '#C26B6B'` (soft brick) — "Not submitted" / "Rejected".
  - `STATUS_AMBER = '#C9A04C'` (muted gold) — "Pending verification".
  - `STATUS_GREEN = '#7FA88A'` (sage) — "Submitted" / "Verified".
  Inline constants because no other screen needs them yet; promote to theme tokens
  if a second surface adopts them. They're readable on both light and dark
  backgrounds and explicitly avoid neon brightness per the user's instruction.
- Label text now uses `t.colors.foreground` (was using the same color as the
  border, which competed with the contour visually).

**Checks:** `npm run typecheck` ✅ · `npm run lint` ✅ · `npx expo-doctor` ✅.

**Branch / commit:** `mvp` @ <see post-commit hash>

**Next up:**
1. **User action (W-028):** apply the small SQL fix via Supabase Dashboard SQL editor.
   Without it the challenge detail still 42702s.
2. The other W-actions pending: W-022..W-027 + W-019, W-014..W-017, W-018 (skip,
   superseded by W-026), W-020 + W-008 (dashboard toggles).
3. Optional: the same safe-area fix on group/submission/verify detail screens if the
   user reports the same stripe elsewhere.

**Blockers / decisions needed:** None.

**Notes for next session:**
- Future plpgsql functions that `RETURNS TABLE (id …, …)`: ALWAYS qualify every column
  reference in the body, even the ones that look unambiguous. Postgres' "PL/pgSQL var
  vs column" check fires on bare identifiers. A simple project convention prevents this.
- The status box uses local constants, not theme tokens. If we ever want to make the
  status colors theme-aware (different shades light vs dark), promote them to
  `tokens.ts` as `statusRed` / `statusAmber` / `statusGreen` — but the current hex
  values are intentionally chosen to read on both modes.

---

## 2026-06-04 — Claude 1 / T-031: challenge detail revamp + redact-submission flow

**Did:** Substantial rebuild of the challenge detail screen per the user's revamp spec,
plus a correctness fix for the day-rollover bug they called out.

### UI changes ([app/challenge/[id].tsx](app/challenge/[id].tsx))
- Removed the "Today" Card entirely (status + submit button merged into the new layout).
- In-screen title (`<Text variant="title">{c.title}</Text>`) at the top.
- New encapsulated metadata chips below the title — three `MetaChip`s: category,
  mode (`Solo` or `Group · <name>`), duration.
- New `StatusBar` with a left color accent: "Not submitted" / "Pending verification" /
  "Verified" / "Rejected" for group, collapses to "Not submitted" / "Submitted" for solo.
- Streak cards: "Best" → "**Best Streak**" (user's exact phrasing). 🔥 Current unchanged.
- New `ContestantsStreakRibbon` — horizontal scroll strip of `{name, 🔥 current, Best
  longest}` chips. Group-only (hidden for solo). Excludes self (the Current/Best cards
  above are already the caller's stats).
- Single primary button via `computePrimaryAction()`:
  * archived / queued → **hidden** (sync badge surfaces queue state).
  * no today submission → **Submit today's proof**.
  * solo + has today submission → **Edit submission**.
  * group + pending_verification → **Edit submission**.
  * group + rejected → **Edit and resubmit**.
  * group + verified → **hidden** (locked).
  No more "Add another (replaces today)" state.

### The day-rollover fix (the bug the user explicitly mentioned)
- Root cause was in `getMyTodaySubmission`: it pulled `.order('created_at').limit(1)`,
  which returns the LATEST submission regardless of day. After midnight with no new
  submission, that latest row is yesterday's — so today's status appeared "submitted"
  when it should be "not submitted."
- Fix: server RPC `get_my_today_submission(p_challenge_id)` computes today's
  `challenge_day` per the caller's profile timezone (matches `submit_proof`'s math
  exactly) and returns ONLY the matching row.
- Plus: the screen uses `useFocusEffect` (expo-router) to invalidate
  `todaySubmissionQueryKey(id)` + `challengeStreaksQueryKey(id)` every time it gains
  focus. Combined with the server-side day math, putting the phone down at 11:58 PM
  and reopening at 7 AM yields the correct "Not submitted" + Submit button.

### Redact (in-place edit) flow
- New modal route `app/challenge/[id]/edit-proof.tsx`.
- Reuses `ProofComposer` — I extended it with optional `title`, `intro`, `ctaLabel`,
  `initialComment` props so the same UI serves both new submissions (offline-queue
  path) and edits (direct RPC path).
- New hook `useRedactMySubmission` — uploads the new photo at the SAME deterministic
  Storage path (`<uid>/<challengeId>/<submissionId>.jpg`, upsert overwrites → no
  orphaned objects), then calls the redact RPC. NOT routed through the offline queue
  by design (queuing an edit while offline would race against verifications on the
  prior content; comment in the hook explains).
- Server `redact_my_submission` RPC enforces:
  * author-only, not-archived;
  * group + status='verified' → locked (per user's explicit rule);
  * solo + challenge_day != today's day → locked (per user's explicit rule);
  * group + pending|rejected → clears all `verifications` rows, resets status to
    `pending_verification` so the new content is re-verified.
- Cache invalidation in the mutation: today / submissions list / single / streak /
  streaks-ribbon / signed-URL (the path is unchanged, but a fresh signed URL is
  generated so RN `Image` sees a new URL string and refetches).

### Files
**Created:**
- `supabase/migrations/20260604100000_challenge_today_and_redact.sql` — three RPCs
  above. **USER must apply (W-027).**
- `src/features/proofs/hooks/useChallengeStreaks.ts`.
- `src/features/proofs/hooks/useRedactMySubmission.ts`.
- `app/challenge/[id]/edit-proof.tsx`.

**Modified:**
- `app/challenge/[id].tsx` — full rebuild as described above.
- `app/_layout.tsx` — registered `challenge/[id]/edit-proof` modal.
- `src/features/proofs/api/index.ts` — `getMyTodaySubmission` now calls RPC; new
  `listChallengeStreaks` + `redactMySubmission`. Removed the now-unused `COLS` const.
- `src/features/proofs/hooks/index.ts` + `src/features/proofs/index.ts` — public surface.
- `src/features/proofs/ui/ProofComposer.tsx` — added `title`/`intro`/`ctaLabel`/
  `initialComment` optional props (back-compat — defaults match the old behavior).
- `src/entities/streak.ts` + `src/entities/index.ts` — new `ContestantStreak` type.

**Checks:** `npm run typecheck` ✅ · `npm run lint` ✅ (was 1 warning about unused
`COLS`, fixed by removal).

**Branch / commit:** `mvp` @ <see post-commit hash>

**Next up:**
1. **User action (W-027):** apply the new migration via Supabase Dashboard SQL editor.
   The challenge detail screen will throw "function does not exist" errors until then.
2. Stack of pending USER actions also includes W-026 (Claude 2's secure invite codes),
   W-022..W-025, W-019, W-014/15/16/17, W-018 (skip — superseded by W-026), W-020 + W-008.
3. T-050 push notifications or Phase 5 quality/release.

**Blockers / decisions needed:** None.

**Notes for next session:**
- The redact RPC purposely clears group votes on edit. If a UX review later prefers
  "preserve votes when only the comment changed" we'd need a `comment_only` flag — but
  for MVP, treating any edit as a content change is correct and simpler.
- Storage path is reused on redact (overwrite). If we ever want a per-version history,
  switch to versioned filenames + cleanup on a cron — not now.
- The contestants ribbon excludes self **on the client**, not server-side, because the
  RPC returns everyone (the caller might want their own row visible elsewhere). If we
  add a "compare to my streak" feature later, this client filter is the only thing that
  needs to change.
- I picked the **scrollable horizontal ribbon** (user offered "scrollable OR expandable")
  for minimal extra UI state. Swap to expandable later if it doesn't fit the violet
  design language — the component is `<ContestantsStreakRibbon>` and self-contained.
- I left the "Other contestants" header label as a small caption. Probably wants
  a violet-design polish pass alongside the other detail-screen restyles Claude 2
  flagged in the prior handoff.

---

## 2026-06-04 — Claude 2 / UI refresh ("sleek violet") + secure invite codes

**Did:** A full visual redesign of the app (from a user-supplied reference) + hardening of group
invite codes. Both green: `npm run typecheck` ✅ · `npm run lint` ✅. **The UI work touched NO
backend**; the only backend change is the invite-code migration (user explicitly asked for it).

### Part 1 — UI refresh (violet, light + dark, switchable in settings)
- **New tokens** (`src/shared/ui/theme/tokens.ts`): vivid violet accent (`#6C5CE7` light /
  `#7C6CFF` dark), soft off-white light canvas + deep indigo-navy dark canvas, **system sans**
  (dropped the Georgia serif), softer diffused shadows, added `radius.xxl` / `fontSize.xxxl` and
  tokens `primarySoft` / `streak`. Every screen inherits via the token system (D-005).
- **User-selectable theme mode** (light / dark / system), persisted on-device via
  `expo-secure-store` — **no backend, no new deps**. `src/shared/lib/themePreference.ts` + a
  rewritten `ThemeProvider` exposing `useThemeMode()`; theme-aware StatusBar. Toggle UI is in
  **Profile → Appearance** (SegmentedControl).
- **8 new dep-free primitives** (`src/shared/ui/`): `StatTile, Chip, SegmentedControl,
  ProgressBar, ListRow, Avatar, Badge, Icon` (icons composed from RN Views — no icon library,
  matching the `CrownIcon` precedent; `@expo/vector-icons` is NOT installed). Restyled `Text`
  (sans, +`subtitle`/`label`), `Button` (violet pill + soft glow + optional `icon`), `Card`
  (rounded + hairline border).
- **Restyled the 4 tab screens:** tab bar (dep-free icons + violet active, native header OFF),
  Today (new "home": greeting, momentum hero, stat tiles bound to **real** counts, quick actions),
  Challenges + Groups (avatars / icon tiles / chevrons), Profile (+ theme toggle).
- **NOT restyled bespoke yet (they inherit tokens though):** detail screens — group leaderboard
  ("Лидеры"), challenge detail, submission/verify. Offered as follow-up.
- **Scope guard:** the reference shows XP/levels (out of MVP, D-006). I replicated the *look* but
  bound stats to **real** data (active-challenge / group counts) — did NOT build a fake XP system.

### Part 2 — Secure invite codes (supersedes W-018)
- 4-digit codes = 10,000 combos = brute-forceable (anyone could enumerate and join groups).
  Replaced with **12-char base62 `[A-Za-z0-9]`** (62^12 ≈ 3.2×10^21), **case-sensitive**,
  crypto-random (`gen_random_bytes`).
- New migration `supabase/migrations/20260604000000_secure_invite_codes.sql` (**W-026**):
  `generate_invite_code()` + new column default + regen of weak codes + a DB CHECK constraint so a
  weak code can never be inserted again. **Join RPC unchanged** — it already does an exact
  `invite_code = p_code` comparison, so case-sensitivity worked already.
- Client: `inviteCodeSchema` → `/^[A-Za-z0-9]{12}$/` (trim only, case preserved);
  `GroupCreateOrJoinForm` join input is now a plain text field (no number-pad, `autoCapitalize
  none`, maxLength 12); `app/group/[id].tsx` shows the code as a selectable chip
  ("tap & hold to copy"). Decision recorded as **D-011**.

**USER actions:**
- **Apply W-026** (`20260604000000_secure_invite_codes.sql`). You can **skip W-018** — it's
  superseded, and W-026 upgrades any existing weak codes. All other pending migrations
  (W-014..W-017, W-019, W-022..W-025) + dashboard toggles (W-020, W-008) still stand.

**Changed files:**
- Design system: `src/shared/ui/theme/{tokens,ThemeProvider,index}.ts(x)`, `src/shared/ui/index.ts`,
  `Text.tsx`, `Button.tsx`, `Card.tsx`; NEW `src/shared/ui/{Avatar,Badge,Chip,Icon,ListRow,ProgressBar,SegmentedControl,StatTile}.tsx`;
  NEW `src/shared/lib/themePreference.ts`.
- Screens: `app/_layout.tsx`, `app/(tabs)/{_layout,index,challenges,groups,profile}.tsx`, `app/group/[id].tsx`.
- Invite codes: `src/features/groups/model/schemas.ts`, `src/features/groups/ui/GroupCreateOrJoinForm.tsx`,
  NEW `supabase/migrations/20260604000000_secure_invite_codes.sql`.
- Docs: all six `docs/claude-memory/*`.

**Tests run:** `npm run typecheck` ✅ · `npm run lint` ✅ (both green after all changes).
**Tests NOT run:** unit/component/E2E — none configured (W-007, no test runner). The app was NOT
launched on a device this session — the new UI (violet light/dark + theme toggle) is unverified
visually at runtime.

**Known issues / warnings for the next Claude:**
- **Apply migration W-026** before trusting invite-code join. The rest of the backlog still stands
  (W-014..W-017, W-019, W-022..W-025; dashboard W-020/W-008). **Skip W-018** (superseded).
- UI not run on-device — verify the themes + Profile→Appearance toggle visually.
- Icons are dep-free `View` art (`Icon.tsx`), not a vector set (simple geometric glyphs). For
  crisper icons add `react-native-svg` (Expo-Go compatible) or `@expo/vector-icons` later.
- Detail screens (group leaderboard, challenge, submission, verify, onboarding) inherit the new
  theme via tokens but were NOT bespoke-restyled — layout polish needed to fully match the ref.
- Skill-CLI artifacts (`.agents/`, `skills-lock.json`, `.claude/skills/{find-skills,
  high-end-visual-design}/`) are **gitignored** (account-local). Re-install via `npx skills add`.

**Branch / commit:** `mvp` — committed this session (see `git log`); pushed to `origin/mvp`.

**Next up:** (1) apply W-026; (2) optional — restyle the detail screens (leaderboard avatars +
crown, challenge, invite) to match the reference pixel-closer; (3) the standing MVP backlog
(T-012 analytics, T-060 tests, T-061 EAS/CI → which unblocks T-050 push).

---

## 2026-06-03 — Claude 1 / T-030: group leader badge + transferable leadership (+ B-012 fix)

**Did:** Two things in one PR — fixed an edit-group input bug (B-012) and added a real
"group leader" concept with a crown badge on the leaderboard and a tap-to-transfer flow.

### Part 1 — B-012 fix
- `app/group/[id]/edit.tsx` previously rehydrated `name` from `group.name` whenever
  `name === ''`. That meant a user backspacing to clear the field silently refilled with
  the previous name. Replaced with a one-shot `hydrated` flag (init to `true` if `group`
  is already present at mount, otherwise set on first arrival of the data). After seed,
  user edits are left alone.

### Part 2 — Group leader + transferable leadership
- The data model already supports it: `groups.owner_id` is the leader, and
  `group_members.role` carries `('owner','admin','member')`. The only missing piece was a
  way to hand the role to another member. Until now the owner was the only one who could
  edit/archive, and the sole-owner-leave guard meant they were stuck.

**Files created:**
- `supabase/migrations/20260603300000_transfer_group_leadership.sql` — idempotent
  `transfer_group_leadership(p_group_id, p_new_owner_id)` RPC. Owner-only, not-archived,
  new owner must be an existing non-self member. Flips both `groups.owner_id` and the
  two relevant `group_members.role` rows (previous owner → 'member', new owner →
  'owner') in one transaction. **USER must apply (W-025).**
- `src/shared/ui/CrownIcon.tsx` — dep-free crown built from three border-trick triangles
  on a small bar, tinted with `t.colors.mutedForeground` by default. Sized for inline
  use next to heading text. We considered `@expo/vector-icons` but `npx expo install`
  hit the recurring W-013 ERESOLVE on `react-dom`; building from `View` primitives
  avoids the dep entirely and produces a small, theme-tintable shape.
- `src/features/groups/hooks/useTransferGroupLeadership.ts` — mutation that invalidates
  `myGroupsQueryKey` so the new `ownerId` and owner-only affordances refresh on the
  previous owner's device.

**Files modified:**
- `src/features/groups/api/index.ts` — `transferGroupLeadership(groupId, newOwnerId)`
  wrapper.
- `src/features/groups/hooks/index.ts` + `src/features/groups/index.ts` — public surface.
- `src/shared/ui/index.ts` — exports `CrownIcon` + `CrownIconProps`.
- `app/group/[id].tsx` — `LeaderboardRow` now takes `isLeader` and `onTransfer`. Shows
  the crown next to the leader's name. When the current viewer is the owner and the row
  is a non-self member, the whole row becomes a `Pressable` that opens an `Alert.alert`
  confirmation ("Make {name} the leader?") matching the existing confirm-pattern used by
  Leave / Archive. Server response errors surface in a second alert.
- `app/group/[id]/edit.tsx` — B-012 rehydration fix described above.

**Checks:** `npm run typecheck` ✅ · `npm run lint` ✅ · `npx expo-doctor` ✅ (18/18).

**Branch / commit:** `mvp` @ <see post-commit hash>

**Next up:**
1. **User action (W-025):** apply the patch migration via Supabase Dashboard SQL editor.
   Tapping a leaderboard row as owner will fail with `function does not exist` until then.
2. **User action (still open):** W-022, W-023, W-024 (this branch's prior migrations);
   W-019 (Phase 4A + restore_group); W-014/15/16/17/18; W-020 (deep-link allow-list).
3. T-050 push notifications or Phase 5 quality/release.

**Blockers / decisions needed:** None.

**Notes for next session:**
- The "Only group leader can modify group name" requirement is already enforced by the
  T-029 RPC (`update_group` checks `owner_id = auth.uid()`). After a transfer, the new
  owner can edit and the previous owner can no longer reach the Edit button (it's
  conditional on `isOwner`).
- We did NOT add an "Admin" promotion flow even though `member_role` includes 'admin'.
  Roles other than 'owner' have no UI consequences today; if/when we wire admin-only
  affordances, the same RPC pattern applies.
- `CrownIcon` is a general primitive in `shared/ui` — reusable. If a future feature
  wants a colored variant (e.g. a gold "first place" crown on the leaderboard), pass
  `color={...}`.
- `useGroupLeaderboard` is invalidated by every group mutation through the existing
  `useMyGroups` invalidation chain — but the leaderboard query key (`groupLeaderboardQueryKey`)
  is NOT explicitly invalidated by `useTransferGroupLeadership`. The crown updates
  because the row data already comes from `useMyGroups.ownerId`, not the leaderboard
  RPC. If we ever move leadership info into the leaderboard RPC, also invalidate
  `groupLeaderboardQueryKey(groupId)` on transfer success.

---

## 2026-06-03 — Claude 1 / T-029: edit group + challenge in place; add Work category

**Did:** Until now groups and challenges were write-once after creation. Added an in-place
edit path for both (Edit button → modal form → save), plus a new `'work'` category.

**Scope (intentionally tight):**
- Group: `name` only (owner-only). Invite code stays auto-generated.
- Challenge: `title`, `category`, `duration_days`, `proof_requirement` (creator-only).
- NOT editable: `challenges.start_date` (would invalidate `submissions.challenge_day` —
  the offline-safe day index is computed at submit time against this), `mode`, `group_id`,
  `verification_threshold`. Creators needing different start/mode archive + create new.

**Files created:**
- `supabase/migrations/20260603200000_update_group_and_challenge.sql` — idempotent
  CREATE OR REPLACE on `update_group` and `update_challenge`. Both gated by
  owner/creator + not-archived; both validate field shapes server-side (length caps,
  category allow-list mirroring `CHALLENGE_CATEGORIES`, duration ∈ [1,365]). The
  challenge RPC includes a **duration-shrink guard**: if the requested duration is
  shorter than `max(submissions.challenge_day) + 1`, the update is rejected (we don't
  silently orphan history). **USER must apply (W-024).**
- `src/features/groups/hooks/useUpdateGroup.ts` — invalidates `myGroupsQueryKey` +
  `myArchivedGroupsQueryKey` so the new name lands wherever the group is referenced.
- `src/features/challenges/hooks/useUpdateChallenge.ts` — invalidates
  `challengesQueryKey` + `challengeQueryKey(id)`.
- `app/group/[id]/edit.tsx` — modal route. Owner-only UI guard (server also enforces);
  zod `groupNameSchema` for client validation; idempotent "no-op if unchanged" exit.
- `app/challenge/[id]/edit.tsx` — modal route. Creator-only UI guard; pre-fills from
  `useChallenge`; uses the new `updateChallengeInput` zod schema. Archived challenges
  show a friendly "can't be edited" state instead of the form.

**Files modified:**
- `src/features/challenges/model/schemas.ts` — added `'work'` to `CHALLENGE_CATEGORIES`.
  Extracted reusable field schemas (`challengeTitle`, `challengeCategory`, etc.) and
  introduced `updateChallengeInput` (mutable subset). Categories list and validation
  are now a single source of truth between create + edit forms.
- `src/features/challenges/model/index.ts` — re-exports `updateChallengeInput` and
  `UpdateChallengeInput`.
- `src/features/challenges/api/index.ts` — `updateChallenge(challengeId, input)` calls
  the new RPC (camelCase → snake_case mapping at the boundary).
- `src/features/challenges/index.ts` + `hooks/index.ts` — public surface exports.
- `src/features/groups/api/index.ts` — `updateGroup(groupId, name)` calls
  `update_group` RPC.
- `src/features/groups/hooks/index.ts` + `index.ts` — public surface exports.
- `app/_layout.tsx` — registered two modal routes:
  `challenge/[id]/edit` (`presentation: 'modal'`, title `Edit challenge`),
  `group/[id]/edit` (`presentation: 'modal'`, title `Edit group`).
- `app/group/[id].tsx` — added an **Edit group** button in the Settings footer above
  Archive (owner-only).
- `app/challenge/[id].tsx` — added an **Edit challenge** button in Settings above
  Archive (creator-only, hidden for archived).

**Checks:** `npm run typecheck` ✅ · `npm run lint` ✅ · `npx expo-doctor` ✅ (18/18).

**Branch / commit:** `mvp` @ <see post-commit hash>

**Next up:**
1. **User action (W-024):** apply the patch migration via Supabase Dashboard SQL editor.
   Edit buttons throw `function does not exist` until then.
2. **User action (still open):** W-022, W-023 (this branch's previous two migrations),
   W-019 (Phase 4A + restore_group), W-014/15/16/17/18, W-020 (deep-link allow-list).
3. T-050 push notifications (gated by Expo Go) or Phase 5 quality/release.

**Blockers / decisions needed:** None.

**Notes for next session:**
- The duration-shrink guard is the only "interesting" server check — it prevents the
  worst footgun (silently orphaning days). If a future "Day N out of N" UI surfaces the
  challenge end date, it stays correct after edits because we recompute from
  `start_date + duration_days`.
- The challenge category is stored as `text`, not a Postgres enum. The RPC enforces the
  allow-list inline. If we later turn it into an enum, we'll need an `alter type ... add
  value 'work'` migration first AND update the RPC's allow-list to remove the inline
  check. Two-step on purpose — see CLAUDE.md "no half-finished" rule.
- `start_date` edit is deferred, not forgotten. If we ever support it we'll need a
  server function that recomputes every `submissions.challenge_day` for that challenge
  (or rejects edits when submissions exist). For MVP, archive+recreate is the answer.

---

## 2026-06-03 — Claude 1 / T-028: show submission author name on challenge + submission detail

**Did:** Submission rows on the challenge detail and the submission detail screen
previously only showed "Day N" with no indication of who submitted. Added the author's
display name on both screens without widening `profiles` RLS.

**Approach:** followed the existing `group_leaderboard` precedent — two new SECURITY
DEFINER RPCs that join `profiles` server-side and expose only `username` +
`display_name` (other profile columns stay private). Both gated by the W-022
participant helper, so outsiders still get nothing.

**Files created:**
- `supabase/migrations/20260603100000_submission_authors.sql` — idempotent
  CREATE OR REPLACE on two functions:
  - `list_challenge_submissions(p_challenge_id uuid, p_limit int)` — returns the
    challenge's recent submissions plus `author_username` + `author_display_name`.
  - `get_submission_with_author(p_submission_id uuid)` — single-submission variant
    used by the submission detail + verify screens.
  **USER must apply (W-023)** — without it both screens hit `function does not exist`.

**Files modified:**
- `src/entities/submission.ts` — `Submission` grows optional `authorUsername?` and
  `authorDisplayName?`. Present after the new RPCs; absent for locally-queued items and
  the self-only `getMyTodaySubmission` path (where the author is always the viewer).
- `src/features/proofs/api/index.ts` — `listSubmissionsForChallenge` and `getSubmission`
  now call the new RPCs. Added a `SubmissionWithAuthorRow` type and a `toSubmissionWithAuthor`
  mapper next to the existing `toSubmission`.
- `app/challenge/[id].tsx` — `SubmissionRow` heading becomes the author label
  (`displayName ?? @username ?? "Member"`); "Day N" demotes to a muted subline.
- `app/submission/[id].tsx` — same label as the row heading next to the sync badge;
  "Day N" demotes to muted subline. (Stack-screen header title still shows "Day N+1"
  since that's the navigational context.)

**Verify screen note:** `app/verify/[submissionId].tsx` also reads `useSubmission`, so
the new author fields are present in its `submission.data`. I deliberately did not
surface them there — the user asked for these two screens specifically, and adding it
to verify is a one-line change a future session can do if asked.

**Checks:** `npm run typecheck` ✅ · `npm run lint` ✅ · `npx expo-doctor` ✅ (18/18).

**Branch / commit:** `mvp` @ <see post-commit hash>

**Next up:**
1. **User action (W-023):** apply the new migration via Supabase Dashboard SQL editor.
2. **User action (still open):** W-022 (group-member-is-participant fix), W-019
   (Phase 4A + restore_group), W-014/15/16/17/18, W-020 (deep-link URL allow-list).
3. T-050 push notifications (gated by Expo Go) or Phase 5 quality/release.

**Blockers / decisions needed:** None.

**Notes for next session:**
- Don't widen `profiles` RLS without a clear product reason. The leaderboard + these two
  new RPCs are the entire surface that needs other users' names today. If a future
  screen needs more profile fields (avatar, bio), add it to the same per-screen RPC
  rather than broadening RLS.
- The author label is computed inline in two places (challenge detail row + submission
  detail header). If a third surface needs it, factor out a small helper — but two
  copies is fine for now (not abstraction-worthy yet).
- `getMyTodaySubmission` still uses a direct `from('submissions').select(...)` rather
  than an RPC: it returns the **current user's** own submission, so it doesn't need
  author info and works fine under the existing RLS path.

---

## 2026-06-03 — Claude 1 / B-011 fix: treat group members as participants (T-027)

**Did:** Fixed B-011 — in a group challenge, only the creator was auto-joined into
`challenge_participants`, so every other group member (including the verifier) was
treated as a non-participant. That tripped every read/verify/streak gate at once.

**The 1-line root cause:** `is_challenge_participant(uuid)` only consulted
`challenge_participants`; group-member implicit participation wasn't modeled.

**The 1-helper fix:** widened the helper so that for `mode='group'` challenges any
`group_members` row in the host group counts. Every gate already calls this helper, so
the four RLS policies (`submissions_select_participant`, `verifications_select_participant`,
`storage_proof_media_select`, `cp_select_in_challenge`) and the three RPCs
(`verify_submission`, `submit_proof`, `challenge_streak`) are fixed without touching any
of them. Outsiders (not in the group, no participant row) still get false.

**Defensive tweak:** `challenge_streak` previously raised `42501 not a participant`;
after the helper widening this path only fires for true outsiders, so changed it to
`return null`. Client `getChallengeStreak` now returns `ChallengeStreak | null` and the
challenge detail screen's `streak.data ? ...` guard already renders null as "no streak."

**Files created:**
- `supabase/migrations/20260603000000_group_member_is_participant.sql` — idempotent
  CREATE OR REPLACE on both functions. **USER must apply (W-022)** — without it the bug
  persists. No order constraint vs other Phase 3/4A migrations.

**Files modified:**
- `src/features/challenges/api/index.ts` — `getChallengeStreak` return type
  `Promise<ChallengeStreak | null>` and explicit `if (data == null) return null;`
  before mapping. No throw on the null path.

**Smoke test (matches W-022 entry):**
1. Account A and Account B in same group.
2. A creates a group challenge in that group; A submits proof.
3. B opens the challenge.
   - ✅ B sees A's submission (was empty before).
   - ✅ No `getChallengeStreak failed: 42501` in console.
   - ✅ B can open the submission and view the photo.
   - ✅ "Verify proof" button → tapping transitions A's submission to `verified`.
4. Account C (not in group) → still no submissions, still cannot verify (unchanged).

**Checks:** `npm run typecheck` ✅ · `npm run lint` ✅ · `npx expo-doctor` ✅ (18/18).

**Branch / commit:** `mvp` @ <see post-commit hash>

**Next up:**
1. **User action (W-022):** apply the patch migration via Supabase Dashboard SQL editor.
   The bug remains visible until then.
2. **User action (still open: W-019):** Phase 4A migration including `restore_group`
   from T-026.
3. T-050 push notifications (gated by Expo Go → dev build/EAS) or Phase 5
   quality/release (T-060/T-061/T-062).

**Blockers / decisions needed:** None. The widening was intentionally surgical (one
helper) to avoid policy/RPC churn.

**Notes for next session:**
- Don't reintroduce a "Join challenge" CTA for group members — group membership is now
  treated as implicit participation by design (per the user's T-027 brief). A "Join
  challenge" affordance would be confusing because there's nothing to join.
- `join_challenge` RPC still exists and is fine — calling it for a group member is a
  no-op (insert ... on conflict do nothing). It can remain for future "explicit opt-in"
  semantics if we ever want to track committed vs implicit participants.
- The leaderboard (`group_leaderboard`) ranks all group members; it was unaffected by
  this change because it never depended on `is_challenge_participant`.

---

## 2026-06-02 — Claude 1 / T-026: Main-app group create/join + archived group restore

**Did:** Filled the UX gap where group create/join was only reachable during onboarding and
archived groups had no recovery path. Refactored the create/join UI into a single reusable
component so both onboarding and the main app share validation + RPC wiring.

**Files created:**
- `src/features/groups/ui/GroupCreateOrJoinForm.tsx` — owns mode toggle, name/code state, zod
  validation, `useCreateGroup`/`useJoinGroup` mutations. Defers post-success behavior via
  `onCreated(groupId)` / `onJoined(groupId)` callbacks so parents can complete onboarding or
  route to detail without coupling. Uses relative imports (`from '../model'`, `from '../hooks'`)
  to avoid a self-cycle with the feature index, which now also re-exports `ui/*`.
- `src/features/groups/ui/index.ts` — exports the form + `GroupCreateOrJoinFormProps` +
  `GroupCreateOrJoinMode`.
- `src/features/groups/hooks/useMyArchivedGroups.ts` — `['groups','archived']` query;
  direct `from('groups').not('archived_at','is',null)` works under existing RLS because
  `group_members` rows persist through archive (sole-owner-leave guard).
- `src/features/groups/hooks/useRestoreGroup.ts` — mutation calling the `restore_group` RPC;
  invalidates `myGroupsQueryKey` + `myArchivedGroupsQueryKey` so both lists refresh.
- `app/group/join-or-create.tsx` — modal route. Reads `?mode=join` to bias the initial toggle;
  on success `router.replace`s `/group/${groupId}`.
- `app/group/archived.tsx` — list of archived groups via `useMyArchivedGroups`; each row shows
  a Restore button when `group.ownerId === session.userId` (owners are the only ones who can
  restore, per the server check). `Alert.alert` confirm before the mutation.

**Files modified:**
- `supabase/migrations/20260601100000_phase4a_user_control_safety.sql` — appended a
  `restore_group(p_group_id uuid)` SECURITY DEFINER RPC right before `archive_challenge`.
  Auth check, owner-only check (`42501`), no-op-safe on already-active groups. (W-019 is
  still OPEN — edit-in-place rather than a new migration.)
- `src/features/groups/api/index.ts` — added `listMyArchivedGroups()` and `restoreGroup(id)`,
  both with `withTimeout` + console.error on failure (matches existing helpers).
- `src/features/groups/hooks/useCreateGroup.ts` + `useJoinGroup.ts` — invalidate
  `myGroupsQueryKey` on success so the Groups tab refreshes immediately after the new modal
  closes (previously only onboarding flipped routes).
- `src/features/groups/hooks/useArchiveGroup.ts` + `useLeaveGroup.ts` — also invalidate
  `myArchivedGroupsQueryKey` (archive adds a row, leave can remove one).
- `src/features/groups/hooks/index.ts` + `src/features/groups/index.ts` — re-export the new
  hooks, query key, form component, and types as the public surface.
- `app/(onboarding)/join-or-create-group.tsx` — replaced the inline form with
  `<GroupCreateOrJoinForm onCreated={finish} onJoined={finish} headerCopy="…" />`. Semantics
  unchanged: complete onboarding → `router.replace('/(tabs)')`.
- `app/(tabs)/groups.tsx` — added a sticky-looking header (title + `+ New` button + Create
  group / Join with code action buttons), Card-based empty state, and a footer linking to
  `Archived groups (N) ›`. Pull-to-refresh refetches both active and archived. New routes
  use `as Href` casts since typedRoutes hasn't regenerated yet.
- `app/_layout.tsx` — registered `group/join-or-create` (modal, title `New group`) and
  `group/archived` (title `Archived groups`) in the root Stack.

**Checks:** `npm run typecheck` ✅ · `npm run lint` ✅ · `npx expo-doctor` ✅ (18/18).

**Branch / commit:** `mvp` @ <see post-commit hash>

**Next up:**
1. **User action (W-019 still OPEN):** apply
   `supabase/migrations/20260601100000_phase4a_user_control_safety.sql` via the Supabase
   Dashboard SQL editor. The file now exposes `leave_group`, `archive_group`, `archive_challenge`,
   **and `restore_group`** — until it's applied, the Restore button + the existing
   leave/archive buttons all fail with `function does not exist`.
2. T-050 push notifications (still gated by Expo Go → needs dev build/EAS) or T-024-adjacent
   polish; otherwise Phase 5 quality/release (T-060/T-061/T-062).

**Blockers / decisions needed:** None. Restore semantics intentionally owner-only — matches
the existing `archive_group` policy.

**Notes for next session:**
- The form is intentionally "headless-ish": no router knowledge. The two routes that use it
  pass different `finish` callbacks; the onboarding route also flips `onboarded=true` first.
  Resist the temptation to fold routing into the form.
- `listMyArchivedGroups` does **not** need a dedicated RPC: RLS on `groups` lets owners and
  members `SELECT` regardless of `archived_at`. We rely on this because `group_members` rows
  survive archive (`leave_group` is the only path that removes membership, and a sole owner
  cannot leave). If RLS ever tightens, switch to a `list_my_archived_groups()` SECURITY
  DEFINER RPC.
- Archived screen filters Restore client-side to owners; the RPC also enforces it server-side
  (`42501` for non-owners). Both checks are required: the client check avoids a confusing
  failure for non-owner members who happen to see an archived group; the server check is the
  authoritative guard.

---

## 2026-06-01 — Claude 1 / Phase 4A-2: moderation + account-deletion UI (T-051/T-052 DONE)

**Did:** Completed Phase 4A-2 — trust/safety UI + account-deletion request UI. Also fixed an
invalid `create policy if not exists` in the W-019 migration before any apply happened.

**Files changed (modified):**
- `supabase/migrations/20260601100000_phase4a_user_control_safety.sql` — replaced three
  `create policy if not exists ...` with `drop policy if exists ... + create policy ...`
  (idempotent) and updated the file-header comment to reflect the supported syntax.
- `app/(tabs)/profile.tsx` — ScrollView layout with Account section (Blocked users link) +
  Danger zone (Request account deletion with double-confirm + optional sign-out after) +
  Sign out card. Uses `useRequestAccountDeletion` from moderation; keeps screen thin.
- `app/submission/[id].tsx` — Report link + Block author button (non-owner only). Whole
  screen short-circuits to a "Hidden" state when the author is in `useBlockedUserIds()`.
- `app/challenge/[id].tsx` — Report link (non-creator) + client-side block filter on the
  recent-submissions list (`useMemo` placed BEFORE early returns to respect rules-of-hooks).
- `app/group/[id].tsx` — Report link in the Settings footer.
- `app/_layout.tsx` — registered `blocked-users` in the root Stack (`headerShown: true`,
  title `Blocked users`).
- `src/features/moderation/index.ts` — replaced stub with full public surface.

**Files created:**
- `src/features/moderation/api/index.ts` — `reportTarget`, `blockUser`, `unblockUser`,
  `listMyBlocks`, `requestAccountDeletion` (RPC-first; 10s AbortSignal; console.error on
  failure).
- `src/features/moderation/hooks/{useReport,useBlockUser,useUnblockUser,useMyBlocks,useRequestAccountDeletion,index}.ts`
  — TanStack-Query mutations + a `useBlockedUserIds()` helper that returns a memoized
  `Set<string>` for O(1) client-side filtering.
- `src/features/moderation/model/{schemas,index}.ts` — canonical `REPORT_REASONS` list with
  human labels + `reportInput` zod schema.
- `src/features/moderation/ui/{ReportSheet,index}.ts` — modal report form with reason picker,
  optional details, loading / success / error states; auto-dismisses on success.
- `app/blocked-users.tsx` — list of blocked users with Unblock button per row, empty / error
  states, and pull-to-refresh. Renders the blocked user's UUID as fallback identifier (the
  `blocks` table doesn't store profile info; a SECURITY DEFINER RPC could resolve names
  later if needed).

**Exact migration file that must be applied manually:**
`supabase/migrations/20260601100000_phase4a_user_control_safety.sql` (same file as
Phase 4A-1; covers BOTH 4A-1 + 4A-2 server side). Paste into Supabase Dashboard → SQL editor
→ Run. Idempotent.

**W-019 still needs user action:** YES (apply the migration above).
**W-020 still needs user action:** YES (Supabase Auth → URL Configuration → Redirect URLs →
add `basta://reset-password`). Unrelated to this slice but unchanged.

**Tests/checks run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅ ·
`npx expo-doctor` → 18/18 ✅.
**Tests/checks NOT run:** unit/E2E (W-007 — none exist); runtime device smoke-test of any
4A-2 surface (depends on W-019 apply).

**Smoke-test checklist (after W-019 is applied):**
- [ ] Profile → Blocked users → empty state renders.
- [ ] Open someone else's proof → tap "Report this proof" → pick reason → Submit → "Thanks"
      → auto-dismiss.
- [ ] Open someone else's proof → tap "Block author" → confirm → sent back; that user's
      later proofs in the recent-submissions list should not appear, and direct navigation
      to one shows the "Hidden" state.
- [ ] Profile → Blocked users → see the blocked id → tap Unblock → confirm → row removed.
- [ ] Challenge detail (not your own) → "Report this challenge" → submit.
- [ ] Group detail → footer "Report this group" → submit.
- [ ] Profile → Danger zone → Request account deletion → confirm twice → success modal →
      optionally Sign out. Tap again later → server is idempotent (returns same pending id),
      no duplicate row.

**Known bugs:**
- Client-side block filter only covers screens I touched (submission detail, challenge
  detail's recent submissions). Leaderboard rows, comments lists, and any other user-visible
  content from blocked users are NOT yet filtered — see warnings for the RLS path.
- `blocked-users` lists by raw UUID since `blocks` doesn't join profiles. Add a
  `list_my_blocks_with_profiles` SECURITY DEFINER RPC if friendly names are needed.

**Next recommended step:**
1. **USER apply W-019** in Supabase SQL editor (and W-020 if not done).
2. Smoke-test the checklist above.
3. **Move to T-061 (CI + EAS) bundled with T-050 (push)** — the natural next slice. Both
   need a dev build, so they go together. Phase 4A is now functionally complete.

**Warnings for the next Claude:**
- **Don't add direct INSERT/UPDATE RLS** on `reports`/`blocks`/`account_deletion_requests`.
  All writes are RPC-only.
- **Hard account deletion is intentionally a follow-up Edge Function** with the service-role
  key. Do NOT add `auth.admin.deleteUser` calls to the mobile app. The `request_account_deletion`
  RPC only marks a row; an admin process consumes the queue.
- **Server-side blocked-user filtering** is the right place to broaden filtering. Helper
  `is_blocked_by_me(uid)` is already deployed — extend SELECT policies on `submissions`,
  `submission_reactions`, `submission_comments` to add `AND NOT is_blocked_by_me(author_id)`.
  Deliberate next slice; doing it client-side everywhere is brittle.
- **`blocked-users` route is registered** — don't add a duplicate Stack.Screen entry.
- **`ReportSheet` is a Modal** — don't put it inside a parent Modal or you'll fight RN's
  z-stacking.
- Don't add push, EAS, CI, post-MVP features.

**Branch / commit:** `mvp` + `feat(safety): add moderation and account deletion UI`. Pushed.

**Decisions changed this session:** none. D-001..D-010 stand.

---

## 2026-06-01 — Claude 1 / Phase 4A-1 polish (archived-state UX + forgot-password resend)

**Did:** Small functionality/UX pass on the Phase 4A-1 surfaces (migrations assumed applied).
No new features; just guard rails on edge cases users would actually hit.

- **Challenge detail (`app/challenge/[id].tsx`):** when `c.archivedAt` is set, show an
  "Archived" card at the top, hide the **Submit today's proof** Today card, and hide the
  creator's **Archive challenge** button. The server-side `submit_proof` still validates
  participants but had no awareness of archived; this prevents the UX from inviting a submit
  that would feel wrong even if the row inserted.
- **Group detail (`app/group/[id].tsx`):** when `useMyGroups` has settled and the group isn't
  in the cache (archived, deleted, or you left), show a friendly "Group unavailable" state
  instead of a blank header + stale leaderboard.
- **Forgot-password (`app/(auth)/forgot-password.tsx`):** after success the button now becomes
  a **Resend email** secondary button instead of disappearing. Email field is editable again
  so the user can correct a typo and try a different address. Copy hints at W-020 deep-link
  config.

**Files changed:** `app/challenge/[id].tsx`, `app/group/[id].tsx`,
`app/(auth)/forgot-password.tsx`, `docs/claude-memory/HANDOFF.md`.

**No migration changes.** Phase 4A migration unchanged from `4711deb`.

**Tests run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅.
**Tests NOT run:** unit/E2E (W-007); runtime device smoke-test of these three guard cases.

**Notes for next Claude:**
- The Submit button hides on archived challenges, but `submit_proof` server-side does NOT
  currently check `challenges.archived_at`. If a user has a queued submission for a challenge
  that gets archived between enqueue and upload, the server will still accept it. Acceptable
  for MVP; tighten in Phase 4A-2 if desired (add `archived_at is null` to the participant
  check in `submit_proof`).
- The "Group unavailable" state is a soft fallback. If we ever want to allow viewing an
  archived group's frozen leaderboard, fetch the group directly by id (bypassing the
  `useMyGroups` filter) rather than weakening the list filter.
- Phase 4A-2 (moderation UI + account deletion UI) still pending; server side is already in
  the W-019 migration.

**Branch / commit:** `mvp` + `fix(account-controls): archived-state UX + forgot-password resend`.
Pushed.

**Decisions changed:** none.

---

## 2026-06-01 — Claude 1 / Phase 4A-1: password reset + archive actions (PARTIAL Phase 4A)

**Did:** Shipped the first clean slice of Phase 4A — **account controls**. Phase 4A-2
(report/block UI + account-deletion request UI) is deferred to the next session. Server-side
infra for 4A-2 IS in the migration so the user only applies one SQL file.

**Files changed:**

*Migration (NEW, idempotent, NOT applied yet — W-019):*
- `supabase/migrations/20260601100000_phase4a_user_control_safety.sql` — archive columns on
  `groups`/`challenges`; SECURITY DEFINER RPCs `leave_group` / `archive_group` /
  `archive_challenge` (Phase 4A-1) + `report_target` / `block_user` / `unblock_user` /
  `request_account_deletion` (Phase 4A-2 prep) + `is_blocked_by_me` helper; `reports`,
  `blocks`, `account_deletion_requests` tables with read-own RLS. Mirrors the
  B-006/B-008/D-009 RPC-first pattern.

*Password reset (A — DONE):*
- `src/features/auth/api/index.ts` — added `resetPasswordForEmail`, `exchangeCodeForSession`,
  `updatePassword` + `PASSWORD_RESET_REDIRECT = 'basta://reset-password'`.
- `src/features/auth/model/schemas.ts` — `forgotPasswordInput`, `resetPasswordInput` zod.
- `src/features/auth/hooks/{useRequestPasswordReset,useUpdatePassword}.ts` — new.
- `src/features/auth/{hooks/index,model/index,index}.ts` — re-exports.
- `app/(auth)/forgot-password.tsx` (new) — email entry, sends reset link.
- `app/(auth)/reset-password.tsx` (new) — reads `?code=` deep-link param, exchanges for
  recovery session, updates password, replaces to `/(tabs)`. Shows a clear "Open the reset
  link" fallback when no `code` arrives (W-020).
- `app/(auth)/sign-in.tsx` — "Forgot password?" link (cast `as Href` since typedRoutes
  hasn't generated the new path yet).

*Leave/Archive group (B + C — DONE):*
- `src/features/groups/api/index.ts` — `listMyGroups` now filters `archived_at is null`;
  added `leaveGroup`, `archiveGroup`; DTO maps `archivedAt`.
- `src/features/groups/hooks/{useLeaveGroup,useArchiveGroup}.ts` — new (invalidate
  `myGroupsQueryKey` on success).
- `src/features/groups/{hooks/index,index}.ts` — re-exports.
- `src/entities/group.ts` — added `archivedAt?: string`.
- `app/group/[id].tsx` — footer "Settings" with Leave (any member) + Archive (owner-only);
  `Alert.alert` confirmation; `router.replace('/(tabs)/groups')` on success.

*Archive challenge (D — DONE):*
- `src/features/challenges/api/index.ts` — `listMyChallenges` now filters
  `archived_at is null`; added `archiveChallenge`; DTO maps `archivedAt`.
- `src/features/challenges/hooks/useArchiveChallenge.ts` — new (invalidates challenges
  list + the specific challenge query).
- `src/features/challenges/{hooks/index,index}.ts` — re-exports.
- `src/entities/challenge.ts` — added `archivedAt?: string`.
- `app/challenge/[id].tsx` — footer "Settings" with Archive (creator-only); confirm flow;
  redirects to `/(tabs)/challenges` on success.

*Phase 4A-2 prep (NOT shipped this session):*
- `src/entities/{report,block}.ts` (new) + `src/entities/index.ts` re-exports — present so
  4A-2 can build directly on top without entity churn.

**Exact migration filename:**
`supabase/migrations/20260601100000_phase4a_user_control_safety.sql`

**USER must apply manually:** YES. Open Supabase Dashboard → SQL editor → paste full
contents → Run. Idempotent; safe to re-run. See W-019.

**Smoke-test checklist (after W-019 + W-020 are done):**
- [ ] Sign-in → tap "Forgot password?" → enter your email → see "Check your inbox" copy.
- [ ] Tap the link in the email on your phone → app opens on reset-password screen → new
      password → app lands on Today.
- [ ] On group/[id], tap **Leave group** → confirm → list updates without it.
- [ ] On group/[id] as owner, tap **Archive group** → confirm → group disappears from list
      (rows preserved in DB).
- [ ] On challenge/[id] as creator, tap **Archive challenge** → confirm → disappears from
      Challenges tab.
- [ ] As sole owner of a group, try Leave → expect "cannot leave as sole owner" error.

**Tests run:** `npm run typecheck` → exit 0 ✅ · `npm run lint` → exit 0 ✅ ·
`npx expo-doctor` → 18/18 ✅.
**Tests NOT run:** unit/E2E (W-007); runtime on device — pending W-019 + W-020 (and
W-014..W-018 if not yet applied).

**Known issues:**
- Phase 4A-2 (report/block UI, account-deletion request UI, blocked-users screen) NOT
  shipped — see "Unfinished work" below.
- Sole-owner leave guard exists server-side; UI surfaces the server error message but
  doesn't proactively hide the Leave button when sole-owner. Acceptable for MVP.
- typedRoutes doesn't have `/(auth)/forgot-password` in its union yet; cast `as Href`.
  Same fix the project has used since Phase 2 dynamic routes.

**Unfinished work (Phase 4A-2 — next slice):**
- **Moderation feature:** `src/features/moderation/` is still a stub. Build api/hooks/model/
  ui: `reportTarget`, `blockUser`, `unblockUser`, `listMyBlocks` + `useReport`, `useBlockUser`,
  `useUnblockUser`, `useMyBlocks` + `ReportSheet` (modal).
- **Submission Report/Block buttons** in `app/submission/[id].tsx`.
- **Profile "Delete account" section** + double-confirm + sign-out + `useRequestAccountDeletion`
  hook.
- **`app/blocked-users.tsx`** screen + Profile link.
- **Client-side block filter** in proofs/social APIs.
- **Docs:** when 4A-2 lands, add `T-051` + `T-052` rows; update SCHEMA_DRAFT/DATA_MODEL with
  the new tables.

**Next recommended action:**
1. **USER apply W-019** (Phase 4A migration) — RPCs and tables come live.
2. **USER apply W-020** (Auth → URL Configuration → add `basta://reset-password`).
3. Smoke-test the password-reset + leave/archive flows on device.
4. **Next session:** Phase 4A-2 (report/block + account deletion UI) — server side is already
   in place from W-019.

**Warnings for the next Claude:**
- **W-019 is the SAME file** that holds the trust/safety infra for 4A-2. Don't add another
  migration; just write the client wrappers.
- **All client writes still go through SECURITY DEFINER RPCs.** No direct INSERT/UPDATE
  policies on the new tables — same pattern as B-006/B-008/D-009.
- **Archive is soft-delete.** Don't change `archive_group` / `archive_challenge` to issue
  `delete from` — data must be preserved (verification history, streaks, leaderboards).
- **Don't expand the `listMy*` filters** to include archived — `app/group/[id]` already
  reads the archived item via the cached `useMyGroups` data path; if archived items need
  read-only screens, fetch by id directly rather than weakening the list filter.
- **Sole-owner leave guard is server-side.** Don't try to enforce it client-side; surface
  the server error and update the UI hint when it fires.
- **Don't add `react-native-web`.** Don't add background tasks / push / EAS — those are
  separate phases and out of Expo Go scope.
- **`detectSessionInUrl: false` is intentional.** For password reset we use the explicit
  `exchangeCodeForSession(code)` path (PKCE) — not the URL-detection auto-flow.

**Branch / commit:** `mvp` + `feat(account-controls): add password reset and archive actions`.
Pushed.

**Decisions changed this session:** none. D-001..D-010 stand. (Phase 4A-2 may want a D-011
on whether to soft-delete vs hard-delete account-deletion requests; defer to that session.)

---

## 2026-05-31 — HANDOFF SNAPSHOT (ready for next Claude)

> Clean checkpoint. No new implementation this session — gate hotfix + invite-code UX polish
> only. tsc + lint green; working tree in sync with `origin/mvp`.

**Completed work (project to date):**
- Foundations + Phase 1 auth & onboarding + Phase 2 challenges/proof/queue + Phase 3 social
  loop (verification, streaks, leaderboard, reactions/comments) + Retro UI restyle. The full
  MVP loop exists in code: register → group → challenge → submit proof (offline) → friend
  verifies → streak → group leaderboard, plus reactions + comments on each proof.
- **This pair of commits:** `d61a7b3` fixed the gate over-redirect (B-009) that was bouncing
  onboarded users off Phase 2/3 sub-routes (e.g. tapping "+ New" on Challenges sent the user
  back to Today); `a47a252` switched group invite codes from 12-char hex to a friendly
  **4-digit numeric** format (e.g. `0490`, `1023`) with a number-pad keyboard on the join
  input.

**Changed files (last two commits):**
- `src/navigation/guards.ts` — widened `isAtTarget('/(tabs)')` to accept any non-`(auth)`/
  non-`(onboarding)` route, with updated doc-comment. (B-009)
- `supabase/migrations/20260601000000_short_invite_codes.sql` — new; defines
  `generate_short_invite_code()` (bounded retry on collision), changes column default,
  regenerates existing groups' codes row-by-row.
- `src/features/groups/model/schemas.ts` — `inviteCodeSchema` → `/^\d{4}$/`, exports
  `INVITE_CODE_LENGTH`.
- `src/features/groups/{index,model/index}.ts` — re-export the constant.
- `app/(onboarding)/join-or-create-group.tsx` — number-pad keyboard, `maxLength=4`,
  non-digit strip on change, placeholder `0000`.
- `docs/claude-memory/HANDOFF.md`, `CURRENT_STATE.md`, `BUGS_AND_WARNINGS.md`.

**Unfinished work:**
- No code is half-written. The unfinished items are all USER actions and product backlog,
  not in-flight work.

**Next recommended task:** **T-051 + T-052 (report/block + account deletion)** as a single
Phase 4 slice. Both are App Store / Play Store mandates, fully testable in Expo Go (unlike
T-050 push, which needs a dev build), build on existing Phase 1–3 schema, and unlock T-061
(CI/EAS). Suggested approach: one migration with `reports` + `blocks` tables and
`report_target`/`block_user`/`unblock_user`/`request_account_deletion` SECURITY DEFINER RPCs
(mirroring B-006/B-008/D-009/D-010 patterns); `src/features/moderation/*`; report modal +
Account section on Profile. Hard account deletion likely needs a Supabase Edge Function with
service-role for `auth.admin.deleteUser` + Storage object purge — propose the choice before
writing it.

**Known issues / open warnings:**
- **W-014/W-015/W-016/W-017** — apply the four Phase 3 migrations
  (`20260531000000_phase3_verification.sql`, `…_streaks.sql`, `…_leaderboard.sql`,
  `…_social.sql`). Idempotent; paste each into Supabase SQL editor. Phase 3 features render
  but RPC calls silently fail until these run.
- **W-018** — apply `20260601000000_short_invite_codes.sql` so the 4-digit invite codes
  this session shipped take effect server-side. Existing shared hex codes will stop working.
- **OTP length (no code, dashboard only):** Supabase Dashboard → Authentication → Settings
  → "Email OTP length" → set to **6** → Save. Client already accepts 4–10 digits.
- W-012 — queue drains only while app foregrounded (Expo Go limitation; real fix is a dev
  build + expo-background-fetch — defer to Phase 5).
- W-013 — recurring `npm install` ERESOLVE; fix is clean reinstall
  (`rm -rf node_modules package-lock.json && npm install`). USER explicitly declined a
  committed `.npmrc` workaround.
- W-007 — no test harness; only tsc + lint + manual smoke-checklist.
- B-002 — cold-start route flash (cosmetic).
- B-001 — transitive audit vulns in build-time deps; accept-the-risk for now.

**Tests run:** `npm run typecheck` → exit 0 ✅ · `npm run lint` → exit 0 ✅.
**Tests NOT run:**
- Unit/component/E2E — none exist (W-007).
- `npx expo-doctor` not re-run this session (was 18/18 last time; no dep/config changes).
- Runtime device smoke-test of B-009 fix or the 4-digit invite codes (pending USER reload).
- Runtime smoke of any Phase 3 feature (pending W-014/W-015/W-016/W-017 migrations).

**Warnings for the next Claude:**
- **Apply the five pending migrations before trusting any Phase 3 feature OR new invite codes**
  (W-014/W-015/W-016/W-017/W-018). Order doesn't matter; all idempotent. Without them,
  Phase 3 screens render but RPC calls error and the create-group flow still hands out
  long hex codes.
- **All client writes go through SECURITY DEFINER RPCs.** Don't introduce direct INSERT/
  UPDATE RLS policies on Phase 3 tables — that's the pattern that dodges the B-006/B-008
  RLS chicken-and-egg class. Same convention will apply to Phase 4 (report/block).
- **Don't tighten the gate again.** `isAtTarget('/(tabs)')` is intentionally permissive
  (anything not `(auth)` or `(onboarding)` counts). If you add a new top-level route group
  at app root (e.g. `(adminstuff)`), audit that branch to decide whether it belongs.
- **`submit_proof` was REPLACED in T-040** to auto-verify solo proofs (D-009). Keep that
  branch or solo streaks break.
- **Don't change the storage path `<uid>/<challengeId>/<file>`** — the widened
  proof-media SELECT policy keys off `foldername[2]` = challenge id.
- **T-050 push is blocked in Expo Go** (remote push tokens need a dev build / EAS). Bundle
  it with T-061; don't build it blind.
- **New dynamic routes** may not be in expo-router's generated typed-routes union yet —
  cast new dynamic hrefs `as Href` (see groups/challenge screens for examples).
- **Today tab is empty by design** for now. Phase 0 placeholder content; an in-group
  activity feed was deferred (originally under T-031 / T-041 vicinity). If the user asks for
  Today content, that's a real new slice — propose it before starting.
- **Invite codes are now 4-digit numeric.** If scale ever grows past comfortable collision
  density (~50 groups is fine; >1000 starts to get tight against 10,000-code space), bump
  to 5–6 digits via a follow-up migration that re-runs the same `do $$` regeneration block.
- **Sign-out UI is on Profile.** Don't re-introduce a duplicate.
- **`.claude/settings.json` is intentionally NOT committed** (per the prior handoff —
  harness auto-adds a machine-specific Start-Process allow; revert before staging).

**Branch / commit:** `mvp` @ `a47a252` + this handoff commit. In sync with `origin/mvp`
after push.

**Decisions changed this session:** none. D-001..D-010 stand.

---

## 2026-05-31 — Claude 1 / UX polish: 4-digit numeric invite codes (W-018)

**Did:** Per user request, swapped group invite codes from a 12-char hex string to a friendlier
**4-digit numeric** format (e.g. `1023`, `0490`).
- New migration: `supabase/migrations/20260601000000_short_invite_codes.sql`. Defines
  `generate_short_invite_code()` (retries up to 30 times on collision), changes the
  `groups.invite_code` default, and regenerates existing groups' codes one row at a time
  (so each iteration sees prior updates — avoids in-statement collisions). Idempotent.
- Client tightened: `inviteCodeSchema` now `/^\d{4}$/`. Constant `INVITE_CODE_LENGTH = 4`
  exported from the groups feature; join-or-create form uses it for `maxLength`, placeholder,
  and a `number-pad` keyboard. Non-digit input is stripped on change.
- Logged as **W-018** in BUGS_AND_WARNINGS (USER must apply the migration; existing invite
  codes will change, so any old shared codes stop working).

**Files changed:**
- `supabase/migrations/20260601000000_short_invite_codes.sql` (new)
- `src/features/groups/model/schemas.ts` — schema swap + `INVITE_CODE_LENGTH` const
- `src/features/groups/model/index.ts`, `src/features/groups/index.ts` — re-export the const
- `app/(onboarding)/join-or-create-group.tsx` — number-pad keyboard, length cap, placeholder
- `docs/claude-memory/BUGS_AND_WARNINGS.md` + this file

**On the user's other request — OTP length:** This is a Supabase project setting, not code.
Dashboard → **Authentication → Settings → "Email OTP length"** → set to **6** → Save. Our
client already validates 4–10 digits (`OTP_MIN_LENGTH` / `OTP_MAX_LENGTH` exposed from
`@/features/auth`), so the change takes effect on the next sign-up; no code change needed.

**Tests run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅.

**In progress:** Nothing half-done.

**Next up:** USER applies W-018 + the four still-pending Phase 3 migrations
(W-014/W-015/W-016/W-017) + flips the OTP length to 6 in Auth settings. Then runtime-tests
the full app. Phase 4 (T-051/T-052) is the next recommended slice after that.

**Branch / commit:** `mvp` + `feat(groups): 4-digit numeric invite codes`. Pushed.

**Decisions changed:** none.

**Notes for next Claude:** When generating short numeric codes server-side, always include
a retry-with-bound (we use 30). Without the bound, a near-saturated namespace would loop
forever. 4 digits → 10,000 codes is comfortable for the MVP's group count (≤50); if scale
grows, bump to 5–6 digits via a follow-up migration that re-runs the same `do $$` block.

---

## 2026-05-31 — Claude 1 / Hotfix B-009: gate was bouncing onboarded users out of sub-routes

**Did:** Confirmed a user-reported runtime bug. Onboarded users tapping any non-`(tabs)` route
(`/challenge/new`, `/group/[id]`, `/submission/[id]`, `/verify/[submissionId]`,
`/challenge/[id]/submit-proof`) were instantly bounced back to Today by the gate.

Root cause: `isAtTarget(segments, '/(tabs)')` returned true only when the user was literally
inside the `(tabs)` group. So segments like `['challenge','new']` were treated as "not at
target" and the layout's redirect-effect fired `router.replace('/(tabs)')`. The redirect matrix
was right; the comparison was too strict.

**Fix:** `isAtTarget(... , '/(tabs)')` now returns true for any segment group that isn't
`(auth)` or `(onboarding)`. The signed-out and onboarding branches are untouched.

**Files changed:**
- `src/navigation/guards.ts` — widen `isAtTarget` for the `/(tabs)` target + updated
  doc-comment to explain why.
- `docs/claude-memory/BUGS_AND_WARNINGS.md` — logged as **B-009 [RESOLVED]**.

**Tests run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅. No runtime smoke on device
yet (USER will retest).

**In progress:** Nothing half-done.

**Next up:** Unchanged from prior entry — USER applies the four Phase 3 migrations
(W-014/W-015/W-016/W-017), then runtime-tests verify/streak/leaderboard/social. After that,
Phase 4 (T-051/T-052 report/block + account deletion) is the next slice.

**Notes for next Claude:**
- The gate's intent is "the user belongs in /(tabs) when fully onboarded" — but that should
  not mean "the user is forbidden to leave /(tabs)." Sub-routes (modal, detail, deep-link
  targets) outside the `(tabs)` group are legitimate destinations for a signed-in user.
- If you ever add a new top-level route group at app root (e.g. `(adminstuff)`), audit
  `isAtTarget` to be sure it's classified correctly — anything that's NOT `(auth)` or
  `(onboarding)` is treated as "in the app proper" by the current widening.
- Redirect-loop avoidance is still intact — the layout only calls `router.replace(target)`
  when `isAtTarget` returns false.

**Branch / commit:** `mvp` + `fix(gate): allow signed-in users to navigate to non-tabs sub-routes`.

**Decisions changed:** none.

---

## 2026-05-31 — Claude Instance / SESSION HANDOFF (Phase 3 social loop complete)

> Consolidated handoff. Per-task detail is in the four entries below (T-040, T-043, T-042, T-041).
> Read this first.

**Completed work this session (all committed to `mvp`, pushed to `origin/mvp`):**
- **T-040** friend verification — `verifications` table + `verify_submission` RPC (threshold-approve
  / single-reject, D-009); `submit_proof` replaced to auto-verify solo proofs; widened proof-media
  storage SELECT; verification feature; `app/verify/[submissionId].tsx`; verify affordance on
  challenge detail.
- **T-042** streaks — `challenge_streak` computed-on-read RPC (timezone-correct via stored
  `challenge_day`, D-010); `useChallengeStreak`; streak stat cards on challenge detail.
- **T-043** group leaderboard — `group_leaderboard` RPC; `src/features/leaderboard`; real Groups
  tab list → `app/group/[id].tsx` (invite code + ranked board).
- **T-041** reactions + short comments — `submission_reactions`/`submission_comments` + RPCs;
  `src/features/social` (ReactionBar + CommentsSection); `app/submission/[id].tsx`.
- **UI** — Retro.app-inspired theme (serif display, outlined pill buttons, white canvas, blue
  accent, red destructive) applied at the design-system level (`tokens.ts` + primitives).
- **Fix** — wired the Profile **Sign out** button (was missing → "login/register gone" report).
- The MVP loop is now code-complete end-to-end: register → group → challenge → submit (offline) →
  friend verifies → streak → group leaderboard, plus reactions + comments.

**Changed/added files (by area):**
- Migrations (all NEW, idempotent, NOT yet applied): `supabase/migrations/`
  `20260531000000_phase3_verification.sql`, `20260531100000_phase3_streaks.sql`,
  `20260531200000_phase3_leaderboard.sql`, `20260531300000_phase3_social.sql`.
- Features: `src/features/verification/*` (new), `src/features/leaderboard/*` (new),
  `src/features/social/*` (new); `src/features/challenges/*` (+streak api/hook),
  `src/features/proofs/*` (+getSubmission/getProofSignedUrl/useSubmission); verification hook
  invalidates streak.
- Entities: `streak.ts`, `leaderboard.ts`, `comment.ts` (+ `entities/index.ts`).
- Screens/routes: `app/verify/[submissionId].tsx`, `app/group/[id].tsx`, `app/submission/[id].tsx`
  (all NEW + registered in `app/_layout.tsx`); `app/(tabs)/groups.tsx` (real list),
  `app/(tabs)/profile.tsx` (sign out), `app/challenge/[id].tsx` (streak cards + tappable rows +
  verify affordance).
- Design system: `src/shared/ui/theme/tokens.ts`, `Text/Card/Button/Input.tsx`, `SyncBadge.tsx`;
  `docs/design/theme-preview.html` (browser mock).
- Docs: this file, `CURRENT_STATE`, `TASKS`, `BUGS_AND_WARNINGS`, `DECISIONS` (D-009, D-010),
  `FILE_MAP`.

**Unfinished work:**
- **Four migrations are NOT applied** (W-014/W-015/W-016/W-017). Phase 3 is inert at runtime until
  the USER pastes each into the Supabase SQL editor. Phase 1+2 already applied (W-011 done).
- **No Phase 3 runtime smoke-test yet** (depends on the migrations + a 2nd test account for the
  group/verify/leaderboard paths).
- T-050 push, T-051/T-052 trust&safety, T-060 tests, T-061/T-062 CI+EAS — not started.

**Next recommended task:** **T-051 + T-052 (report/block + account deletion)** — store-required and
fully testable in Expo Go — OR **T-050 push bundled with EAS/dev-build (T-061)** since remote push
can't run in Expo Go. (Picking T-050 alone would be untestable now — see warning below.)

**Known issues / open warnings:** W-014/W-015/W-016/W-017 (apply migrations — top priority),
W-012 (queue drains only foregrounded — Expo Go), W-013 (npm ERESOLVE → clean reinstall),
W-007 (no test harness), B-002 (cold-start route flash), B-001 (transitive audit vulns, accepted).

**Tests run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅ (both at handoff).
**Tests NOT run:** unit/component/E2E (W-007 — none exist); `npx expo-doctor` not re-run at handoff
(was 18/18 earlier; no dep/config changes since); runtime/device smoke-test of any Phase 3 feature
(pending the four migrations).

**Warnings for the next Claude:**
- **Apply the four Phase 3 migrations before trusting any Phase 3 screen** — they fail silently-ish
  (RPC missing → caught error, feature hidden) until applied. Order doesn't matter except social
  reads `submissions` (Phase 2, already applied).
- **All writes go through SECURITY DEFINER RPCs** (verify/streak/leaderboard/react/comment). Don't
  add direct INSERT/UPDATE RLS policies — that's the pattern that dodges the B-006/B-008 RLS class.
- **`submit_proof` was REPLACED** to auto-verify solo proofs (D-009). Keep that branch or solo
  streaks break.
- **Don't change the storage path `<uid>/<challengeId>/<file>`** — the widened storage SELECT
  policy keys off `foldername[2]` = challenge id.
- **T-050 push is blocked in Expo Go** (remote push tokens need a dev build/EAS). Bundle it with
  T-061, don't build it blind.
- **New dynamic routes** aren't in expo-router's generated typed-routes union until Metro
  regenerates `.expo/types`; cast new dynamic hrefs `as Href` (see groups/challenge screens).
- **`.claude/settings.json` is intentionally NOT committed** — the harness auto-added a
  machine-specific absolute path (a Start-Process allow for the local preview HTML) and reordered
  keys; that's local noise, not shared config. It was reverted at handoff so the tree is clean.
- **UI is at token level only.** The Retro serif is the platform serif (Georgia); the exact display
  face (Instrument Serif/Playfair via expo-google-fonts) is an optional follow-up. Brand color/font
  swaps = edit `tokens.ts`.

**Branch / commit:** `mvp` — 4 feature commits (`1b04dae`, `d49b624`, `05ed44a`, `1111469`) + this
handoff doc commit, pushed to `origin/mvp`.

**Decisions changed this session:** D-009 (verification model + solo auto-verify), D-010
(computed-on-read streaks; pg_cron deferred). D-001..D-008 unchanged.

---

## 2026-05-31 — Claude Instance / Phase 3 reactions + comments (T-041)

**Did:** Implemented T-041 (reactions + short comments on submissions), code-complete. tsc + lint
green. **Chose T-041 over T-050 (push)** because remote push needs a development build / EAS —
it can't be smoke-tested in Expo Go, so building it blind was the wrong move; it should land with
the EAS/dev-build work.

**Design:** writes via participant-gated SECURITY DEFINER RPCs, RLS read-only (same pattern).
One reaction per user per submission (re-selectable / removable); comments ≤280.

**Files added:**
- `supabase/migrations/20260531300000_phase3_social.sql` — `submission_reactions`,
  `submission_comments` + `react_to_submission` / `add_comment` RPCs + participant-read RLS.
- `src/entities/comment.ts` — `SubmissionComment`.
- `src/features/social/{api,hooks,model,ui,index}` — `getReactions`/`reactToSubmission`/
  `getComments`/`addComment`; `useReactions`/`useReactToSubmission`/`useComments`/`useAddComment`;
  `REACTION_EMOJIS` + `ReactionSummary`; `ReactionBar` + `CommentsSection`.
- `app/submission/[id].tsx` — submission detail (photo via signed URL + comment + ReactionBar +
  CommentsSection). Registered in `app/_layout.tsx`.

**Files modified:**
- `app/challenge/[id].tsx` — submission rows are now tappable → `/submission/[id]` (Verify button
  is a nested Pressable, handles its own press). New dynamic route href cast `as Href`.

**Tests run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅.
**Tests NOT run:** unit/E2E (W-007); runtime (needs W-017 migration).

**Notes for next instance:**
- Comments embed `profiles(username, display_name)` via the author_id FK (single FK → unambiguous).
  If you add another FK to profiles on that table, name the embed explicitly.
- Reactions are a fixed emoji set (`REACTION_EMOJIS`). Counts/own-choice computed in `getReactions`.
- The submission-detail screen and the verify screen are separate on purpose (verify is gated;
  detail is for everyone). Both show the photo via `useProofSignedUrl`.

**Next up:**
1. **USER — W-017:** apply `supabase/migrations/20260531300000_phase3_social.sql`, smoke-test
   react + comment on a submission.
2. Next code task: **T-051/T-052 (report/block + account deletion — store requirements, testable
   in Expo Go)**, or **T-050 (push) bundled with EAS/dev-build (T-061)**.

**Branch / commit:** `mvp` — social committed (see git log). No new decisions.

---

## 2026-05-31 — Claude Instance / Phase 3 group leaderboard (T-043)

**Did:** Implemented T-043 group leaderboard, code-complete. tsc + lint green. **This completes the
MVP core loop** (register → group → challenge → submit → verify → streak → leaderboard).

**Design (D-003):** `group_leaderboard(p_group_id)` SECURITY DEFINER RPC ranks every group member by
their count of **verified** proofs across that group's challenges (solo/other-group proofs excluded
via `challenges.group_id = p_group_id`). Member-gated (raises if caller isn't `is_group_member`).
Members with 0 still listed (LEFT JOINs). Rank assigned client-side from the server ordering.

**Files added:**
- `supabase/migrations/20260531200000_phase3_leaderboard.sql` — the RPC. Idempotent.
- `src/entities/leaderboard.ts` — `LeaderboardEntry`.
- `src/features/leaderboard/{api,hooks,index}` — `getGroupLeaderboard`, `useGroupLeaderboard`
  (+ `groupLeaderboardQueryKey`).
- `app/group/[id].tsx` — group screen: invite code card + ranked board (highlights the current
  user). Registered in `app/_layout.tsx`.

**Files modified:**
- `app/(tabs)/groups.tsx` — was a placeholder; now a real `useMyGroups` list → taps into
  `/group/[id]`.

**Decisions:** used **FlatList** not FlashList (bounded ≤50-member lists, no-new-deps lean).
FlashList is a later perf swap if member lists grow.

**Gotcha for next instance:** new dynamic routes (`group/[id]`) aren't in expo-router's generated
typed-routes union until Metro regenerates `.expo/types`. The Groups-tab push casts the href
`as Href` to stay green regardless of regeneration state (see the comment there). Same trick is
available for any new dynamic route that trips `tsc`.

**Tests run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅.
**Tests NOT run:** unit/E2E (W-007); runtime (needs W-016 migration + a group with verified proofs).

**Next up:**
1. **USER — W-016:** apply `supabase/migrations/20260531200000_phase3_leaderboard.sql`, smoke-test
   the Groups tab → group → leaderboard.
2. Next code task: **T-050 (push)** — also unblocks the T-040 verify deep-link and the D-010
   "streak at risk" cron — or **T-041 (reactions + comments)**.

**Branch / commit:** `mvp` — leaderboard committed (see git log). No new decisions (D-003 applied).

---

## 2026-05-31 — Claude Instance / Phase 3 streaks (T-042)

**Did:** Implemented T-042 server-authoritative streaks, code-complete. tsc + lint green. Committed
separately after the T-040 + UI commit (`1b04dae`).

**Design (D-010):** streak is **computed-on-read** by the `challenge_streak` RPC from
`submissions` (only `status='verified'`). Timezone-correct for free — `challenge_day` was already
stored in the user's tz at submit time, so the streak is the longest run of consecutive verified
`challenge_day` values. "current" has a one-day grace (anchors on today, else yesterday). **No
pg_cron** — a computed streak needs no rollover; the cron half of T-042 is deferred to T-050
(proactive "streak at risk" push only).

**Files added:**
- `supabase/migrations/20260531100000_phase3_streaks.sql` — `challenge_streak(p_challenge_id)`
  SECURITY DEFINER RPC returning `{current, longest, today_done}`. Idempotent.
- `src/entities/streak.ts` — `ChallengeStreak` type (exported from `entities`).
- `src/features/challenges/hooks/useChallengeStreak.ts` — `useChallengeStreak` +
  `challengeStreakQueryKey`.

**Files modified:**
- `src/features/challenges/api/index.ts` — `getChallengeStreak` (rpc → ChallengeStreak).
- `src/features/challenges/{hooks/index,index}.ts` — export the streak hook + key.
- `app/challenge/[id].tsx` — two **streak stat cards** (Current 🔥 / Best) in the list header;
  `streak.refetch()` added to pull-to-refresh.
- `src/features/verification/hooks/useVerifySubmission.ts` — also invalidates
  `challengeStreakQueryKey(challengeId)` on a vote (a friend's approval changes the author's run).

**Tests run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅.
**Tests NOT run:** unit/E2E (W-007); runtime (needs W-015 migration + a verified day or two).

**Next up:**
1. **USER — W-015:** apply `supabase/migrations/20260531100000_phase3_streaks.sql`, then smoke-test
   (solo submit → 🔥 1; consecutive days increment; skip a day resets; group counts approved days).
2. Next code task: **T-043 (group leaderboard)** or **T-041 (reactions + comments)**.

**Notes for next instance:**
- Streak refresh follows the submissions model: pull-to-refresh + `staleTime` + invalidate on
  verify. Solo submits land via the offline queue (outside React), so a freshly-submitted solo
  streak shows after a refetch/refocus, not instantly — consistent with how submissions refresh.
- If T-043 leaderboard needs fast streak reads across many members, consider denormalizing then
  (revisit D-010); don't add pg_cron just for that without measuring.

**Branch / commit:** `mvp` — streaks committed (see git log). D-010 added.

---

## 2026-05-31 — Claude Instance / Phase 3 friend verification (T-040)

**Did:** Implemented T-040 (friend verification), code-complete. tsc + lint + expo-doctor (18/18)
all green. Runtime not yet exercised — needs the W-014 migration applied first.

**Context confirmed by USER at session start:** W-011 is **done** (Phase 2 migration applied,
`proof-media` bucket created, create-challenge / submit-proof loop smoke-tested on-device). Also
re-ran the W-013 clean reinstall (`rm -rf node_modules package-lock.json && npm install` → 929
pkgs) because the pull added the 4 Phase 2 deps and plain `npm install` hit the documented
react-dom ERESOLVE.

**Two user-confirmed design forks (now D-009):**
- **Group challenges:** approve count ≥ `verification_threshold` (default 1) → `verified`; any
  single `reject` → `rejected`.
- **Solo challenges:** auto-verify on submit (no friend exists). `submit_proof` was replaced to set
  solo submissions straight to `verified`.

**Files added:**
- `supabase/migrations/20260531000000_phase3_verification.sql` — `verification_result` enum +
  `verifications` table (unique `(submission_id, verifier_id)`, re-votable), `verify_submission`
  SECURITY DEFINER RPC (participant-only, not-author, recomputes status), **CREATE OR REPLACE
  `submit_proof`** (solo auto-verify), `verifications` RLS (participant read), and a **widened
  `proof-media` storage SELECT** policy so verifiers can read co-participants' photos
  (Phase 2 had deferred this). Idempotent — safe to re-run.
- `src/features/verification/{api,hooks,model,index}.ts` — `verifySubmission` rpc wrapper,
  `useVerifySubmission` (invalidates `['submissions', challengeId]` + `['submission', submissionId]`),
  `verificationResultSchema`.
- `app/verify/[submissionId].tsx` — thin verify screen (signed photo + comment + Approve/Reject).

**Files modified:**
- `app/(tabs)/profile.tsx` — **wired the long-missing Sign out button** (`useSignOut`) + shows the
  signed-in email. Fixes a user report that "login/register pages are gone": they were signed in
  with a persisted session and, with no sign-out UI anywhere, couldn't get back to `/(auth)`. The
  gate auto-redirects to sign-in once signed out. (Closes the standing "Sign-out UI: none" gap.)
- `src/features/proofs/api/index.ts` — added `getSubmission(id)` + `getProofSignedUrl(path)`.
- `src/features/proofs/hooks/useSubmission.ts` (new) — `useSubmission` + `useProofSignedUrl`;
  re-exported from proofs `hooks/index.ts` and the feature `index.ts`.
- `app/_layout.tsx` — registered the `verify/[submissionId]` Stack screen.
- `app/challenge/[id].tsx` — `SubmissionRow` now shows a **Verify proof** button on a
  `pending_verification` proof that isn't yours (routes to `/verify/<id>`); pulls `myUid` from
  `useSession`.

**Also this session — UI restyle to match Retro.app (USER reference; chose "polish current
tokens", no new deps, D-005 stands):**
- Look = **editorial minimal**: white canvas, near-black ink, **serif display** face for
  titles/headings (platform serif Georgia/serif — zero-dep), sans body, **outlined pill** buttons
  (`secondary` variant), soft gray rounded tiles, ONE bright **blue** accent (`#0A99F2` — avatars /
  links / selected chips / "pending" badge), **red** (`#FF3B30`) for reject/notifications.
- `src/shared/ui/theme/tokens.ts` — Retro palette (light/dark), added `fonts {display,body}`,
  `shadow` (subtle), `success/warning` colors, `xs`/`xxl` type sizes, `radius.full`. Rebrand or
  swap the exact serif (e.g. Instrument Serif / Playfair via expo-google-fonts) = edit here only.
- Primitives retuned: `Text` (serif title/heading via `fonts.display`), `Card` (flat, faint
  shadow, no border, rounder), `Button` (fully-rounded pill; `secondary` = foreground-outlined
  pill; flat — no shadow), `Input` (taller, blue focus ring), `SyncBadge` (pill; success=green,
  pending=blue, danger=red). Category chips + pending badge now read blue via `accent`.
- `docs/design/theme-preview.html` — browser-openable light+dark mock of the Retro look (faithful
  hex/serif). Reviewed before device run.
- **Serif is the platform default (Georgia).** If USER wants Retro's exact display face, load
  Instrument Serif / Playfair via `@expo-google-fonts/*` + `expo-font` and gate render in
  `app/_layout.tsx` (SplashScreen hold). Small follow-up, not done (kept to no-new-deps steer).

**Tests run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅ · `npx expo-doctor` → 18/18 ✅.
**Tests NOT run:** unit/E2E (W-007); runtime verify flow (needs W-014 + a 2nd test account).

**Next up:**
1. **USER — W-014:** apply `supabase/migrations/20260531000000_phase3_verification.sql` in the SQL
   editor, then run the W-014 smoke-test (solo proof auto-verifies; 2-member group approve→verified,
   reject→rejected; no Verify button / RPC rejection on your own proof).
2. Then the next code task: **T-041 (reactions + short comments)** or **T-042 (streak fn + pg_cron)**.
   T-042 is now unblocked design-wise — it can key off `status='verified'` for solo (auto) and group.

**Warnings for the next instance:**
- **Push deep-link to the verify screen is NOT built** (T-040's "push deep-link" half). It's blocked
  on push registration (T-050). The screen + in-app discovery (challenge detail) are the Phase-3
  surface; wire the notification → `/verify/<id>` deep link when T-050 lands.
- **All writes still go through SECURITY DEFINER RPCs** — `verify_submission` follows that pattern.
  Don't add direct INSERT/UPDATE policies on `verifications` or `submissions`.
- **`submit_proof` was REPLACED, not just extended** — if you touch it again, keep the solo
  auto-verify branch (D-009) or solo streaks break.
- **Storage SELECT policy now keys off the path's 2nd segment** (`foldername(name)[2]` = challenge
  id) via `is_challenge_participant`. Don't change the `<uid>/<challengeId>/<file>` upload path in
  `src/offline/upload/storage.ts` without updating that policy.
- **The verify screen reads media via a short-TTL signed URL** (`getProofSignedUrl`, 1h). Fine for
  the verify session; not a durable link.

**Branch / commit:** `mvp` — work is **uncommitted** (user hasn't asked to commit/push this session).

**Decisions changed this session:** added **D-009** (verification model + solo auto-verify).
D-001..D-008 unchanged.

---

## 2026-05-31 — Claude 1 / Phase 2 operational follow-up (npm peer conflict)

**Did:** No code changes. After the Phase 2 commit (`d05fb67`), USER ran `npm install` and hit
the recurring `ERESOLVE` between `react@19.1.0` and a transitively-pulled `react-dom@19.2.x`
(peerOptional from `expo-router`'s web support). Same shape we've seen during SDK upgrades.

- **Resolved** with `rm -rf node_modules package-lock.json && npm install` — 929 packages, all
  four Phase 2 deps verified present.
- **USER explicitly declined** a committed `.npmrc legacy-peer-deps=true` workaround. The
  agreed workflow is the clean-reinstall sequence whenever this conflict surfaces. Logged as
  **W-013** in BUGS_AND_WARNINGS.
- The targeted alternative (a `package.json` `overrides` pin for `react-dom`) is documented
  in W-013 as an option to revisit only if the friction becomes unacceptable. Don't add it
  without asking.

**In progress:** Nothing half-done in code.

**Next up (USER):** unchanged from the prior entry — W-011 (apply Phase 2 migration + create
the `proof-media` Storage bucket), then smoke-test the create-challenge / submit-proof flow
on Expo Go.

**Branch / commit:** `mvp` + `docs: log W-013 (npm peer conflict workflow)`. Pushed.

**Decisions changed:** none.

**Notes for next session:**
- **Don't auto-propose `.npmrc legacy-peer-deps=true` for this project.** The user prefers
  the clean-reinstall workflow. Stored as a project-local feedback memory.
- If a fresh clone or CI hits this, the recovery is exactly the W-013 snippet.

---

## 2026-05-31 — Claude 1 / Phase 2 challenges + proof upload queue (T-030..T-035)

**Did:** Phase 2 core product loop, code-complete. Runtime smoke-test BLOCKED on W-011 (USER
must apply migration + create Storage bucket).

**Files added:**
- `supabase/migrations/20260528100000_phase2_challenges_proofs.sql` — challenges,
  challenge_participants, submissions; RLS read-only (writes via RPCs); `create_challenge`,
  `join_challenge`, `submit_proof` SECURITY DEFINER RPCs; `is_challenge_participant` helper;
  Storage RLS for `proof-media` (bucket creation is manual).
- `src/offline/index.ts` — `initOffline()` barrel (called by `app/_layout`).
- `src/offline/db/{schema,init}.ts` + `src/offline/db/index.ts` — Expo SQLite singleton with
  `queue_items` table.
- `src/offline/queue/{store,processor}.ts` — durable queue, exponential backoff + jitter,
  client-UUID idempotency, NetInfo + AppState driven, one-at-a-time.
- `src/offline/upload/storage.ts` — standard Supabase Storage upload (path:
  `<userId>/<challengeId>/<submissionId>.jpg`).
- `src/features/challenges/{api,hooks,model,index}.ts` — listMyChallenges/getChallenge/
  createChallenge + hooks + zod schema (CHALLENGE_CATEGORIES).
- `src/features/groups/api/index.ts` + `useMyGroups` hook — adds `listMyGroups`.
- `src/features/proofs/{api,hooks,model,ui,index}.ts` — `SyncBadge`, `ProofComposer`,
  `useSubmitProof` (copies media → enqueue → kick), `useSubmissions`,
  `useTodaySubmission`, `useQueueForChallenge`.
- `app/(tabs)/challenges.tsx` — real list + RefreshControl + empty state + "+ New".
- `app/challenge/new.tsx` — create-challenge form with chip selectors.
- `app/challenge/[id].tsx` — detail screen (today's status, submit CTA, recent submissions).
- `app/challenge/[id]/submit-proof.tsx` — modal route hosting `ProofComposer`.
- `app/_layout.tsx` — `initOffline()` on mount; new Stack screens registered.

**Files modified:**
- `src/entities/{submission,challenge,index}.ts` — added `proofRequirement`, expanded
  `SyncStatus` to cover `queued / synced`, added `ServerSubmissionStatus`.
- `src/offline/queue/types.ts` — added `SubmitProofPayload`.
- `package.json` + `package-lock.json` — `expo-image-picker`, `expo-file-system`, `expo-sqlite`,
  `@react-native-community/netinfo`.
- Architecture docs (SCHEMA_DRAFT, OFFLINE_SYNC, NAVIGATION, DATA_MODEL) — Phase 2 sections.

**Dependencies added (all Expo Go SDK 54 compatible):**
- `expo-image-picker ~17.0.11`, `expo-file-system ~19.0.23`, `expo-sqlite ~16.0.10`,
  `@react-native-community/netinfo 11.4.1`.
- **MMKV deferred** — not Expo Go compatible. Queue uses SQLite-only for now. Documented in
  the OFFLINE_SYNC doc and W-009/W-012.
- `expo-file-system` v19 split its API — we use the legacy entry (`expo-file-system/legacy`)
  for `documentDirectory`/`copyAsync`/`makeDirectoryAsync`. Migrating to the new File/Directory
  API is a follow-up, not blocking.

**Exact migration to apply** — paste the whole file
`supabase/migrations/20260528100000_phase2_challenges_proofs.sql` into Supabase Dashboard →
SQL editor → Run.

**Storage bucket — USER MUST CREATE MANUALLY:**
Supabase Dashboard → Storage → New bucket → name `proof-media` → Public: OFF → Save. The RLS
policies for the bucket are at the bottom of the migration file (require the bucket to exist).

**Tests run:**
- `npm install` (after `rm -rf node_modules package-lock.json` — clean reinstall fixed a stale
  lockfile / react-dom transitive peer conflict, same shape as the SDK 54 upgrade).
- `npm run typecheck` → 0 ✅
- `npm run lint` → 0 ✅
- `npx expo-doctor` → 18/18 ✅
- `CI=1 npx expo start --clear` → boots Metro cleanly.

**Tests NOT run:**
- Unit/E2E (W-007 — no harness).
- Runtime smoke-test on Expo Go SDK 54 — blocked on W-011.

**Manual smoke-test checklist (for the user, after W-011 actions):**
- [ ] create a solo challenge (Today, fitness, 30 days)
- [ ] create a group challenge (pick a group from chips)
- [ ] open challenge detail
- [ ] submit a photo proof online → expect "Pending verification" SyncBadge
- [ ] turn on airplane mode, submit again → expect "Will retry when online"
- [ ] reload the app while offline → confirm the queued item is still listed
- [ ] disable airplane mode → confirm upload retries automatically (or foreground the app)
- [ ] try to submit twice on the same day → expect a clean "already submitted" state
  (no error toast, no duplicate row)
- [ ] after success, server status reads `pending_verification`

**Known bugs / open issues:**
- W-011 (this session): migration + bucket = USER actions.
- W-012 (this session): queue only drains while app is foregrounded — Expo Go limitation.
- W-007: still no test harness.
- B-002 (still open): cold-start route flash.

**Next recommended action:**
1. **USER**: apply W-011 (migration + Storage bucket).
2. Run the smoke-test checklist above.
3. If anything misbehaves, the `[basta]` console log lines (in Expo terminal) will name it.

**Warnings for Claude 2:**
- **All client writes go through RPCs.** Don't add direct INSERT/UPDATE policies on the new
  tables. That's the pattern that works around the B-006/B-008 chicken-and-egg RLS class.
- **`challenge_day` is server-computed.** Don't pass it from the client. Don't compute
  streaks/leaderboards on the client (D-003).
- **Drafts are NEVER auto-discarded.** After MAX_ATTEMPTS the queue item goes `failed` and
  surfaces with a "tap to retry" badge — manual retry only.
- **SDK 54 stays.** No downgrade. `expo install` for any new Expo-related dep.
- **No MMKV** until a custom dev build. Don't try to add it in Expo Go.
- **`expo-file-system/legacy` import is intentional.** Don't change it back to the default
  entry without porting to the new File/Directory API.

**Branch / commit:** `mvp` + `feat(proofs): implement challenges and proof upload queue`,
pushed to `origin/mvp`.

**Decisions changed this session:** none. D-001..D-008 stand. MMKV deferral within D-007
was already documented; this session confirms it for Expo Go scope.

---

## 2026-05-28 — Claude 1 / Phase 1 runtime bug fixes (B-008: createGroup via RPC)

**Did:** Followed B-006 with **B-008**. After the trigger fix shipped, `createGroup` still hit
42501 on the OUTER `INSERT INTO groups` (RLS `owner_id = auth.uid()` failing — likely JWT
propagation edge case under PKCE). Replaced the direct insert with a SECURITY DEFINER
`create_group(p_name)` RPC, same pattern as `join_group_by_invite`. Client now calls
`supabase.rpc('create_group', ...)` then SELECTs the row back (trigger has already added the
membership, so `groups_select_member` passes). USER must apply the new function — SQL is in
BUGS_AND_WARNINGS B-008.

**In progress:** Nothing half-done.

**Next up (USER):** Run the `create_group` CREATE OR REPLACE FUNCTION snippet from B-008 in
Supabase SQL editor. Then reload the app and retest the create-group flow.

**Branch / commit:** `mvp` + `fix(groups): create via SECURITY DEFINER RPC`. Pushed.

**Decisions changed:** none. (Pattern is now: write operations that touch RLS chicken-and-egg
states go through DEFINER RPCs, not direct INSERTs from the client.)

---

## 2026-05-28 — Claude 1 / Phase 1 runtime bug fixes (B-006, B-007 + diagnostics)

**Did:** Fixed two user-reported runtime bugs surfacing during sign-up → group flow on device.
- **B-006 (RESOLVED) — `createGroup` silently fails with RLS error.** Root cause: the
  `add_owner_member` trigger was SECURITY INVOKER, so the trigger's INSERT into `group_members`
  was rejected by `gm_insert_admin` RLS (the user isn't admin until this trigger makes them
  one — chicken-and-egg). Fixed by marking the trigger function `SECURITY DEFINER`
  (`set search_path = public`). Migration file updated. **If migration was already applied,
  user must run the `CREATE OR REPLACE FUNCTION` snippet in BUGS_AND_WARNINGS B-006.**
- **B-007 (RESOLVED) — No way to verify email after closing the app mid-signup.** User got
  trapped behind "Email rate limit exceeded" on sign-up retries. Fix: sign-in screen now has
  a "Have a verification code? Verify your email" link; `verify-email` shows an email Input
  when no query param.
- **Diagnostic hardening:** `createGroup`, `joinGroupByInvite`, `upsertProfile`,
  `completeOnboarding` now log failures via `console.error('[basta] ...', e)` and use a 10s
  `AbortSignal` timeout. Mirrors what `fetchProfile` already does. Future silent failures
  will be visible in the Expo terminal.

**Did NOT change:** decisions, scope, Phase 2 anything, auth feature behavior on happy path.

**In progress:** Nothing half-done.

**Next up (USER):** Run the CREATE OR REPLACE FUNCTION snippet (see BUGS_AND_WARNINGS B-006)
in Supabase SQL editor IF the migration was already applied — otherwise just (re-)apply the
full migration. Then reload the app and the create-group flow should redirect to tabs.

**Blockers / decisions needed:** none.

**Branch / commit:** `mvp` + `fix: rls trigger and verify-email recovery path`. Pushed.

**Notes for next session:** When designing future triggers that write into RLS-protected tables,
default to `SECURITY DEFINER` + a narrow function body (only copies trusted columns from `NEW`).
The pattern matches `is_group_member`/`is_group_admin` already in this migration.

**Tests run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅.
**Tests NOT run:** unit/E2E (W-007). Runtime sign-up→group flow (USER will retest after applying
the trigger fix).

**Decisions changed this session:** none.

---

## 2026-05-28 — Claude 1 / Phase 1 debugging pass (no scope change)

**Did:** Focused debugging/optimization pass. Four small, targeted fixes — no refactoring, no
feature work, no scope change. All checks green; behavior unchanged on the happy path.
- **B-003 (RESOLVED) — Gate infinite-loop on profile error.** `useOnboardingGate` now routes to
  `/(onboarding)/profile-setup` on `isError && !data` (most often W-010). Matrix + comment + the
  table in `NAVIGATION.md` all updated. `app/_layout.tsx` unchanged.
- **B-004 (RESOLVED) — env URL shape validation.** `src/shared/lib/env.ts` trims values and
  rejects malformed URLs (missing https, trailing slash, embedded path) at module load, with
  error messages that name the exact fix. Catches the "Invalid path specified in request URL"
  class of errors before they reach the Supabase edge.
- **B-005 (RESOLVED) — Cache survived sign-out.** `useSignOut` calls `queryClient.clear()` in
  `onSettled`. Closes a real privacy hole (next signed-in user would see previous user's cached
  profile until staleTime).
- **Profile-setup prefill bug.** `app/(onboarding)/profile-setup.tsx` now uses a `useRef`
  one-shot guard so a background refetch can't overwrite what the user is typing.

**Did NOT change:** any auth/groups/onboarding feature surface, the API layer, screens (beyond
the prefill guard fix), the migration, or any decisions.

**In progress:** Nothing half-done.

**Next up:** Unchanged from prior entry — apply migration (W-010), confirm email template
(W-008), smoke-test sign-up → OTP → profile-setup → join/create → tabs on Expo Go. Phase 2 is
the next milestone.

**Blockers / decisions needed:** none from this pass. Same blockers as prior entry (W-008, W-010).

**Branch / commit:** `mvp` + this session's `fix: small Phase 1 debugging pass`. Pushed.

**Notes for next session:**
- The gate's error case now exits to `/(onboarding)/profile-setup` — don't reintroduce the
  infinite-loading behavior. The intent: surface real errors to the user, never trap them.
- `env.ts` validation is strict on shape, not content. If a future env var doesn't fit the
  Supabase URL pattern (different backend, etc.), tailor the validator — don't loosen it.
- `useSignOut` cache-clear is fire-and-forget (`onSettled`). Don't move it to `onSuccess` —
  sign-out may fail server-side but still have cleared the local Supabase session, and you
  want the local cache cleared either way.
- The profile-setup `prefilled` ref guards the lifetime of the screen. If the user navigates
  away and back, the new mount re-prefills (correct).

**Tests run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅ · `npx expo-doctor` 18/18 ✅.
**Tests NOT run:** unit/E2E (W-007); runtime (W-008/W-010 still pending USER actions).

**Decisions changed this session:** none.

---

## 2026-05-28 — Claude 1 / Phase 1 onboarding (T-003 file, T-021, T-022, T-023)

**Did:** Implemented the minimum real backend + onboarding flow needed after auth. No Phase 2
features. tsc/lint green; runtime not yet exercised (W-008, W-010).

- **Migration (T-003 file written):**
  [`supabase/migrations/20260528000000_phase1_profiles_groups.sql`](../../supabase/migrations/20260528000000_phase1_profiles_groups.sql)
  creates `profiles`/`groups`/`group_members` + RLS + helpers + the `join_group_by_invite` RPC.
  **NOT YET APPLIED** to the Supabase project — see W-010 for the one-time USER action.
  Key choices: `profiles.username`/`display_name` nullable (so client upsert can land cleanly,
  no race on unique username); `trg_groups_add_owner` adds the creator as `role='owner'`
  automatically; `is_group_member`/`is_group_admin` are `SECURITY DEFINER` to **avoid RLS
  recursion** when `group_members` policies query `group_members`; `join_group_by_invite` is
  `SECURITY DEFINER` so non-members can resolve invite codes without a broad `groups` SELECT.
- **Onboarding feature** (`src/features/onboarding/*`): `CURRENT_TERMS_VERSION="2026-05-28"`,
  `profileSetupInput` zod (username 3–30 `[a-z0-9_]`, display 1–50, `acceptedTerms: literal(true)`),
  `useProfile` (TanStack query enabled only when signed-in), `useUpsertProfile` (atomic upsert
  on `id`), `useCompleteOnboarding` (flips `onboarded=true`), and `hasAcceptedCurrentTerms`
  helper exposed for the gate. DB row → `User` domain mapping is colocated in the api module
  (the only mapper so far; will move to `entities/mappers` if a second one appears).
- **Groups feature** (`src/features/groups/*`): `createGroup(name)` (insert; trigger handles
  membership), `joinGroupByInvite(code)` via `supabase.rpc(...)`. Mutations expose error.message
  surface for screens. The `index.ts` is the public surface — features/onboarding imports here,
  not into internals (boundary rule).
- **Profile setup screen** (`app/(onboarding)/profile-setup.tsx`): mobile-first form, real
  errors, `KeyboardAvoidingView` on iOS, autocomplete hints (`username-new`/`textContentType`),
  timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` with `'UTC'` fallback. On
  success → `router.replace('/(onboarding)/join-or-create-group')`. **Does NOT** mark
  `onboarded` true.
- **Join-or-create-group screen**: segmented toggle (Create / Join). Create: name → `createGroup`
  → `completeOnboarding` → `replace('/(tabs)')`. Join: invite code → `joinGroupByInvite` →
  `completeOnboarding` → `replace('/(tabs)')`. Submit error surface is unified across the three
  mutations.
- **Onboarding gate** (`src/navigation/guards.ts` → `useOnboardingGate`): full redirect matrix
  (see [`docs/architecture/NAVIGATION.md`](../architecture/NAVIGATION.md#onboarding-gate)).
  `isAtTarget(segments, target)` prevents redirect loops. `app/_layout.tsx` is now thin — it
  only mounts providers, reads the gate, calls `router.replace(target)` if the user isn't
  already at the target, otherwise renders `<Stack>` (or a loading splash while gate resolves).
- **Domain entity**: `src/entities/user.ts` gained `termsVersion?: string`.

**Did NOT do (out of scope):** challenge/proof/verification/streak/leaderboard/push tables,
client-side anything related to those, AI verification, Explore feed, global leaderboards, full
chat, XP/badges/duels, health integrations, monetization.

**In progress:** Nothing half-done. Onboarding is code-complete; verification is gated on W-010
+ W-008.

**Next up (precedence order):**
1. **USER ACTION — W-010:** apply the migration in Supabase Dashboard → SQL editor (or
   `supabase db push`). Verify with `select count(*) from profiles;` (= 0) and the function
   exists.
2. **USER ACTION — W-008:** Supabase Auth → Email Templates → "Confirm signup" includes
   `{{ .Token }}`. (Unchanged from prior session.)
3. **Smoke-test the onboarding flow** on Expo Go SDK 54: sign-up → OTP → profile-setup →
   join-or-create-group → tabs. Test both Create and Join paths. Then sign-out (note: sign-out
   UI still not wired anywhere — add a button on the Profile tab when convenient).
4. **Begin Phase 2** (NOT in this commit, NOT for the immediate next Claude unless directed) —
   the offline drafts + upload queue is the MVP critical path (D-004). D-007 settled engine
   is Expo SQLite + MMKV.

**Blockers / decisions needed:**
- W-010 (migration apply) and W-008 (email template) block runtime smoke-test.
- No decisions opened or changed this session.

**Branch / commit:** `mvp` + this session's `feat(onboarding): implement profile and group setup`,
pushed to `origin/mvp` after all checks green.

**Notes for next session:**
- The gate is the only place that touches navigation routing. If you need to change the redirect
  matrix (e.g. add an email-verified gate), edit `useOnboardingGate` — do not put logic in
  screens or layouts.
- `useProfile` is intentionally disabled while signed-out so RLS doesn't throw when nobody is
  authenticated.
- Username is `toLowerCase`d at the zod boundary so casing variations don't fragment identity.
- `profiles.username` and `display_name` are nullable in DB (intentional) but enforced non-null
  at the client zod boundary on profile-setup submission.
- Owner-as-member is enforced by a DB trigger, not the client. If you want to add an "add
  multiple owners" UI later, go through `group_members` directly with the admin RLS.
- **Migration is hand-maintained.** No `supabase` CLI is wired into the project; if you adopt
  it, point it at `supabase/migrations/`.
- **No tests still** (W-007). Hand-traced redirect matrix is in the doc-comment of
  `useOnboardingGate`.

**Tests run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅ · `npx expo-doctor` 18/18 ✅
(plan to also `npx expo start --clear` before push).
**Tests NOT run:** unit/E2E (W-007). Runtime onboarding flow (W-010 + W-008).

**Decisions changed this session:** none. D-001..D-008 stand.

---

## 2026-05-28 — Claude 1 / Expo SDK 52 → 54 upgrade

**Did:** Upgraded the project from **Expo SDK 52 → SDK 54** to match the user's physical iOS
Expo Go (Expo Go on iOS can't be reliably downgraded). Mechanical upgrade only — no MVP features
touched. tsc/lint/expo-doctor all green; `expo start --clear` boots cleanly.

## Expo SDK 54 Upgrade Notes for Next Claude

- **Previous SDK version:** Expo 52 (React 18.3.1, RN 0.76.3, expo-router 4.0.9, TS 5.3.3,
  @types/react 18.3.12, eslint-config-expo 8.0.1).
- **New SDK version:** Expo 54 (React 19.1.0, RN 0.81.5, expo-router 6.0.23, TS 5.9.2,
  @types/react 19.1.10, eslint-config-expo 10.0.0).
- **Changed package versions (deps):** `expo ~54.0.0`, `react 19.1.0`, `react-native 0.81.5`,
  `expo-router ~6.0.23`, `expo-asset ~12.0.13`, `expo-constants ~18.0.13`, `expo-linking ~8.0.12`,
  `expo-secure-store ~15.0.8`, `expo-status-bar ~3.0.9`, `react-native-safe-area-context ~5.6.0`,
  `react-native-screens ~4.16.0`. **`react-native-web` REMOVED** (we're native-only — see below).
- **Changed package versions (devDeps):** `@types/react ~19.1.10`, `typescript ~5.9.2`,
  `eslint-config-expo ~10.0.0`.
- **New file:** `metro.config.js` (minimal: extends `expo/metro-config`). Satisfies expo-doctor's
  Metro-config check and aligns with Expo's recommended setup.
- **app.json:** added `"platforms": ["ios", "android"]` so `npx expo install` will not re-introduce
  `react-native-web`. Consistent with D-006 (no web/Explore in MVP).
- **Commands run, in order:**
  1. `npm install --save expo@~54.0.0`
  2. `npx expo install --fix` (proposed new versions; npm install failed on peer conflict with
     `react-native-web@0.21.2` pulling `react-dom@19.2.x` against `react@19.1.0`).
  3. Edited `package.json` (removed `react-native-web`, bumped devDeps to expected versions).
  4. Edited `app.json` (added `platforms: ["ios","android"]`).
  5. `rm -rf node_modules package-lock.json && npm install --no-audit --no-fund` — clean install,
     925 packages added.
  6. Added `metro.config.js`.
  7. `npm run typecheck` ✅ · `npm run lint` ✅ · `npx expo-doctor` 18/18 ✅.
  8. `CI=1 npx expo start --clear --port 8082` — Metro booted, `Waiting on http://localhost:8082`,
     env loaded, no errors. Killed cleanly after success signal.
- **npx expo-doctor passes:** ✅ **18/18 checks**.
- **npm run typecheck passes:** ✅ exit 0.
- **npm run lint passes:** ✅ exit 0. (eslint-config-expo v10 still works with legacy `.eslintrc.js`.)
- **npx expo start --clear was tested:** ✅ Booted cleanly on port 8082 (8081 was occupied by the
  user's earlier orphaned `npm start` session — not an upgrade issue).
- **Post-upgrade fix-up:** SDK 54 requires `babel-preset-expo` as an **explicit** dep
  (in SDK 52 it was implicit). Added to `devDependencies` as `~54.0.10` after Metro complained
  "Cannot find module 'babel-preset-expo'". Don't remove it.
- **Remaining warnings:**
  - npm reports transitive vulnerabilities post-install (count may differ from B-001's earlier 19).
    Re-evaluate in B-001 once on SDK 54; do NOT run `npm audit fix --force` (would jump to SDK 56).
  - `expo-env.d.ts` is regenerated by Expo at start (different content than my prior stub — fine,
    it's gitignored). On a fresh clone, run `npx expo start` once before `npm run typecheck` if you
    see "Cannot find type definition" errors for `expo/types`.
  - Port 8081 still held by the user's earlier `npm start` shell. Either kill that shell or use
    `--port 8082`.

**Exact commands the next Claude should run before continuing:**
```bash
git pull origin mvp
npm install
npx expo-doctor
npm run typecheck
npm run lint
npx expo start --clear
```

**Decisions changed this session:** none. D-001..D-008 unchanged. The native-only stance
(`platforms: ios,android`, no `react-native-web`) is consistent with D-006 (no web/Explore).

**Blockers / decisions needed:** none from the upgrade itself.

**Branch / commit:** `mvp` + this session's `chore(expo): upgrade project to SDK 54`. Pushed to
`origin/mvp` after all checks green.

**Notes for next session:**
- **Do NOT downgrade to SDK 52** — Expo Go on iOS tracks the latest SDK and can't reliably hold
  older versions; we matched SDK 54 for that reason.
- **Use `npx expo install <pkg>` for all new Expo-related deps** (preserves SDK 54 compatibility).
  Plain `npm install <pkg>` may pick a version that breaks the Expo matrix.
- **Native-only.** Don't reintroduce `react-native-web` or remove the `platforms` array unless web
  becomes scope (it's not — D-006).
- T-021 (terms gate) is still the recommended next task for Phase 1. Auth runtime smoke-test on
  Expo Go is still pending (W-008 — Supabase email template + the OTP flow).

**Tests run:** `npm run typecheck` ✅ · `npm run lint` ✅ · `npx expo-doctor` 18/18 ✅ ·
`npx expo start --clear` boot ✅.
**Tests NOT run:** unit/component/E2E (W-007 — no harness). Runtime auth flow on device (W-008
prerequisite).

---

## 2026-05-28 — Claude 2 / Phase 1 auth (T-020) implementation
**Did:** Implemented **Phase 1 email auth (T-020)** end-to-end — code only; runtime not yet
exercised against the live Supabase project.
- **Supabase wiring:** created local `.env` (gitignored, verified via `git check-ignore`) with
  project URL + anon key; hardened [`src/shared/lib/env.ts`](../../src/shared/lib/env.ts) to throw
  at module load if vars missing; built [`src/shared/lib/supabase.ts`](../../src/shared/lib/supabase.ts)
  with `expo-secure-store` token adapter, `flowType: 'pkce'`, `detectSessionInUrl: false`.
- **Deps added:** `@supabase/supabase-js@^2.106.2`, `expo-secure-store@~14.0.1`
  (`npx expo install` for the latter to get SDK 52-compatible version).
- **Auth feature module** ([`src/features/auth/`](../../src/features/auth/)):
  - `model/schemas.ts` — zod schemas; email is `trim().toLowerCase().email()`, password 8–72,
    OTP `/^\d{6}$/`.
  - `api/index.ts` — thin Supabase wrappers (signUp / signInWithPassword / verifyOtp(type:'signup')
    / signOut / getSession). All throw on error.
  - `hooks/useSession.ts` — `{ status: 'loading' | 'signedIn' | 'signedOut', session }`; reads
    initial session once, then subscribes to `onAuthStateChange`.
  - `hooks/{useSignIn,useSignUp,useVerifyOtp,useSignOut}.ts` — TanStack `useMutation` wrappers
    that re-validate via zod before calling api (defense in depth).
  - Public surface: hooks + schemas + types only. `api/` and `model/schemas.ts` internals are
    private (not exported from `index.ts`).
- **Design system:** added `Input` primitive ([`src/shared/ui/Input.tsx`](../../src/shared/ui/Input.tsx))
  — label/hint/error, focus border via `ring` token, ≥44pt minHeight, `StyleSheet.hairlineWidth`
  border. Exported from `src/shared/ui/index.ts`.
- **Group layouts:** new [`app/(auth)/_layout.tsx`](../../app/(auth)/_layout.tsx) (Stack, headers
  visible, title set per screen via `<Stack.Screen options=…>`) and
  [`app/(onboarding)/_layout.tsx`](../../app/(onboarding)/_layout.tsx) (Stack, `headerBackVisible:
  false` so onboarding steps can't be skipped).
- **Auth screens fleshed out:** [`app/(auth)/sign-in.tsx`](../../app/(auth)/sign-in.tsx),
  [`sign-up.tsx`](../../app/(auth)/sign-up.tsx), [`verify-email.tsx`](../../app/(auth)/verify-email.tsx)
  — real forms with field-level zod errors, KeyboardAvoidingView (iOS `padding`), proper
  autocomplete/textContentType hints, OTP input strips non-digits + maxLength 6 + `oneTimeCode`
  autofill. Sign-up `router.replace`s to verify-email with `email` query param. Sign-in/verify
  success relies on `onAuthStateChange` → root layout redirect (no manual nav).
- **Root layout** ([`app/_layout.tsx`](../../app/_layout.tsx)): added internal `<RootNav>` that
  reads `useSession()`, watches `useSegments()`, and `router.replace()`s — signed-out users out
  of non-`(auth)` routes, signed-in users out of `(auth)`. Loading state shows centered
  `ActivityIndicator` (token-coloured).
- **Verification:** `npm run typecheck` → exit 0 ✅ · `npm run lint` → exit 0 ✅.

**In progress:** Nothing half-done.

**Next up:**
1. **USER ACTION — Supabase email template:** Dashboard → Auth → Email Templates →
   *"Confirm signup"*. Make sure the body includes `{{ .Token }}` (the 6-digit OTP). Default
   templates often only include `{{ .ConfirmationURL }}` (magic link) — with that default, the
   verify-email screen has nothing to verify. See W-008 below.
2. **Smoke-test the auth flow:** `npm start` → sign up with a real email → enter OTP →
   confirm app lands on (tabs). Then sign in. The `useSignOut` hook exists but isn't yet wired
   to any UI — add a button on Profile tab when convenient.
3. **T-021 — terms acceptance gate** (versioned).
4. **T-022 — profile setup + server `onboarded` flag.** Extend `<RootNav>` redirect: signed in
   + !onboarded → `/(onboarding)/profile-setup`.
5. **T-023 — friend invite links + group create/join.**
6. **T-003 — apply Supabase schema + RLS** (still TODO; needed for `onboarded` flag, profiles,
   groups, etc.). RLS draft in `docs/architecture/SUPABASE_SCHEMA_DRAFT.md` is sketch quality —
   harden + add pgTAP tests before applying.

**Blockers / decisions needed:**
- W-008: Supabase email-template config (USER) — without `{{ .Token }}` in the template, OTP
  flow doesn't work end-to-end. Code is correct; config is one toggle in the dashboard.
- T-003 schema not applied. Auth itself works without it (Supabase `auth.users` is built-in),
  but T-022 (profile/onboarded) needs the `users` table from the schema draft.

**Branch / commit:** `mvp` — this session's commit `feat(auth): implement Phase 1 email auth
(T-020)` includes 23 file changes (T-020 implementation + 3 earlier doc-drift fixes for D-007 in
`AGENTS.md` / `FILE_MAP.md` / `CURRENT_STATE.md`). Pushed to `origin/mvp`.

**Notes for next session:**
- **Brief flash on cold start.** `RootNav` returns `<View><ActivityIndicator/></View>` during
  loading, then `<Stack>` once session resolves. For signed-out cold starts, the Stack briefly
  mounts the initial route (likely `(tabs)`) before the redirect `useEffect` runs. Fix: use
  `expo-router`'s `SplashScreen.preventAutoHideAsync()` / `hideAsync()` to hold the native splash
  until session is known. Logged as B-002.
- **`.env` is at repo root, gitignored** — contains the Supabase URL + anon key. If you re-clone
  / move machines, recreate it from Dashboard → Settings → API. **Never commit** (W-006 + the
  `.githooks/pre-commit` regex blocks `eyJ`-style JWTs too, as a backstop).
- **npm install audit:** "19 vulnerabilities (13 moderate, 6 high)" reported. These are
  transitive in the existing Expo/RN tree, not from the new Supabase/secure-store packages.
  Not actionable today; revisit during T-061 (CI/release). Logged as B-001.
- **The `(auth)`/`(onboarding)` route groups are URL-invisible** — `/(auth)/sign-in` maps to
  `/sign-in` in deep links. Fine for now.
- **Sign-out UI:** none. `useSignOut()` is exported but unused — add a button on the Profile
  tab in any of the next sessions.

**Tests run:** `npm run typecheck` → 0 ✅ · `npm run lint` → 0 ✅.
**Tests NOT run:** unit/E2E (W-007 — none configured); **runtime auth flow** (no device run).

**Decisions changed this session:** none. D-007 (Expo SQLite + MMKV) and D-008 (Supabase Storage
first) remain accepted.

## 2026-05-27 — HANDOFF SNAPSHOT (ready for next Claude; pre-Phase-1)

> Clean checkpoint. No new implementation this session — verification + handoff only.

**Completed work (project to date):**
- Shared-memory/handoff system, architecture proposal (`docs/architecture/*`), two-Claude shared
  config (`.claude/`, `.githooks/pre-commit`, `scripts/bootstrap-claude.md`).
- **Phase 0 foundation** (`b004557`): Expo SDK 52 + expo-router + TS skeleton — navigation shell,
  design tokens + UI primitives, domain entities, engine-agnostic offline skeleton, service
  interfaces, feature index skeletons, ESLint import boundaries. tsc + lint green.
- **Phase 1 prep** (`86bbcd0`): settled **D-007 = Expo SQLite + MMKV** (WatermelonDB deferred);
  fixed `Card` to `StyleSheet.hairlineWidth`; added 5 Phase 1 route shells (auth + onboarding).

**Changed files (latest unpushed commit `86bbcd0`):** 14 files —
`app/(auth)/{sign-in,sign-up,verify-email}.tsx`, `app/(onboarding)/{profile-setup,join-or-create-group}.tsx`,
`src/shared/ui/Card.tsx`, `src/offline/db/index.ts`, `src/offline/queue/types.ts`, and docs
(ARCHITECTURE, OFFLINE_SYNC, DECISIONS, CURRENT_STATE, TASKS, HANDOFF). This handoff commit also
touches CURRENT_STATE/TASKS/BUGS_AND_WARNINGS/HANDOFF.

**Unfinished work:** No code is half-written. Phase 1 auth is entirely unstarted (T-020–T-023).
The `(auth)`/`(onboarding)` route files are placeholders with no logic and no `_layout.tsx`.
`useSessionState()` is a stub returning `signedIn`. Service SDKs (Sentry/analytics) are no-op
interfaces awaiting real wiring (T-012).

**Next recommended task:** Begin **Phase 1 auth (T-020)** — but FIRST create the Supabase project +
credentials (put them in `.env`; only `EXPO_PUBLIC_*` ship in the bundle). Then: email/PKCE auth in
`src/features/auth` (session hook + `expo-secure-store` tokens), terms gate (T-021), profile setup
(T-022), group create/join (T-023). Wire the real session into `useSessionState()` and add redirects
+ group `_layout`s.

**Known issues:** No test harness configured yet (see W-007 / T-060). `(auth)`/`(onboarding)` lack
`_layout.tsx` (they render under the root Stack for now). `expo-env.d.ts` is gitignored — a fresh
clone may warn on typecheck until `npx expo start` regenerates it.

**Tests run:** `npm run typecheck` → exit 0 ✅ · `npm run lint` → exit 0 ✅.
**Tests NOT run:** unit/component/E2E — **none exist; no `test` script configured** (T-060, deferred
to Phase 5 but a Jest harness could land earlier). Maestro offline E2E is the must-have later.

**Warnings for the next Claude:**
- Run `npm install` after pulling — `node_modules` is gitignored.
- Enable the secret-scan hook once per clone: `git config core.hooksPath .githooks` (NOT pulled).
- Respect ESLint import boundaries — a `no-restricted-imports` error is intentional (`.eslintrc.js`).
- Do NOT build post-MVP features (AI, Explore, global leaderboard, chat, XP) — DECISIONS D-006.
- Keep streaks/leaderboards/verification/day-boundary server-authoritative (D-003).
- New account? Follow `scripts/bootstrap-claude.md` and reload the window so repo skills register.

**Branch / commit:** `mvp` @ `86bbcd0` + this handoff commit. Pushed to `origin/mvp` this session.

**Decisions changed this session:** none (D-007 was settled in the prior commit `86bbcd0`).

## 2026-05-27 — Phase 1 prep / foundation cleanup
**Did:**
- **Settled D-007:** local persistence = **Expo SQLite (relational) + MMKV (key/value)**;
  WatermelonDB **deferred** (revisit only if offline relational sync gets materially more complex).
  Updated DECISIONS.md (D-007 → Accepted), OFFLINE_SYNC.md, ARCHITECTURE.md, TASKS.md (T-015 DONE),
  and the `src/offline` code comments (no longer say "PENDING"; placeholder error now says "lands
  in Phase 2"). No DB deps added yet — implementation is Phase 2.
- **Fixed `Card.tsx`:** border now uses `StyleSheet.hairlineWidth` (density-aware) instead of the
  custom `StyleSheetHairline = 1` constant (removed).
- **Added Phase 1 route shells** (thin placeholders, NO auth logic): `app/(auth)/sign-in`,
  `sign-up`, `verify-email`; `app/(onboarding)/profile-setup`, `join-or-create-group`.
- Ran `npm run typecheck` → green, `npm run lint` → green.

**Scope respected:** no full auth, no Supabase migrations, no post-MVP features.

**In progress:** Nothing half-done.

**Next up — Phase 1 auth (T-020–T-023):** create the Supabase project + credentials (env via
`.env`, only EXPO_PUBLIC_* in the bundle), implement email/PKCE auth in `src/features/auth`
(session hook, secure-token storage), terms-acceptance gate, profile setup, group create/join.
Wire the auth guard in `useSessionState()` (currently a placeholder returning `signedIn`) and add
redirects in `app/_layout`. The route shells above are ready to receive that logic.

**Blockers / decisions needed:** Supabase project/credentials must be created before auth can talk
to a backend. No open foundation decisions remain (D-007 settled).

**Branch / commit:** `mvp` + `chore: prepare Phase 1 auth foundation`.

**Notes for next session:** `(auth)`/`(onboarding)` are route groups with no `_layout.tsx` yet —
they currently render under the root Stack; add group `_layout`s when wiring the auth flow. Run
`npm install` after pulling (node_modules gitignored).

## 2026-05-27 — Phase 0 foundation session
**Did:** Implemented the **Phase 0 foundation** (skeleton only — no features). Expo SDK 52 +
expo-router v4 + TypeScript.
- Config: `package.json`, `tsconfig.json` (`@/*`→`src/*`, strict), `app.json` (expo-router +
  typedRoutes), `babel.config.js`, `.eslintrc.js` (layered import boundaries via core
  `no-restricted-imports`), `.env.example`.
- Navigation shell: `app/_layout` (SafeAreaProvider + QueryClientProvider + ThemeProvider + Stack),
  `app/(tabs)` (Today/Challenges/Groups/Profile), `app/challenge/[id]`, `app/+not-found`.
- Design system: `src/shared/ui` — semantic tokens (light/dark), `ThemeProvider`, primitives
  (Text/Button/Card/Screen) with a11y baked in.
- Domain: `src/entities` (user, group, challenge, submission, verification + mappers/). `SyncStatus`
  lives in entities (domain owns lifecycle); offline imports it.
- Offline: `src/offline` engine-agnostic skeleton (db interface, queue types + backoff, upload
  interface). **No engine chosen — D-007 still PENDING.**
- Services: `src/services` analytics (typed events)/crash/notifications — no-op interfaces.
- Features: `src/features/<9 domains>` index.ts public-surface skeletons.
- Navigation helpers: `src/navigation` routes/guards/linking.
- **Ran `npm install` (1131 pkgs), `npm run typecheck` → green, `npm run lint` → green.** Lint
  caught a real `entities → @/offline` boundary violation; fixed by moving `SyncStatus` into entities.

**In progress:** Nothing half-done. Foundation is complete and green.

**Next up:** Settle **D-007** (T-015) before building `src/offline/db`. Then Phase 1 auth
(T-020–T-023). Phase 2 (proof + queue, critical path) is where `SyncBadge` and the queue processor
land. Wire real Sentry/analytics SDKs into the existing `src/services` interfaces (T-012).

**Blockers / decisions needed:** D-007 (local DB engine). Supabase project/credentials still need
creating before Phase 1 auth can talk to a backend.

**Branch / commit:** `mvp` + `chore: add mobile app foundation`.

**Notes for next session:** `node_modules` is gitignored — run `npm install` after pulling.
`expo-env.d.ts` is gitignored but a local copy exists for tsc; `npx expo start` regenerates it.
Import boundaries are enforced by ESLint — if you get a `no-restricted-imports` error, respect the
layer (it's intentional, see `.eslintrc.js`). The app shell currently shows tabs unconditionally
because `useSessionState()` is a placeholder returning `signedIn` (real auth = Phase 1).

## 2026-05-27 — Two-Claude shared-config session
**Did:** Set up shared configuration so both Claude accounts are interchangeable from the repo:
- Vendored the project skill into `.claude/skills/mobile-app-architect/` (auto-loads; no per-account install).
- Added `.claude/settings.json` (model=opus; permissions allow/ask/deny incl. deny-read on secret files).
- Added `.githooks/pre-commit` secret scanner (gitleaks if present, else high-signal regex) and ran
  `git config core.hooksPath .githooks`; smoke-tested — it blocks a fake `sk_live_…`. Marks **T-014 DONE**.
- Added `scripts/bootstrap-claude.md` (one-time setup for a new "Claude 2": enable hooks, install
  shared third-party skills, match settings/identity).
- Added a "shared vs account-local" caveat to `CLAUDE.md`. Updated `FILE_MAP`, `CURRENT_STATE`, `TASKS`.

**In progress:** Nothing in code.

**Next up (only after user approves implementation):** unchanged from prior entry — T-015 (settle
D-007 local DB engine), then T-002 (scaffold Expo app), then T-003 (Supabase schema, not applied yet).

**Blockers / decisions needed:** Each clone must run `git config core.hooksPath .githooks` once
(not auto — git stores hooksPath locally). A brand-new Claude account must run
`scripts/bootstrap-claude.md` to install the third-party skills (those are NOT vendored).

**Branch / commit:** `mvp` + this session's `chore: shared Claude config for two-agent workflow`.

**Notes for next session:** The git hook only catches secrets via the `core.hooksPath` config —
verify it's set in your clone (`git config core.hooksPath` → `.githooks`). The behavioral W-006 rule
still applies as the primary control; the hook is the backstop.

## 2026-05-27 — Architecture-proposal session
**Did:**
- Set up Git: `git init` (branch `main`), `.gitignore`, first commit `fa77c05`; hardened
  `.gitignore` for secrets + added a standing "never commit secrets / warn before staging" rule to
  `CLAUDE.md` and `BUGS_AND_WARNINGS.md` (W-006), commit `66b813f`. Added remote `origin`
  (Dastanq44/Basta-App) and pushed branch `mvp`.
- Wrote the **architecture proposal** under `docs/architecture/`: `ARCHITECTURE.md`,
  `DATA_MODEL.md`, `OFFLINE_SYNC.md`, `NAVIGATION.md`, `SUPABASE_SCHEMA_DRAFT.md`.
- Applied scope adjustments: renamed the tab **"Today/Feed" → "Today"**; added explicit
  **Explore/public feed = POST-MVP** notes; added **D-007** (local DB engine: WatermelonDB vs
  SQLite+MMKV — PENDING) and **D-008** (media upload: standard Supabase Storage first, tus
  deferred) to `DECISIONS.md`; softened D-004 accordingly.
- Updated memory files: `FILE_MAP.md`, `CURRENT_STATE.md`, `TASKS.md`, `DECISIONS.md`.

**In progress:** Nothing in code. Proposal is complete and committed (`docs: add MVP architecture
proposal`).

**Next up (only after the user approves starting implementation):**
1. `T-015` — settle **D-007** (local persistence engine). Lean: SQLite + MMKV; confirm with team.
2. `T-002` — scaffold the Expo + TypeScript app (expo-router) + feature folders per D-002.
3. `T-003` — create the Supabase project and apply the (reviewed) schema + RLS. **Schema draft is
   NOT applied yet** — harden RLS + add pgTAP tests first.

**Blockers / decisions needed:**
- User must confirm starting implementation (this session was docs-only).
- D-007 needs a team decision before building `src/offline/db`.
- Supabase project + credentials need creating (by the user / with go-ahead). No secrets in repo.

**Branch / commit:** `mvp` @ `66b813f` + this session's `docs: add MVP architecture proposal`
(ahead of `origin/mvp`; not pushed this session unless asked).

**Notes for next session:** Read `docs/architecture/ARCHITECTURE.md` first — it links the rest.
Keep streaks/leaderboards/day-boundary/verification server-authoritative (D-003). Offline drafts +
upload queue is the critical path (D-004). Do NOT build Explore/public feed (post-MVP, D-006). Do
NOT apply the Supabase schema draft as-is — RLS is a sketch.

## 2026-05-27 — Setup session (memory/handoff system)
**Did:** Created the shared-memory & handoff system: `CLAUDE.md`, `AGENTS.md`, and the eight
`docs/claude-memory/*` files (PROJECT_BRIEF, CURRENT_STATE, HANDOFF, DECISIONS, TASKS, FILE_MAP,
BUGS_AND_WARNINGS). Confirmed the working directory is empty and **not a git repo**. Locked the
stack and core architecture decisions in `DECISIONS.md`.

**In progress:** Nothing in code. System docs are complete.

**Next up (do these in order, after the user approves starting implementation):**
1. `T-001` — `git init`, add a sensible `.gitignore` (Node/Expo/RN), make the first commit.
2. `T-002` — Scaffold the Expo + TypeScript app (Expo Dev Build, expo-router) and the
   feature-folder structure per `DECISIONS.md` D-002 and `FILE_MAP.md`.
3. `T-003` — Create the Supabase project; define the initial schema + RLS (groups, memberships,
   challenges, submissions, verifications) — server-authoritative scoring stubs.

**Blockers / decisions needed:**
- User must confirm they want to begin implementation (this session was explicitly docs-only).
- Supabase project + credentials need to be created by the user (or with their go-ahead).

**Branch / commit:** no repo yet.

**Notes for next session:** Do NOT relitigate the stack — it's locked in `DECISIONS.md` D-001.
Read `PROJECT_BRIEF.md` for scope guardrails (don't build excluded features). Keep streaks &
leaderboards server-side from day one — retrofitting that later is expensive.
