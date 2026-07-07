# OpsRunner Agent Instructions

## Product Overview

OpsRunner is an internal task runner for executing approved business workflows through n8n.

The product provides a focused web interface where a user can choose a task type, provide task context, run the workflow, and review a structured result. The app should make repeatable operations easier to trigger without exposing the underlying n8n webhook or workflow internals.

Do not describe the app as a demo, tutorial, template, mockup, or portfolio project inside the product UI or user-facing copy.

## Core User Flow

1. User selects a task type.
2. User enters task context.
3. User runs the task.
4. The frontend calls a server-side API route.
5. The server-side API route calls the n8n webhook.
6. n8n routes and processes the task.
7. The app displays a clean result.
8. Technical details are available only through progressive disclosure.

## Supported Task Types

Initial task types:

- `summarize_notes`
- `generate_checklist`
- `format_client_update`
- `create_followup_draft`

Do not add more task types until the first four are stable.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Server-side Route Handlers
- n8n webhook
- Vercel deployment

## Architecture Rules

- The browser must never call n8n directly.
- The frontend must call an internal API route.
- The internal API route must call the n8n webhook using `N8N_OPSRUNNER_WEBHOOK_URL`.
- The n8n webhook URL must only exist in server-side environment variables.
- Do not use `NEXT_PUBLIC_` for webhook URLs or private keys.
- Keep the request and response contracts stable.
- Treat fallback responses as successful if `ok` is `true`.
- Only show an error when the request fails completely, `ok` is `false`, or no usable result exists.

## Expected Request Contract

The internal API route should send this shape to n8n:

```json
{
  "task_type": "summarize_notes",
  "input": "Task context from the user.",
  "source": "opsrunner-web"
}