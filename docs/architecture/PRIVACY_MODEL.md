# PRIVACY_MODEL.md

> Server-authoritative visibility for Basta. The foundation + enforcement, and **Global v1**
> (a chronological feed of public verified *submissions* — `app/(tabs)/explore.tsx` +
> `src/features/global/`, gated by `list_global_submissions` → `is_submission_globally_visible`).
> Still deferred: public challenge/group directories, profile search, global leaderboards, ranking.
> See DECISIONS **D-014**. Migrations: `20260614000000_visibility_foundation.sql` +
> `20260615000000_privacy_enforcement.sql` + `20260616000000_global_feed_v1.sql` +
> `20260617000000_global_feed_hardening.sql` (the last two widen the submission-social SELECT
> policies to `can_view_submission`/`to authenticated`, block-filter the social list RPCs + Global
> counts via `is_block_between`, and add `list_viewable_user_submissions`).

## Principles

- **Default private / off.** `profiles.visibility`, `groups.visibility`, `challenges.visibility`
  default `'private'`; `submissions.is_public` defaults `false`. Nothing is exposed by omission.
- **Privacy is enforced on the server**, never by client-side filtering. RLS policies +
  SECURITY DEFINER functions are the boundary.
- **One predicate gates Global.** `is_submission_globally_visible(uuid)` is the single source of
  truth; both the feed query (future) and the proof-media image policy call it, so they can't drift.
- **No service-role key in the app.** Only the anon key ships; privileged logic is SECURITY DEFINER
  RPCs or (future) Edge Functions.

## What "public" means

`public` makes content **eligible** for Global display later. It does **not**:
- auto-join anyone to a group, or
- expose a group's **invite code** (always private), or
- create discovery tabs for profiles/groups/challenges. **Global v1 should be public verified
  submissions/posts only**; profiles/challenges/groups are *linked from posts*, not separately
  browsable.

## The Global predicate — `is_submission_globally_visible(submission_id)`

A submission is globally visible only when **all** hold:
1. `submission.status = 'verified'`
2. `submission.is_public = true`
3. author `profile.visibility = 'public'`
4. `challenge.visibility = 'public'` and `challenge.archived_at is null`
5. if a group challenge: host `group.visibility = 'public'` and `group.archived_at is null`
6. no `blocks` row between the viewer (`auth.uid()`) and the author, **either direction**

## Access helpers

- **`can_view_submission(submission_id)`** = `(author OR challenge participant)` *(existing private
  rules)* **OR** `is_submission_globally_visible(...)`. Used by the submission-detail + social RPCs.
- **`get_viewable_profile(user_id)`** — SECURITY DEFINER, returns **only** safe columns
  (`id, username, display_name, avatar_url, description, visibility`) and a row only when: self,
  target is public, or `shares_group_or_challenge`. Never returns `timezone/onboarded/terms_version`.
  Other-user reads go through this RPC; the broad `profiles_select_public USING (true)` policy was
  removed. Own profile is still read/edited directly (RLS `profiles_select_own`).
- **`shares_group_or_challenge(viewer, target)`** — do they co-belong to any group or challenge.

## Proof-media (private bucket)

`proof-media` stays **private**. The `storage_proof_media_select` policy allows SELECT when:
author (1st path segment = uid) **OR** challenge participant (2nd segment = challenge id) **OR**
`is_submission_globally_visible(<submission id from 3rd segment>)`. UUID casts are regex-guarded so a
malformed object name can't error the policy. Clients fetch images via short-lived **signed URLs**
(`getProofSignedUrl`), which only succeed when this SELECT policy passes — so blocked / ineligible
viewers can't load public proof images, and private images stay private.

## Avatar semantics (3-state) — applies to profile + group

`undefined`/omitted = **keep** existing · `null` = **remove** · `string` = **set** new path.
The client must not collapse `null → undefined`. `update_group_meta` uses an explicit
`p_clear_avatar boolean` (a bare null means "keep" under its `coalesce`).

---

## Manual smoke-test checklist

No automated test harness yet — run these by hand against the live project after applying the
migrations. Needs ≥2 accounts (A, B) and a 3rd (C) for block tests.

### Profile privacy
1. A private, B unrelated → B **cannot** view A's full profile (other-user screen shows unavailable).
2. A public, B authenticated → B sees safe public fields (name/avatar/bio), **not** timezone/onboarded/terms.
3. A private → A can still view + edit own profile.
4. A private but A & B share a group → B sees A's safe public fields (co-member view).

### Submission visibility
1. Private challenge / private submission → unrelated user cannot open the submission.
2. Public profile + public challenge + public **verified** submission → unrelated authed user can view.
3. Public submission but **private profile** → not globally viewable.
4. Public submission but **private challenge** → not globally viewable.
5. Group challenge, public submission but **private group** → not globally viewable.
6. **Unverified** public submission → not globally viewable.
7. C blocked by author (or C blocks author) → C cannot view/interact with the author's global submission.

### Proof media
1. Private proof image cannot be opened by an unrelated user (signed-URL creation fails).
2. Globally visible proof image loads for an eligible authed viewer.
3. Blocked viewer cannot load the proof image.

### Social (comments/reactions)
1. Eligible global viewer can open submission detail.
2. Eligible global viewer can comment + react.
3. Ineligible viewer cannot comment/react (RPC raises `not allowed`).
4. Participants retain existing private-challenge behavior (comment/react as before).

### Avatar removal
1. Set profile avatar → 2. Remove it → 3. DB `profiles.avatar_url` clears + UI updates.
4. Set group avatar → 5. Remove it → 6. DB `groups.avatar_path` clears + UI updates.
7. After removal, setting a new avatar still works.

### Group visibility
1. Create group → defaults to **private**.
2. Create group with the Public toggle on → group is public.
3. Invite code is never exposed by being public (only owner/members see it).
