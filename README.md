# Basta

**Basta** is a mobile-first social challenge tracker for iOS and Android.

The app turns self-development into a social accountability loop: create solo or group challenges, submit photo proof, get verified by friends, keep streaks alive, and discover public verified proofs through the Global feed.

> Status: active MVP development. The app is feature-rich but not production-ready yet.

---

## Core idea

Basta is built around a simple loop:

```text
Create or join a group
→ Start a solo/group challenge
→ Submit daily photo proof
→ Friends verify it
→ Streaks, leaderboards, and profiles update
```

The product focuses on accountability, proof, social pressure, and progress tracking.

---

## Main features

### Authentication and profiles

* Email/password authentication
* 6-digit email verification flow
* Password reset with deep link support
* Profile setup with avatar, username, display name, and bio
* Public/private profile visibility
* Profile tabs:

  * Submissions
  * Challenges
  * Groups
* Compact activity calendar
* Current and best streak stats
* Profile-level challenge/group summaries

### Groups

* Create groups
* Join groups by invite code
* Group avatars and descriptions
* Public/private groups
* Group member roles
* Group leader transfer
* Leave/archive/restore group flows
* Public group previews for non-members
* Member-only full group detail

### Challenges

* Solo and group challenges
* Step-by-step challenge creation wizard
* Challenge categories, emoji, duration, start/end dates, and proof requirements
* Visible/hidden challenge setting
* Challenge detail screens
* Public challenge previews for non-participants
* Challenge deletion for creators
* Server-authoritative streak logic

### Proof submissions

* Photo-first proof submission
* Optional proof comment/description
* Offline proof drafts
* Durable upload queue using local SQLite storage
* Supabase Storage upload
* Submission detail screen with:

  * proof image
  * author/challenge/group context boxes
  * comments
  * reactions
  * report/block actions behind a 3-dot menu

### Verification

* Friend verification flow
* Pending verification inbox
* Group proof verification
* Solo challenge auto-verification
* Verified/rejected submission states

### Global feed

* Global tab showing public verified submissions
* Server-side visibility filtering
* Stable pagination
* Private proof media access through gated signed URL / policy logic
* Public submissions can be opened by eligible viewers
* Author profile navigation
* Challenge/group context navigation through previews when viewer is not a participant

### Social features

* Reactions
* Comments
* Comment likes
* Reactor/liker lists
* Block/report flows
* Block-aware Global and social surfaces

### Push notification infrastructure

* Expo push token registration
* Supabase `push_tokens` table/RPCs
* Server-side push dispatch through a Supabase Edge Function
* Verification-related push notification outbox
* Device token revocation for invalid tokens

> Scheduled reminders, notification preferences, and streak-at-risk reminders are planned but not complete yet.

---

## Privacy model

Basta uses a server-side visibility model.

### Profiles

Profiles can be:

```text
public
private
```

Private profiles do not appear in public/global surfaces.

### Groups

Groups can be:

```text
public
private
```

Public groups can be previewed, but invite codes are never exposed publicly and public groups are not auto-joinable.

### Challenges

Challenges are visible by default and can be hidden from profile/Global.

```text
visible/public challenge → eligible for profile/Global display
hidden challenge → hidden from public profile/Global
```

### Submissions

Submissions do not have a normal public/private toggle.

A verified submission appears in Global only if:

```text
author profile is public
challenge is visible/public
group is public, if it is a group challenge
submission is verified
content is not hidden/moderated
viewer and author have not blocked each other
```

The client does not decide privacy by itself. Public/private access is enforced by Supabase RLS and SECURITY DEFINER RPCs.

---

## Tech stack

### Mobile app

* React Native
* Expo SDK 54
* Expo Router
* TypeScript
* React 19
* TanStack Query
* Expo SecureStore
* Expo SQLite
* Expo Image Picker
* Expo Notifications

### Backend

* Supabase Auth
* Supabase Postgres
* Row Level Security
* Supabase Storage
* Supabase Edge Functions
* PostgreSQL RPCs and triggers

### Local/offline

* SQLite-backed local queue
* Offline proof drafts
* Retryable upload queue
* Foreground queue processor

---

## Project structure

```text
app/
  Expo Router routes and screens

src/entities/
  Shared TypeScript entity types and mappers

src/features/
  Feature slices:
  auth
  onboarding
  home
  profile
  groups
  challenges
  proofs
  verification
  leaderboard
  global
  social
  moderation
  notifications

src/offline/
  SQLite database, upload queue, and offline proof handling

src/services/
  Supabase client, notifications, analytics/crash placeholders

src/shared/
  UI primitives, theme helpers, shared utilities

supabase/
  migrations/
  functions/

docs/
  architecture/
  claude-memory/
```

---

## Requirements

Install these locally:

```text
Node.js
npm
Expo CLI / npx expo
Supabase CLI
EAS CLI, for development builds and push notification testing
```

Recommended:

