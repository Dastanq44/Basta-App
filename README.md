# Basta

**Basta** is a mobile-first social challenge tracker for iOS and Android — self-development framed
as a social accountability game. Form a group of friends, run solo or group challenges, submit
daily photo proof, get it verified by a friend, and keep your streak alive on the group
leaderboard. Built to work offline: proof drafts and uploads are queued and synced when you're back
online.

## MVP at a glance

- Email registration & profile
- Friend groups (invite links / search)
- Solo & group challenges (category + duration)
- Daily proof submission (photo first)
- Friend verification, reactions & comments
- Server-authoritative streaks & group leaderboards
- Push reminders (quiet hours, frequency caps, user controls)
- Offline-first drafts & durable upload queue
- Report / block / terms / account deletion

**Not in MVP:** AI verification, Explore feed, global leaderboards, full chat, health integrations.

## Stack

- **App:** React Native + TypeScript, Expo Development Builds + EAS
- **Backend:** Supabase / Postgres (Auth + RLS, server-authoritative scoring, Storage, push)
- **Offline:** WatermelonDB (SQLite) + MMKV, durable mutation/upload queue, tus resumable uploads

## Working on this repo

This project is maintained across AI sessions via a shared-memory system. **Before making
changes, read [`CLAUDE.md`](CLAUDE.md)** and the files under
[`docs/claude-memory/`](docs/claude-memory/) — start with `HANDOFF.md` and `CURRENT_STATE.md`.
Architecture decisions are locked in `docs/claude-memory/DECISIONS.md`.

> Status: **pre-implementation** — project scaffolding has not started yet. See
> `docs/claude-memory/CURRENT_STATE.md`.
