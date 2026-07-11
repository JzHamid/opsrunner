# OpsRunner

## Product Overview

OpsRunner is an internal task runner for executing approved business workflows
through n8n. It lets a user choose a task type, provide context, run the
workflow, and review a structured result from one focused interface.

## What OpsRunner Does

OpsRunner currently supports four approved tasks:

- Summarize Notes
- Generate Checklist
- Format Client Update
- Create Follow-up Draft

Each request is validated, authorized against the current organization, and
routed by an approved task type. Technical response data stays hidden under
`Details` in the interface.

## Core Workflow

```text
Organization-scoped frontend form
  -> verified user and active membership
  -> server-side API route
  -> n8n webhook
  -> task routing
  -> structured JSON response
  -> result display
```

The browser calls `POST /api/run-task`. Only that server-side route calls n8n,
after reauthorizing the user and organization.

## Tech Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, and Row Level Security
- n8n Cloud webhook workflow
- Vercel deployment

## Supabase Foundation

Phase 1B established the multi-organization data foundation used by the
protected workspace.

The schema contains only:

- `profiles`: self-only user profile records
- `organizations`: organization identity and ownership
- `organization_memberships`: organization-scoped roles and membership status

The roles are `owner`, `admin`, `operator`, and `viewer`. Membership status is
`invited`, `active`, or `suspended`. RLS denies anonymous table access and
isolates organization reads through active memberships.

Phase 1C added authentication and session refresh. Phase 1D adds the
organization-aware shell and protects task execution with active memberships.

## Authentication

OpsRunner uses invite-only magic-link authentication. The public login form
never creates users and always returns a neutral confirmation message.

Page access is handled through a Supabase SSR proxy:

- Unauthenticated users are sent to `/login`.
- Active organization members are routed from `/` to
  `/org/[organizationSlug]/run`.
- Authenticated users without an active membership are sent to `/no-access`.
- Organization routes and `/api/run-task` reauthorize access server-side; proxy
  redirects are not the only authorization boundary.

## Route Structure

- `/`: resolves the signed-in user's first active organization.
- `/org/[organizationSlug]/run`: protected task runner and application shell.
- `/login`: invite-only magic-link login.
- `/no-access`: authenticated state for users without an active membership.
- `/api/run-task`: protected task execution endpoint.

Unknown, inactive, and cross-organization route access returns the same
not-found behavior so organization existence is not disclosed.

## n8n Workflow Contract

The server maps the selected task to one of these `task_type` values:

- `summarize_notes`
- `generate_checklist`
- `format_client_update`
- `create_followup_draft`

Request sent from the server to n8n:

```json
{
  "task_type": "summarize_notes",
  "input": "Task context from the user.",
  "reference": null,
  "source": "opsrunner-web",
  "organization_id": "trusted-organization-uuid",
  "organization_slug": "opsrunner-workspace",
  "user_id": "trusted-user-uuid",
  "requested_at": "2026-07-10T00:00:00.000Z"
}
```

The browser sends `organization_slug` only as a lookup hint. The API verifies
the signed-in user, resolves the organization through RLS, checks the active
membership, and derives `organization_id`, `organization_slug`, and `user_id`
before forwarding the request.

The n8n Webhook node must use Header Auth with:

```text
X-OpsRunner-Secret: <value of N8N_OPSRUNNER_WEBHOOK_SECRET>
```

Successful n8n response:

```json
{
  "ok": true,
  "task_type": "summarize_notes",
  "title": "Notes Summary",
  "result": "A concise structured result.",
  "next_steps": ["Review the result", "Complete the next action"],
  "source": "n8n",
  "workflow_status": "completed",
  "processed_at": "2026-07-10T00:00:00.000Z"
}
```

The API route normalizes n8n fields for the interface while preserving the
workflow-generated title, result, next steps, and checklist structure. Local
content is used only when a successful fallback response is incomplete. Empty
or malformed responses, `ok: false`, and non-successful HTTP responses are
returned as request failures.

## Environment Variables

Create `.env.local` from `.env.example` and set:

```bash
APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
N8N_OPSRUNNER_WEBHOOK_URL=
N8N_OPSRUNNER_WEBHOOK_SECRET=
```

`APP_URL` is server-only and must match the Supabase Site URL. The Supabase URL
and publishable key are browser-safe project identifiers used with RLS. Do not
add a Supabase secret or service-role key.

Use the production webhook URL and matching Header Auth secret for the
published `OpsRunner Task Router` workflow. Both n8n variables are server-only.
Restart the development server after changing environment variables.

