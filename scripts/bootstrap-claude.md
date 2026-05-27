# Bootstrap a Claude session for Basta (read me if you are "Claude 2")

This project is run by **two separate Claude accounts that swap sessions** and share no private
chat memory. The repo is the only shared brain. Run this one-time setup so any Claude account is
configured identically to the others.

> If both Claudes run on the **same machine + same OS user**, you already share `~/.claude/` and can
> skip steps 2–3 — they're already installed. Steps 1 and 4 still apply.

## 1. Enable the shared git hooks (required, per clone)

The secret-scan pre-commit hook lives in `.githooks/` (tracked in the repo) but git only uses it
after you point `core.hooksPath` at it:

```bash
git config core.hooksPath .githooks
```

Verify: `git config core.hooksPath` → should print `.githooks`. Test it by trying to commit a line
like `sk_live_xxx` in a scratch file — the commit must be blocked. (Enforces W-006 / TASKS T-014.)

Optional but recommended: install **gitleaks** so the hook does full staged-content scanning
instead of the regex fallback (`brew install gitleaks` / `scoop install gitleaks` / see
github.com/gitleaks/gitleaks).

## 2. Project skill (already in the repo — no action)

`mobile-app-architect` lives in [`.claude/skills/mobile-app-architect/`](../.claude/skills/) and
loads automatically because it's a project skill. Nothing to install. This is the project's
architecture brain — RN/Expo + Supabase, offline-sync, shadcn-as-mindset.

## 3. Install the shared third-party skills (account-local)

These are NOT vendored into the repo (bulk + licensing). Install them into your account's
`~/.claude/skills/` once:

```bash
# Superpowers — workflow skills (brainstorming, writing-plans, TDD, debugging, code review…)
git clone --depth 1 https://github.com/obra/superpowers /tmp/superpowers
cp -r /tmp/superpowers/skills/* ~/.claude/skills/

# Anthropic skills — capability skills (skill-creator, frontend-design, webapp-testing, …)
git clone --depth 1 https://github.com/anthropics/skills /tmp/anthropic-skills
cp -r /tmp/anthropic-skills/skills/* ~/.claude/skills/   # skip claude-api if it collides with a built-in
```

Then **reload the Claude Code window** — skills register at session start.

The skills Claude 2 must have for parity with Claude 1: `brainstorming`, `writing-plans`,
`executing-plans`, `test-driven-development`, `systematic-debugging`,
`verification-before-completion`, `requesting-code-review`, `receiving-code-review`,
`skill-creator`, `using-superpowers` (plus the project's `mobile-app-architect`).

## 4. Match settings + identity

- **Model/effort:** `.claude/settings.json` pins `model: opus` for parity. Set your effort high
  (`/config` or user settings `"effortLevel": "xhigh"`).
- **Git identity (per clone):** use your own so commit attribution distinguishes the two Claudes:
  ```bash
  git config user.name "Claude 2"
  git config user.email "<your-commit-email>"
  ```
- **Permissions:** `.claude/settings.json` carries a shared allow/ask/deny list so both Claudes get
  the same prompts and the same blocks on reading secret files.

## 5. Then follow the normal start-of-session checklist

See [`../CLAUDE.md`](../CLAUDE.md): read `docs/claude-memory/*` (HANDOFF first), check `git status`,
continue from existing repo state. **Do not rely on the other Claude's personal memory — it is not
shared. The repo's `docs/claude-memory/` is the source of truth.**
