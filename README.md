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
- n8n Cloud webhook workflow
- Vercel deployment

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
N8N_OPSRUNNER_WEBHOOK_URL=
```

Use the production webhook URL for the published `OpsRunner Task Router`
workflow. Restart the development server after changing environment variables.

## Local Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), select a task, enter the
required context, and choose `Run task`.

## Testing

Run the project checks:

```bash
npm run lint
npm run build
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
2. Add `N8N_OPSRUNNER_WEBHOOK_URL` to the required Vercel environments.
3. Confirm the n8n workflow is published and its production webhook is active.
4. Deploy and run all four task types against the production app.

Do not place the webhook URL in source code or expose it through client-side
configuration.

## Security Notes

- The browser never calls n8n directly.
- The n8n webhook URL is read only by the server-side API route.
- Do not prefix the webhook variable with `NEXT_PUBLIC_`.
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