```bash
npm install -g eas-cli
```

Supabase CLI can be used through `npx supabase`.

---

## Environment variables

Copy the example file:

```bash
cp .env.example .env
```

Fill in:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Only public client-safe values belong in `.env`.

Do **not** put the Supabase service-role key in the mobile app.

---

## Install dependencies

```bash
npm install
```

If npm hits the known React / peer dependency conflict, use:

```bash
npm install --legacy-peer-deps
```

---

## Run the app

Start Expo:

```bash
npm run start
```

Or:

```bash
npm run ios
npm run android
```

For a clean Expo cache:

```bash
npx expo start -c
```

Push notification testing requires an EAS development build. Expo Go is not enough for final push testing.

---

## Supabase setup

### 1. Create or link a Supabase project

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

### 2. Apply migrations

For a fresh Supabase project:

```bash
npx supabase db push
```

This applies the migrations in `supabase/migrations/`.

The project currently uses a consolidated bootstrap migration plus later patch migrations. Apply migrations in chronological order if using the Supabase SQL Editor manually.

### 3. Create Storage buckets

Create these buckets in Supabase Dashboard:

```text
proof-media      private
group-avatars    public
user-avatars     public
```

`proof-media` must stay private.

Do not make proof media public. Proof access is controlled through server-side visibility checks.

### 4. Configure Auth email

In Supabase Dashboard:

```text
Authentication → Providers → Email
```

Enable email auth and email confirmation.

For the confirmation email template, use the OTP token variable:

```html
<h2>Your Basta verification code</h2>

<p>Use this 6-digit code to confirm your email address:</p>

<h1 style="font-size: 32px; letter-spacing: 6px;">
  {{ .Token }}
</h1>

<p>If you did not create a Basta account, you can ignore this email.</p>
```

### 5. Configure password reset redirect

In Supabase Dashboard:

```text
Authentication → URL Configuration → Redirect URLs
```

Add:

```text
basta://reset-password
```

### 6. Deploy Edge Function for push dispatch

Set the dispatch secret:

```bash
npx supabase secrets set DISPATCH_PUSH_SECRET=your_long_random_secret
```

Optional Expo access token:

```bash
npx supabase secrets set EXPO_ACCESS_TOKEN=your_expo_access_token
```

Deploy:

```bash
npx supabase functions deploy dispatch-pushes --no-verify-jwt
```

Because the function is deployed with `--no-verify-jwt`, requests must be protected with the dispatch secret header.

---

## EAS development build

Initialize EAS if needed:

```bash
npx eas login
npx eas init
```

Build a development client:

```bash
npx eas build --profile development --platform ios
```

or:

```bash
npx eas build --profile development --platform android
```

After `eas init`, confirm `app.json` has an EAS project ID under:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "..."
      }
    }
  }
}
```

Push token registration depends on this project ID.

---

## Quality checks

Run before committing:

```bash
npm run typecheck
npm run lint
npx expo-doctor
```

Useful Git checks:

```bash
git status
git diff
```

Make sure `.env` is never staged.

---

## Git workflow

Recommended branch workflow:

```bash
git checkout mvp
git pull origin mvp
```

After changes:

```bash
npm run typecheck
npm run lint
npx expo-doctor

git status
git add .
git status
git commit -m "your commit message"
git push origin mvp
```

Do not commit:

```text
.env
Supabase service-role keys
API secrets
local build artifacts
node_modules
```

---

## AI-assisted development notes

This repository is maintained with a persistent project-memory workflow.

Before making larger changes, read:

```text
CLAUDE.md
AGENTS.md
docs/claude-memory/CURRENT_STATE.md
docs/claude-memory/HANDOFF.md
docs/claude-memory/TASKS.md
docs/claude-memory/BUGS_AND_WARNINGS.md
docs/claude-memory/DECISIONS.md
docs/claude-memory/FILE_MAP.md
```

Architecture references live in:

```text
docs/architecture/
```

Important rule:

```text
The repository is the source of truth.
Do not rely only on chat memory.
```

---

## Current development status

Implemented:

```text
Auth
Profiles
Groups
Challenges
Proof submission
Verification
Streaks
Leaderboards
Comments/reactions
Global public submissions feed
Public challenge/group previews
Moderation actions
Push token registration
Server-side push dispatch foundation
Offline proof queue
```

Still planned or incomplete:

```text
Notification preferences
Daily reminders
Streak-at-risk reminders
Scheduled push dispatch
Full test harness
CI
Store/beta release setup
Privacy hardening for public preview edge cases
Analytics/crash reporting integration
```

---

## Security notes

* Supabase RLS is required.
* Proof media must remain private.
* Invite codes must never be exposed in public preview RPCs.
* Public groups are not auto-joinable.
* Service-role keys must never be included in the mobile app.
* Global/profile/public preview visibility must be enforced server-side, not by client-side filtering alone.

---

## License

No license has been selected yet.
