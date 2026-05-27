# Architecture Reference

## Stack comparison framework (RN vs Flutter)

Score both against the dimensions that actually move the needle for a media-heavy,
social, offline-first app. For each option produce: when to choose, key
advantages, key disadvantages, recommended architecture, state strategy, local
persistence, backend/sync, CI/CD, final recommendation.

| Dimension | React Native + TS (Expo/EAS) | Flutter |
|---|---|---|
| Iteration speed | Fast Refresh + EAS Update OTA; large TS hiring pool | Hot reload; smaller mobile pool |
| Media capture/upload | expo-camera/-image-picker/-video + tus | first-class camera; isolates for encode |
| Push | expo-notifications + FCM/APNs | firebase_messaging |
| Offline DB | WatermelonDB / op-sqlite; MMKV KV | Drift / Isar |
| Render perf | Good with discipline; New Arch (Fabric) | Excellent by default (Skia/Impeller) |
| Gestures/anim | Reanimated + Gesture Handler (UI thread) | built-in, strong |
| Backend fit (Supabase) | best-in-class JS SDK, TS edge fns | good SDK, Dart↔TS context switch |
| Shared types | DB → generated TS types end-to-end | Dart codegen, no JS sharing |

**Recommended default: React Native + TypeScript + Expo Dev Builds + EAS +
Supabase.** Choose Flutter instead when the team is Dart-fluent, custom rendering /
60fps-everywhere is the top priority, or you need pixel-identical UI as a hard
requirement.

How Flutter differs if chosen: Riverpod (not TanStack Query + Zustand), Drift (not
WatermelonDB), `ThemeData` + `ThemeExtension` (not a token module), GoRouter (not
expo-router).

## Recommended RN architecture

Layered + feature-sliced. Reads flow through TanStack Query (server cache) backed
by a local DB mirror; writes flow through a durable mutation queue.

```
app/                              # expo-router routes = THIN screens
  _layout.tsx                     # providers, theme, query client, auth guard
  (auth)/  (onboarding)/  (tabs)/
  challenge/[id]/  group/[id]/  verify/[submissionId].tsx
src/
  features/<domain>/
    api/        # supabase calls + DTOs
    hooks/      # useX feature hooks (business logic)
    model/      # zod schemas, feature state
    ui/         # feature-local components
    index.ts    # public surface — other features import ONLY this
  entities/                       # domain models
    mappers/                      # DTO → domain
  shared/
    ui/theme/   ui/Button.tsx ...  # design system
    lib/        # supabase, queryClient, mmkv
    gestures/  utils/
  offline/
    db/  queue/  upload/
  services/
    analytics/  notifications/  crash/
  navigation/                     # linking.ts, guards.ts
supabase/migrations|functions|seed.sql
__tests__/  e2e/  .github/workflows/
```

### Layering contract (enforce with eslint import/no-restricted-paths)

- `app/` may import `features/`, `shared/`.
- `features/` may import `entities/`, `shared/`, `offline/`.
- `entities/` import nothing app-specific.
- No feature imports another feature's internals — only its `index.ts`.
- Screens never import a raw DB row type; only domain entities.

### Backend boundaries (server-authoritative)

Auth, RLS, groups/memberships, challenges, submissions, verifications,
comments/reactions, **streak + leaderboard computation** (Postgres functions +
pg_cron), **day-boundary rollover in the user's stored timezone**, media storage +
signed-URL issuance, push scheduling (quiet hours, frequency caps), moderation
tables + admin RPCs.

### State-management split

| Kind | Examples | Tool | Persisted |
|---|---|---|---|
| Server state | challenges, verified submissions, leaderboards | TanStack Query + DB mirror | read mirror |
| Persisted local | drafts, queued mutations, media paths, cursors | WatermelonDB + MMKV | source of truth until acked |
| Ephemeral UI | modal open, form focus, scroll pos | useState / small Zustand | no |
| Secrets | auth tokens | expo-secure-store | secure only |

Minimize rerenders: TanStack `select` slices, Zustand selectors (never whole
store), FlashList with stable server-id keys, `React.memo` rows, Reanimated
worklets off the JS thread.

### Navigation design

Auth group → onboarding (profile + join/create group, gated on server
`onboarded`) → bottom tabs (Today / Challenges / Groups / Profile) → challenge
detail → proof submit (modal, camera-first, returns instantly while upload queues)
→ verification (push deep-link, server enforces who may verify). Global offline
banner + per-item sync badge + query-error fallback with retry. Typed linking;
tokens in deep links go in the body, never the URL.
