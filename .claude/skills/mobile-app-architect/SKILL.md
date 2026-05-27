---
name: mobile-app-architect
description: >
  Use this whenever the work involves designing, architecting, or building a
  cross-platform mobile app (iOS + Android) — especially React Native / Expo or
  Flutter. Trigger it for mobile architecture decisions, feature folder layout,
  offline-first / sync-queue design, media capture & upload, push notifications,
  navigation structure, gesture handling, mobile performance, and a shadcn-style
  design system adapted to native. Use it EVEN IF the user only says "build the
  app", "add a screen", "set up navigation", "handle offline", or "make the UI" —
  any of these implies mobile architecture decisions this skill governs. Do NOT
  apply web-first / DOM / Next.js / server-component thinking to a mobile app;
  this skill exists to prevent that.
---

# Mobile App Architect

Think like a senior mobile engineer, not a web developer shrinking a website onto
a phone. The screen is small, the network is hostile, the camera is a first-class
input, and the OS — not your JS bundle — owns the lifecycle. Design for that
reality.

## When this is rigid vs. flexible

The **principles** below (server-authoritative scoring, offline-first drafts, thin
screens, no god files) are rigid — they prevent the failure modes that sink mobile
apps. The **specific libraries and folder names** are flexible — adapt to an
existing codebase's conventions rather than imposing these wholesale.

## Non-negotiable principles

1. **Server is authoritative for anything scored or social.** Streaks,
   leaderboards, verification results, day-boundary math, money. The client is
   authoritative ONLY for drafts and the local mutation/upload queue until the
   server acknowledges. Why: clients lie, clocks drift, and users reinstall — if
   the phone is the source of truth for a streak, the streak is a cheat surface.

2. **Offline-first, not offline-tolerant.** A user captures proof in an elevator.
   The draft + media must be written to local storage the moment it's captured,
   before any network attempt. Never lose user-generated content to connectivity.
   A durable queue drains when the network returns. See
   `references/offline-and-sync.md`.

3. **Thin screens, fat features.** Route/screen files do layout composition, data
   prefetching, and navigation bindings — nothing else. Business logic lives in
   feature hooks → domain → data/repository layers. No god `App.tsx` /
   `main.dart`, no mega-store, no god component. See
   `references/architecture.md`.

4. **Domain models are separate from API DTOs.** Map at the data-layer boundary.
   The UI never imports a raw Supabase/Firebase row type.

5. **Media capture/upload and push are first-class concerns**, designed up front —
   not bolted on. Resumable uploads (tus) for anything bigger than a thumbnail.

6. **Performance and gestures are features, not polish.** Virtualize every list
   (FlashList / `ListView.builder`), keep animation/gesture work off the JS thread
   (Reanimated worklets), memoize hot paths, stable keys.

7. **Accessibility is mandatory.** ≥44pt tap targets, labels on icon buttons,
   dynamic type, screen-reader roles. Not optional, not "later".

## The workflow gate

If the user is starting something new or changing behavior, you are doing
**creative work** — invoke the `brainstorming` skill FIRST (present a design, get
approval) before scaffolding or writing implementation code. This skill tells you
*how to architect*; brainstorming decides *what to build*. Process skills win over
implementation skills. After a design is approved, use `writing-plans`, then
`test-driven-development` for the build.

## Stack decision (do this before scaffolding)

If the stack isn't chosen, compare **React Native + TypeScript (Expo/EAS)** vs
**Flutter** across: iteration speed, media/upload, push, offline DB, render perf,
gestures, backend fit, team skills, hiring, OTA hotfix. Read
`references/architecture.md` for the comparison framework and the recommended
defaults.

**Recommended default unless there's a strong reason otherwise:** React Native +
TypeScript with Expo Development Builds + EAS, backed by Supabase/Postgres. Reasons:
end-to-end TypeScript with generated DB types collapses the DTO risk, EAS Update
gives safe OTA hotfixes for an early product, and the media/push/nav ecosystem is
mature. State the choice, then continue on it; briefly note how Flutter would
differ (Riverpod, Drift, `ThemeExtension`).

## Project structure (feature-sliced)

Route screens are thin wrappers. Logic lives in `features/`. Domain entities are
separate from DTOs. Enforce import boundaries with lint rules. Full tree and the
layering contract are in `references/architecture.md`. The shape:

```
app/            # routes = THIN screens (expo-router / GoRouter)
src/
  features/     # business logic per domain (auth, proof, challenges, ...)
  entities/     # domain models + DTO→domain mappers (NOT raw rows)
  shared/ui/    # design system: tokens + variant primitives (shadcn mindset)
  shared/lib/   # clients (supabase, query), storage
  offline/      # db, queue, upload (the heart of offline-first)
  services/     # analytics (typed events), notifications, crash
  navigation/   # linking config, guards — separate from features
```

## Sync state machine (every user submission carries a status)

`draft → uploading → pending_verification → verified | rejected`, plus orthogonal
transport states `failed → offline_retry`. The server owns the
`pending_verification → verified/rejected` transitions; the client owns
`draft → uploading`. Render a sync badge from this state so users always know where
their content stands. Reconciliation, backoff, and idempotency rules are in
`references/offline-and-sync.md`.

## UI: the shadcn mindset, adapted to native

shadcn/ui is web (React + Tailwind + Radix, renders to DOM) — do NOT add it as a
runtime dependency in a native app. Port the *mindset*, which is what makes it good:
**open code (you copy components in and own them), composition over inheritance,
semantic design tokens in background/foreground pairs, a variant API, and
light/dark by overriding the same tokens.** How to implement that in RN or Flutter
— including the full semantic token set and a `cva`-style variant helper — is in
`references/design-system.md`. Read it before building UI primitives.

## Security & trust-and-safety minimum

No secrets in the app bundle (ship only public/anon keys; RLS does the rest).
Tokens in secure storage (Keychain/Keystore), never AsyncStorage. PKCE for OAuth.
No sensitive data in deep links. Private vs public media split (proof media =
private bucket + short-TTL signed URLs). Ship report/block/terms-acceptance and an
account-deletion + media-purge path in the MVP — stores require deletion to be
reachable in-app.

## Reference files

Read the relevant one before doing that kind of work:

- `references/architecture.md` — stack comparison, full folder tree, layering
  contract, backend boundaries, state-management split, navigation design.
- `references/offline-and-sync.md` — local DB choice, durable mutation queue,
  resumable upload, backoff, idempotency, conflict resolution.
- `references/design-system.md` — shadcn-mindset tokens, variant API, and concrete
  RN (NativeWind / react-native-reusables) and Flutter (`ThemeExtension`) mappings.
