# PROJECT_BRIEF.md

> **Stable reference.** This describes WHAT we're building and WHY. It changes rarely. For
> "what's done right now" see `CURRENT_STATE.md`; for "what to do next" see `TASKS.md` / `HANDOFF.md`.

## What Basta is

A **mobile-first social challenge tracker** for iOS + Android. Self-development framed as a social
accountability *game*, not a chore. Friends keep each other honest.

## Core user flow

1. User registers (email).
2. User creates or joins a **group of friends** (search or invite link).
3. User starts a **solo or group challenge** (category + duration).
4. Every day, the user completes the task and **submits proof** (photo first; comment supported;
   video prepared but not the default MVP dependency).
5. **A friend verifies** the proof (MVP verification model).
6. The app tracks **streaks**, **group progress / leaderboards**, and sends **push reminders**.
7. Proof capture works **offline** — drafts and uploads are queued and synced when online.

## MVP scope

**In scope:**
- Email registration / login, user profile
- Friend search + invite links
- Group creation + joining
- Challenge creation; solo and group modes; category + duration
- Daily proof submission (photo first; video prepared, not default)
- Friend verification
- Likes / simple reactions; short comments
- Streaks (server-authoritative)
- Group leaderboard (server-authoritative)
- Basic push reminders (with quiet hours, frequency caps, user controls)
- Offline proof drafts + upload queue; clear sync states
- Basic moderation: report, block, terms acceptance, admin hooks
- Account deletion + data cleanup
- Analytics + crash reporting

**Explicitly OUT of MVP** (architecture may leave placeholders, but do not build):
- AI verification
- Public Explore feed
- Global leaderboards
- Full group chat / voice messages / stickers
- Strava / Apple Health / Android Health integrations
- XP, badges, trophies, duels, home-screen widgets, monetization

## Sync states a submission can be in
`draft → uploading → pending_verification → verified | rejected`
plus transport states: `failed → offline_retry`.
Client owns `draft → uploading`; **server owns** `pending_verification → verified/rejected`.

## Non-functional requirements
- Offline-first (never lose a user's proof draft to bad connectivity).
- Server-authoritative streaks, leaderboards, and verification results.
- Mobile-first, thumb-friendly, fast, accessible UI (≥44pt targets, screen-reader labels,
  dynamic type).
- Performance: virtualized lists, minimal rerenders, gesture/animation off the JS thread.
- Security: no secrets in the bundle, secure token storage, PKCE, private media via signed URLs.
- Trust & safety: report/block/terms + account deletion shipped in MVP.

## Target platforms
iOS 15+, Android 8+ (API 26+).

## Success criteria (MVP)
A user can register, form a group, run a challenge, submit photo proof while offline, have a
friend verify it, and see their streak and the group leaderboard update — with push reminders
nudging daily participation.
