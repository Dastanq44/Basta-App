# Basta — Navigation Structure

> **Status: PROPOSAL (pre-implementation).** expo-router, file-based, typed.

## Navigation v2 (2026-06, T-085)

Bottom tab order is now **Today · Challenges · Groups · Global · Profile** (route names unchanged —
`index`, `challenges`, `groups`, `explore`(title "Global"), `profile`). A global `<OfflineBanner>`
is mounted above the navigator in `app/_layout` (visible only when offline).

```mermaid
flowchart LR
  subgraph TabsV2["(tabs) — v2 order"]
    direction LR
    Today --> Challenges --> Groups --> Global --> Profile
  end
  Today -->|due card| CDetail["challenge/[id]"]
  Challenges --> CDetail
  Groups --> GDetail["group/[id] (Overview/Challenges/Leaderboard)"]
  Global -->|"GlobalFeedCard"| SDetail["submission/[id]"]
  Profile -->|"Proofs/Challenges/Groups tabs"| SDetail
  Profile --> CDetail
  Profile --> GDetail
  CDetail -->|"member"| Submit["submit-proof (modal)"]
  CDetail -->|"public, non-participant"| CPrev["PublicChallengePreview (read-only)"]
  GDetail -->|"public, non-member"| GPrev["PublicGroupPreview (Overview/Challenges/Proofs)"]
  SDetail -->|"context boxes"| UserP["user/[id]"]
```

```mermaid
flowchart TD
  Start([launch]) --> S{session valid?}
  S -- no --> SignIn[sign-in] --> SignUp[sign-up] --> Verify[verify-email]
  Verify --> Onb{onboarded?}
  S -- yes --> Onb
  Onb -- no --> Profile[profile-setup] --> Join[join-or-create-group] --> Tabs
  Onb -- yes --> Tabs
  subgraph Tabs["(tabs)"]
    Today[Today]
    Challenges
    Groups
    ProfileTab[Profile]
  end
  Today --> CDetail["challenge/[id]"]
  Challenges --> CDetail
  CDetail --> Submit["submit-proof (modal)\ncapture -> draft -> queue"] --> Tabs
  Groups --> GDetail["group/[id] (leaderboard)"]
  Push[[push: friend submitted]] --> VerifyScr["verify/[submissionId]"] --> Tabs
  Submit -. offline .-> Queue[(upload queue\nbadge: uploading/retry)]
```

## Flows

- **Auth** group — email + PKCE. Email-verify deep-link carries a one-time token **in the body,
  never the URL**.
- **Onboarding** — gated on a server `profiles.onboarded` flag: profile setup → join/create group
  (invite link or search).
- **Main tabs** — **Today**, Challenges, Groups, Profile.
- **Challenge detail** → primary CTA opens **submit-proof** as a modal route (camera-first). The
  screen returns immediately while the upload runs in the background queue; a sync badge reflects
  status wherever the submission appears.
- **Verification** — reached via push deep-link to `verify/[submissionId]`; the server enforces who
  may verify (not your own submission).
- **Error/offline** — global offline banner + per-item sync badge + query-error fallback with retry.

## Today tab (scope clarification)

The **Today** tab shows the user's due tasks plus the **in-group activity feed** (recent
proofs/verifications from the user's groups). It is intentionally named **"Today"** (not
"Today/Feed") to avoid implying a general feed surface.

> ⚠️ **Explore / public feed is POST-MVP** and must not be built now. The only feed in the MVP is
> the bounded, in-group activity shown on Today. A public/global Explore feed is excluded by
> DECISIONS D-006.

## Phase 2 routes (added)

- `app/challenge/new.tsx` — create challenge form (title/category/mode/start-date/duration/proof).
- `app/challenge/[id].tsx` — detail: today's status, submit CTA, recent submissions list. Reads
  `useChallenge`, `useTodaySubmission`, `useQueueForChallenge`, `useSubmissions`.
- `app/challenge/[id]/submit-proof.tsx` — modal-presented proof composer (camera/library
  + comment + draft-on-capture + enqueue + kick processor).

> Note: expo-router's experimental `typedRoutes` hasn't yet generated a typed entry for the
> nested `/challenge/[id]/submit-proof` path, so navigation to it currently uses the resolved
> string-href form (`/challenge/${id}/submit-proof`). Functional; refresh on next
> dev-server restart should regenerate the union.

