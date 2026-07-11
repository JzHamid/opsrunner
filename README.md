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

Each request is validated and routed by an approved task identifier. Technical
response data stays hidden under `Details` in the interface.

## Core Workflow

```text
Frontend form
  -> server-side API route
  -> n8n webhook
  -> task routing
  -> structured JSON response
  -> result display
```

The browser calls `POST /api/run-task`. Only that server-side route calls n8n.

## Tech Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, and Row Level Security
- n8n Cloud webhook workflow
- Vercel deployment

## Supabase Foundation

Phase 1B adds the multi-organization data foundation without changing the
current runner or enabling application authentication yet.

The schema contains only:

- `profiles`: self-only user profile records
- `organizations`: organization identity and ownership
- `organization_memberships`: organization-scoped roles and membership status

The roles are `owner`, `admin`, `operator`, and `viewer`. Membership status is
`invited`, `active`, or `suspended`. RLS denies anonymous table access and
isolates organization reads through active memberships.

Authentication, session refresh, and protected page access are implemented in
Phase 1C. The organization application shell and `/api/run-task` protection
remain deferred to Phase 1D.

## Authentication

OpsRunner uses invite-only magic-link authentication. The public login form
never creates users and always returns a neutral confirmation message.

Page access is handled through a Supabase SSR proxy:

- Unauthenticated users are sent to `/login`.
- Active organization members can use the runner at `/`.
- Authenticated users without an active membership are sent to `/no-access`.
- `/api/*` remains unchanged until Phase 1D, including `/api/run-task`.

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
  "source": "opsrunner-web",
  "reference": null,
  "submittedAt": "2026-07-10T00:00:00.000Z"
}
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

The API route normalizes n8n fields for the interface and applies deterministic
task-specific presentation formatting. Empty responses, `ok: false`, and
non-successful HTTP responses are returned as request failures.

## Environment Variables

Create `.env.local` from `.env.example` and set:

```bash
APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
N8N_OPSRUNNER_WEBHOOK_URL=
```

`APP_URL` is server-only and must match the Supabase Site URL. The Supabase URL
and publishable key are browser-safe project identifiers used with RLS. Do not
add a Supabase secret or service-role key.

Use the production webhook URL for the published `OpsRunner Task Router`
workflow. Restart the development server after changing environment variables.

## Local Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), select a task, enter the
required context, and choose `Run task` after signing in with an invited
account.

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

1. Run each of the four approved task types.
2. Confirm the result has a title, body, next steps, status, and processed time.
3. Confirm checklist items render as separate steps.
4. Open `Details` and verify the raw response is valid JSON.
5. Confirm fallback responses show `Safe fallback` rather than an error.

## Deployment Notes

OpsRunner is ready for a standard Next.js deployment on Vercel:

1. Connect the repository to a Vercel project.
2. Create or select the intended Supabase project and apply migrations.
3. Add `APP_URL`, the two public Supabase variables, and
   `N8N_OPSRUNNER_WEBHOOK_URL` to the required Vercel environments.
4. Confirm the n8n workflow is published and its production webhook is active.
5. Deploy and run all four task types against the production app.

Do not place the webhook URL in source code or expose it through client-side
configuration.

## Security Notes

- The browser never calls n8n directly.
- The n8n webhook URL is read only by the server-side API route.
- Do not prefix the webhook variable with `NEXT_PUBLIC_`.
- No Supabase secret or service-role key is used by the application.
- `APP_URL` remains server-only and is never prefixed with `NEXT_PUBLIC_`.
- Anonymous users have no grants on the Phase 1B application tables.
- Organization authorization comes from current membership rows, not user
  metadata or JWT role claims.
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