## Local Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with an invited
account that has an active organization membership. OpsRunner redirects to that
organization's runner, where you can select a task and choose `Run task`.

## Local Supabase Setup

The Supabase CLI requires Docker Desktop and Node.js 20 or newer.

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

`db reset` applies every migration and then runs `supabase/seed.sql`. The seed
file intentionally inserts no users or organization data. Database tests create
disposable users inside transactions and roll them back.

To apply migrations to a Supabase project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Before pushing, review the migration and confirm the linked project is the
intended non-production or production environment.

## Supabase Dashboard Configuration

1. In Authentication settings, keep email signups disabled.
2. Set the Site URL to the production value of `APP_URL`.
3. Add exact local and production `/auth/confirm` URLs to the redirect allow
   list.
4. Set the Magic Link email template to:

   ```text
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
   ```

5. Set the Invite User email template to:

   ```text
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
   ```

6. Invite-only provisioning order:
   - An operator invites the user through Supabase Dashboard.
   - Supabase creates the Auth user.
   - The operator copies that user UUID.
   - The operator creates an active organization membership for that UUID.
   - The user accepts the invite or signs in with a magic link.

## Database Types

`lib/supabase/database.types.ts` matches the Phase 1B public schema. Regenerate
it after applying migrations locally:

```bash
npx supabase gen types typescript --local --schema public > lib/supabase/database.types.ts
```

On Windows PowerShell, use `Out-File -Encoding utf8` instead of `>` if the shell
writes redirected output with the wrong encoding.

## Testing

Run the project checks:

```bash
npm test
npm run lint
npm run build
```

Run the database checks while the local Supabase stack is running:

```bash
npx supabase db reset
npx supabase test db
npx supabase db lint --local --level warning
```

For a manual workflow check:

1. Confirm an unauthenticated visit to `/` redirects to `/login`.
2. Confirm an active member reaches `/org/[organizationSlug]/run`.
3. Confirm another organization's slug returns the same not-found state as an
   unknown slug.
4. Run each of the four approved task types.
5. Confirm the result has a title, body, next steps, status, and processed time.
6. Open `Details` and verify the raw response is valid JSON.
7. Confirm fallback responses show `Safe fallback` rather than an error.
8. Remove `N8N_OPSRUNNER_WEBHOOK_SECRET` locally and confirm the request fails
   safely without calling n8n.

## Deployment Notes

OpsRunner is ready for a standard Next.js deployment on Vercel:

1. Connect the repository to a Vercel project.
2. Create or select the intended Supabase project and apply migrations.
3. Add `APP_URL`, the two public Supabase variables, and both server-only n8n
   variables to the required Vercel environments.
4. Confirm the n8n workflow is published and Header Auth uses the same secret.
5. Deploy and run all four task types against the production app.

Do not place the webhook URL in source code or expose it through client-side
configuration.

## Security Notes

- The browser never calls n8n directly.
- The n8n webhook URL is read only by the server-side API route.
- The n8n Header Auth secret is read only by the server-side API route.
- Do not prefix either n8n variable with `NEXT_PUBLIC_`.
- No Supabase secret or service-role key is used by the application.
- `APP_URL` remains server-only and is never prefixed with `NEXT_PUBLIC_`.
- Anonymous users have no grants on the Phase 1B application tables.
- Organization authorization comes from current membership rows, not user
  metadata or JWT role claims.
- Organization routes and task execution verify identity with `getClaims()` and
  recheck active membership through RLS.
- Browser-supplied user IDs, organization IDs, and roles are ignored.
- Magic-link confirmation accepts only `email` and `invite` token types.
- Do not commit `.env.local`.
- Only approved task IDs are accepted by the API route.
- Request fields and input lengths are validated before the webhook call.
- Secrets and complete request payloads should not be logged.

## Fallback Behavior

Invalid or unsupported n8n requests return a safe structured fallback:

```json
{
  "ok": true,
  "task_type": "unsupported_task",
  "title": "Fallback Result",
  "result": "A safe structured fallback result.",
  "next_steps": ["Review the output", "Run again later if needed"],
  "source": "n8n-fallback",
  "workflow_status": "fallback",
  "notice": "A safe fallback result was returned.",
  "processed_at": "2026-07-10T00:00:00.000Z"
}
```

Fallback responses remain successful when `ok` is `true`. The interface treats
`source: "n8n-fallback"` or `workflow_status: "fallback"` as a neutral
`Safe fallback` state, not as a request error.

## Deferred Modules

Requests, tasks, clients, approvals, audit history, workflow-run storage,
analytics, and AI integrations remain outside Phase 1D.
