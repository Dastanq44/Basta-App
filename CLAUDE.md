# CLAUDE.md — Operating Manual for Basta

> **Basta** is a mobile-first social challenge tracker (iOS + Android).
> This file is the entry point for any AI session. **Read it fully before doing anything.**

This project is worked on by **two separate Claude Extension accounts that swap sessions.**
There is **no shared private chat memory between them.** The files under
[`docs/claude-memory/`](docs/claude-memory/) are the ONLY shared brain. Treat them as the
source of truth, keep them current, and never assume the other account "remembers" something
that isn't written down.

---

## 🛑 Start-of-session checklist (do this every time, in order)

1. **Read the memory files**, in this order:
   1. [`docs/claude-memory/PROJECT_BRIEF.md`](docs/claude-memory/PROJECT_BRIEF.md) — what we're building & scope
   2. [`docs/claude-memory/CURRENT_STATE.md`](docs/claude-memory/CURRENT_STATE.md) — where the repo is right now
   3. [`docs/claude-memory/HANDOFF.md`](docs/claude-memory/HANDOFF.md) — what the last session did and what's next
   4. [`docs/claude-memory/TASKS.md`](docs/claude-memory/TASKS.md) — the task board
   5. [`docs/claude-memory/DECISIONS.md`](docs/claude-memory/DECISIONS.md) — locked architecture decisions (do not relitigate)
   6. [`docs/claude-memory/FILE_MAP.md`](docs/claude-memory/FILE_MAP.md) — where code lives
   7. [`docs/claude-memory/BUGS_AND_WARNINGS.md`](docs/claude-memory/BUGS_AND_WARNINGS.md) — known issues & traps
2. **Check git status** (`git status`, `git log --oneline -10`, current branch). Understand
   what is committed, staged, and dirty **before touching anything.**
3. **Continue from the existing repo state.** Do NOT restart from scratch, re-scaffold, or
   recreate files that already exist. Build on what's there.
4. Pick up the **Next Up** items from `HANDOFF.md` / `TASKS.md` unless the user redirects.

## 🏁 End-of-session checklist (before you stop)

Update the handoff files so the next account can continue seamlessly:

1. **`HANDOFF.md`** — append a new dated entry: what you did, what's in progress, what's next,
   and anything the next session must know. This is the single most important update.
2. **`CURRENT_STATE.md`** — refresh the snapshot (what runs, what's built, branch, last commit).
3. **`TASKS.md`** — tick off completed tasks, add new ones discovered.
4. **`DECISIONS.md`** — record any new architecture decision you made (with rationale).
5. **`FILE_MAP.md`** — add any new significant files/folders.
6. **`BUGS_AND_WARNINGS.md`** — log any bug, gotcha, or half-finished thing.
7. **Commit** your work with a clear message (only when the user asks to commit/push).

> If you stop without updating `HANDOFF.md`, the other account is flying blind. Always update it.

---

## 🔒 Working rules (non-negotiable)

**Process**
- Always **read the memory files before editing** anything.
- Always **check git status before work.**
- Always **continue from existing repo state** — do not restart from scratch.
- Always **update the handoff files before stopping.**
- **Preserve architecture decisions** in `DECISIONS.md`. If you believe one is wrong, propose a
  change to the user and record the new decision — don't silently diverge.

**Architecture**
- Use **mobile-first architecture, not web-first thinking.** No DOM / Next.js / server-component
  / web-page mental models. Think native iOS + Android.
- Use **feature folders** (`src/features/<domain>/`).
- Keep **screens thin** — route/screen files do layout composition, data prefetching, and
  navigation bindings only.
- Keep **business logic outside screens** — it lives in feature hooks → domain → data layers.
- Keep **streaks and leaderboards server-authoritative.** The client is the source of truth ONLY
  for drafts and the offline upload queue, never for scores, streaks, or verification results.

**Why these rules exist:** see `PROJECT_BRIEF.md` and `DECISIONS.md`. They prevent the failure
modes that sink mobile apps — lost proof on bad networks, cheatable client-side streaks, god
components, and web patterns that feel wrong on a phone.

---

## 📦 Stack (locked — see DECISIONS.md D-001)

- **App:** React Native + TypeScript, Expo Development Builds + EAS.
- **Backend:** Supabase / Postgres (Auth + RLS, server-authoritative scoring via Postgres
  functions + pg_cron, Storage with signed URLs, push scheduling).
- **Offline:** local SQLite (WatermelonDB) + MMKV; durable mutation/upload queue; tus resumable
  uploads.

## 🎯 MVP scope (one line)

Register → join/create a friend group → start a solo/group challenge → submit daily photo proof →
a friend verifies it → streaks, group leaderboard, and push reminders keep it going. Works offline
(drafts + upload queue). **Not in MVP:** AI verification, Explore feed, global leaderboard, full chat.

See [`AGENTS.md`](AGENTS.md) for the condensed agent-facing version of these rules.
