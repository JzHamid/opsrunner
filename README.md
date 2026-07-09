# OpsRunner

OpsRunner is a focused internal task runner for approved business workflows.
It gives operators a clean web interface while keeping n8n execution behind a
server-side Next.js API route.

## Local Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Create `.env.local` with:

```bash
N8N_OPSRUNNER_WEBHOOK_URL=
```

The webhook URL is read only by the server-side route. Do not expose it in
client code.

## Workflow Contract

The interface posts approved task IDs to `/api/run-task`. The server validates
the request, maps the ID to an approved `task_type`, then sends n8n:

```json
{
  "task_type": "summarize_notes",
  "input": "Task context from the user.",
  "source": "opsrunner-web",
  "reference": null,
  "submittedAt": "2026-07-10T00:00:00.000Z"
}
```

Supported task types are `summarize_notes`, `generate_checklist`,
`format_client_update`, and `create_followup_draft`.

n8n should return a JSON object with `ok`, `title`, `result`, `next_steps`,
`source`, `workflow_status`, and `processed_at`. After a successful webhook
response, the server applies deterministic, task-specific presentation
formatting. Fallback responses remain successful and retain their fallback
state in the interface.

## Checks

```bash
npm run lint
npm run build
```
