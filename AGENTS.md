# AGENTS.md — Quick Rules for AI Agents on Basta

> Condensed operating rules. The full manual is [`CLAUDE.md`](CLAUDE.md); the shared brain is
> [`docs/claude-memory/`](docs/claude-memory/). **Two separate Claude accounts swap sessions and
> share no private chat memory — these files are the only continuity.**

## Before you do ANYTHING
1. Read the memory files (start with `docs/claude-memory/HANDOFF.md`, then `CURRENT_STATE.md`,
   `PROJECT_BRIEF.md`, `TASKS.md`, `DECISIONS.md`).
2. Run `git status` + `git log --oneline -10`. Know the repo state before editing.
3. Continue from where the last session left off. **Never restart from scratch or re-scaffold.**

## Before you stop
Update `HANDOFF.md` (mandatory), then `CURRENT_STATE.md`, `TASKS.md`, and — if relevant —
`DECISIONS.md`, `FILE_MAP.md`, `BUGS_AND_WARNINGS.md`. Commit only when asked.

## Hard rules
- **Mobile-first, not web-first.** Native iOS + Android thinking. No DOM/Next.js mental models.
- **Feature folders.** `src/features/<domain>/`.
- **Thin screens.** Screens = layout + data prefetch + nav bindings. Nothing else.
- **Business logic outside screens.** Feature hooks → domain → data layers.
- **Server-authoritative streaks, leaderboards, and verification.** Client owns only drafts +
  the offline upload queue.
- **Preserve architecture decisions** in `DECISIONS.md`. Propose changes; don't diverge silently.

## What we're building (MVP)
Mobile social challenge tracker: friend groups, solo/group challenges, daily proof submission,
friend verification, streaks, group leaderboards, push reminders, offline proof drafts + upload
queue. **Excluded from MVP:** AI verification, Explore feed, global leaderboard, full chat.

## Stack
React Native + TypeScript + Expo/EAS · Supabase/Postgres · WatermelonDB + MMKV offline · tus uploads.
(See `DECISIONS.md` D-001 for rationale.)
