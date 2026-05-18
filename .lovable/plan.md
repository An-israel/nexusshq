&nbsp;

&nbsp;

## Goal

Lock in multi-tenancy: signup creates a clean workspace, super admins can create/disable/manage every workspace and invite people into specific workspaces with a role, and an automated test proves RLS keeps tenants isolated.

## Current state (verified)

- Signup at `/signup` already creates the user, workspace, and `workspace_members` row as `owner` — works correctly.
- `super_admin_users` table + `is_super_admin()` exist; the two designated emails are seeded.
- `/super-admin` route is gated, lists workspaces, and supports suspend / activate / extend trial.
- `workspaces` and `workspace_members` RLS scope reads/writes to members + super admins.
- `ensure_skryve_seed` no longer dumps every new user into Skryve.
- **Missing**: `workspace_invites` table, invite UI, super-admin "create workspace" + "manage members/roles", and any automated isolation check.

## Changes

### 1. Database migration

- Create `workspace_invites` table: `id`, `workspace_id`, `email`, `role` (`workspace_member_role`), `token` (unique, default `gen_random_bytes`), `invited_by`, `expires_at` (default `now() + 7d`), `accepted_at`, `created_at`. RLS: workspace admins + super admins can manage rows for their workspace; anyone with a valid token can `SELECT` their own row by token (via security-definer function), no public table read.
- `redeem_workspace_invite(_token text)` security-definer function: validates token + expiry + email match, inserts `workspace_members` row, marks invite accepted, returns the workspace slug.
- `create_workspace_as_super_admin(_name, _slug, _plan, _owner_email)` security-definer function: super-admin only; creates workspace + (if owner email matches an existing user) member row.

### 2. Super admin dashboard additions

In `src/routes/super-admin.tsx`:

- **New "Create workspace" button** in the Workspaces tab → dialog (name, slug, plan, optional owner email).
- **Workspace detail sheet → Members section**: list members with role + active flag; super admin can change role (owner/admin/manager/employee), deactivate/reactivate, or remove. Uses direct table writes under `is_super_admin()` RLS.
- **Invites section in detail sheet**: list pending invites for the workspace; "Invite user" form (email + role) inserts into `workspace_invites` and shows a copyable invite URL `…/accept-invite?token=…`.

### 3. Invite acceptance flow

Update `src/routes/accept-invite.tsx` so it also handles `?token=…` invites:

- If token present and user is signed in: call `redeem_workspace_invite(token)`, then redirect to `/{slug}/dashboard`.
- If token present and not signed in: prompt to sign up / sign in first, preserving the token.
- Existing Supabase-invite-link flow (hash tokens) is preserved.

### 4. Workspace creation during onboarding

Defensive: if a signed-in user has zero `workspace_members` rows (e.g. legacy account, failed signup), `_app.tsx` redirects them to a small `/create-workspace` page that runs the same insert chain as signup step 2 (workspace + member as owner). This guarantees every user has a workspace path.

### 5. Automated RLS isolation test

Add `scripts/test-tenant-isolation.mjs` (run with `node scripts/test-tenant-isolation.mjs`):

- Uses service-role to create two throwaway test users in two separate workspaces with seed data (one task, one channel, one direct message each).
- Signs in as User A with the publishable key and asserts:
  - `workspaces` query returns only workspace A.
  - `workspace_members`, `tasks`, `channels`, `messages`, `direct_messages`, `documents`, `announcements`, `kpis`, `okrs`/`objectives` queries return zero rows from workspace B.
  - INSERT into workspace B's `messages` / `tasks` is rejected by RLS.
- Repeats for User B.
- Cleans up test users + workspaces.
- Exits non-zero on any leak. README documents how to run it.

## Technical notes

- All super-admin writes rely on existing RLS (`is_super_admin()` already permits UPDATE on `workspaces`); we'll add equivalent policies on `workspace_members` (super-admin manage) and `workspace_invites`.
- Invite tokens are URL-safe base64 from `gen_random_bytes(24)`.
- Frontend keeps using the browser `supabase` client; no new server functions needed except optional `acceptInvite` wrapper for nicer error handling.
- `ensure_skryve_seed` is left alone — already fixed.

## Out of scope

- Email delivery for invites (we surface the URL; existing transactional-email infra can be wired later).
- Billing changes for super-admin-created workspaces (defaults to `business`, no subscription row — matches today's manual workspaces).

I need to be able to see previous standups the one I was sent a week ago the one that was sent yesterday and a few days back like all standups I should be able to see them and go back to be able to track what my employees are doing

I still cannot send DM’s to users

AI task is not working

As an admin, I realize that the invitation link is not working when user tried to login with it to my workspace. It keeps telling them that the link is expired so fix that and then the code is not also showing. It’s just showing nothing there.