## T-026 routes (added — main-app group create/join + archived restore)

- `app/group/join-or-create.tsx` — **modal** route used from the Groups tab. Reads
  `?mode=create|join` to bias the initial toggle. Internally renders the reusable
  `GroupCreateOrJoinForm`; on success `router.replace`s to `/group/${groupId}`.
- `app/group/archived.tsx` — list of archived groups (`useMyArchivedGroups`). Each row
  has a Restore button shown only when the current user is the group owner. Tapping it
  confirms via `Alert.alert`, then calls the `restore_group` RPC and refetches both lists.
- Onboarding's `(onboarding)/join-or-create-group.tsx` now delegates to the same shared
  `GroupCreateOrJoinForm`, so the two flows can't drift apart.

Both routes are registered in `app/_layout.tsx`'s root Stack:
- `group/join-or-create` — `presentation: 'modal'`, title `New group`.
- `group/archived` — title `Archived groups`.

> Note (typedRoutes): typedRoutes hasn't regenerated for these paths yet, so
> `router.push('/group/join-or-create?mode=…' as Href)` and `'/group/archived' as Href`
> use the `Href` cast — matches the pattern already used for `/group/${id}`.

## Phase 4A-2 routes (added)

- `app/blocked-users.tsx` — list + Unblock (managed via `useMyBlocks` / `useUnblockUser`).
  Registered in `app/_layout.tsx` Stack (`headerShown: true`, title `Blocked users`).
- Profile gains an **Account** section linking to `/blocked-users` (cast `as Href` until
  typedRoutes regenerates) and a **Danger zone** with Request account deletion.
- `ReportSheet` is a **Modal** primitive (not a route) used from
  `app/submission/[id].tsx`, `app/challenge/[id].tsx`, `app/group/[id].tsx`.

## Phase 4A-1 routes (added)

- `app/(auth)/forgot-password.tsx` — email input, calls
  `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'basta://reset-password' })`.
- `app/(auth)/reset-password.tsx` — reads `?code=` deep-link param, calls
  `exchangeCodeForSession` then `updateUser({ password })`. Shows a hint pointing to W-020
  if `code` is missing (deep-link config incomplete).
- Sign-in screen now exposes a "Forgot password?" link to `/(auth)/forgot-password`
  (cast `as Href` until typedRoutes regenerates).

> **Deep-link requirement (W-020):** Supabase Auth → URL Configuration → Redirect URLs must
> include `basta://reset-password` before the email link will land in the app.

## Navigation rules

- Configuration (linking, guards) lives in `src/navigation/`, separate from feature
  implementations.
- Auth + onboarding guards redirect at the layout level (`app/_layout.tsx`), not inside screens.
- Deep links never carry sensitive data.

## Onboarding gate (implemented — `src/navigation/guards.ts` → `useOnboardingGate`)

The gate centralizes routing decisions so `app/_layout.tsx` stays thin. The server profile is
the source of truth (D-003); local state never decides routing.

| Session     | Profile          | Terms vs CURRENT | Onboarded | Target                              |
|-------------|------------------|------------------|-----------|-------------------------------------|
| `loading`   | —                | —                | —         | (no redirect — loading splash)      |
| `signedOut` | —                | —                | —         | `/(auth)/sign-in`                   |
| `signedIn`  | loading          | —                | —         | (no redirect — loading splash)      |
| `signedIn`  | error (no cache) | —                | —         | `/(onboarding)/profile-setup` ★     |
| `signedIn`  | `null` (no row)  | —                | —         | `/(onboarding)/profile-setup`       |
| `signedIn`  | present          | mismatch         | —         | `/(onboarding)/profile-setup`       |
| `signedIn`  | present          | match            | `false`   | `/(onboarding)/join-or-create-group`|
| `signedIn`  | present          | match            | `true`    | `/(tabs)`                           |

★ Routing-on-error avoids the infinite-loading trap if the migration (W-010) isn't applied or
RLS is misconfigured. The next mutation surfaces the underlying Supabase error inline.

Loop avoidance: the layout only calls `router.replace(target)` when `isAtTarget(segments,
target)` is false. Auth → on signed-in transition → goes through full gate, never lands on `(tabs)`
unconditionally.
